-- ダイイングメッセージ オンラインモード用スキーマ
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- 何度実行しても同じ状態になるように書いているため、更新時はファイル全体を再実行してください。

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9]{4}$'),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'closed')),
  host_player_id uuid not null,
  created_at timestamptz not null default now()
);

-- 終了済み（closed）の部屋のコードは再利用できるようにする
create unique index if not exists rooms_active_code_idx
  on public.rooms (code)
  where status <> 'closed';

create table if not exists public.room_players (
  id uuid primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, name)
);

create index if not exists room_players_room_id_idx on public.room_players (room_id);

-- ---------------------------------------------------------------------------
-- ゲーム開始（お題決定・役職/手札配布）
-- ---------------------------------------------------------------------------

-- 各端末だけが知るトークンの SHA-256（hex）。本人確認が必要な RPC で照合する
alter table public.room_players add column if not exists token_hash text;

-- 全員に公開してよいゲーム状態（場札・被害者手札・フェーズなど）。正解は含めない
alter table public.rooms add column if not exists victim_player_id uuid;
alter table public.rooms add column if not exists game_state jsonb;

-- 正解（お題）。ポリシーを作らないため anon からは直接読み書きできない
create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  secret_answer jsonb not null,
  created_at timestamptz not null default now()
);

-- 手札補充用のヒントカード全体（A群・B群）。ゲーム開始時にホストが登録する
alter table public.room_secrets add column if not exists hint_pool jsonb not null default '[]'::jsonb;

-- RLS: 認証なし（anon キー）のプロトタイプ用に全操作を許可する
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_secrets enable row level security;

drop policy if exists "rooms_anon_all" on public.rooms;
create policy "rooms_anon_all" on public.rooms
  for all to anon using (true) with check (true);

drop policy if exists "room_players_anon_all" on public.room_players;
create policy "room_players_anon_all" on public.room_players
  for all to anon using (true) with check (true);

-- Realtime（postgres_changes）で変更を配信する
alter table public.room_players replica identity full;
alter table public.rooms replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players'
  ) then
    alter publication supabase_realtime add table public.room_players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RPC（security definer で RLS を越えて room_secrets を扱う）
-- ---------------------------------------------------------------------------

create or replace function public.is_room_member(p_room_id uuid, p_player_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where id = p_player_id
      and room_id = p_room_id
      and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.is_room_member(uuid, uuid, text) from public, anon, authenticated;

-- 手札補充用カードを受け取れるよう引数を増やしたため、旧シグネチャは削除する
drop function if exists public.start_online_game(uuid, uuid, text, uuid, jsonb);

-- ホストが呼び出す。場札27枚と被害者手札を検証し、正解を場札から抽選して保存する
create or replace function public.start_online_game(
  p_room_id uuid,
  p_player_id uuid,
  p_token text,
  p_victim_player_id uuid,
  p_game_state jsonb,
  p_hint_pool jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_board jsonb := p_game_state -> 'boardCards';
  v_hand jsonb := p_game_state -> 'victimHintHand';
  v_category text;
  v_card jsonb;
  v_secret jsonb := '{}'::jsonb;
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.host_player_id <> p_player_id then
    raise exception 'ゲームを開始できるのはホストのみです。' using errcode = '42501';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'この部屋はすでにゲームを開始しているか、解散されています。';
  end if;
  if (select count(*) from public.room_players where room_id = p_room_id) < 2 then
    raise exception 'プレイヤーは2名以上必要です。';
  end if;
  if not exists (
    select 1 from public.room_players where id = p_victim_player_id and room_id = p_room_id
  ) then
    raise exception '被害者に指定したプレイヤーが部屋にいません。';
  end if;

  if jsonb_typeof(v_board) is distinct from 'array'
    or jsonb_array_length(v_board) <> 27
    or (select count(distinct c ->> 'id') from jsonb_array_elements(v_board) c) <> 27 then
    raise exception '場のカードは重複なしの27枚である必要があります。';
  end if;

  foreach v_category in array array['occupation', 'weapon', 'motive'] loop
    if (
      select count(*) from jsonb_array_elements(v_board) c where c ->> 'category' = v_category
    ) <> 9 then
      raise exception '場のカードは各カテゴリ9枚である必要があります（%）。', v_category;
    end if;
    select c into v_card
      from jsonb_array_elements(v_board) c
      where c ->> 'category' = v_category
      order by random()
      limit 1;
    v_secret := v_secret || jsonb_build_object(v_category, v_card);
  end loop;

  if jsonb_typeof(v_hand) is distinct from 'array'
    or jsonb_array_length(v_hand) <> 12
    or (select count(*) from jsonb_array_elements(v_hand) h where h ->> 'group' = 'A') <> 6
    or (select count(*) from jsonb_array_elements(v_hand) h where h ->> 'group' = 'B') <> 6 then
    raise exception '被害者の初期手札はA群6枚・B群6枚である必要があります。';
  end if;

  if jsonb_typeof(p_hint_pool) is distinct from 'array'
    or exists (
      select 1 from jsonb_array_elements(v_hand) h
      where not exists (
        select 1 from jsonb_array_elements(p_hint_pool) p where p ->> 'id' = h ->> 'id'
      )
    ) then
    raise exception '手札補充用のヒントカード一覧が不正です。';
  end if;

  insert into public.room_secrets (room_id, secret_answer, hint_pool)
  values (p_room_id, v_secret, p_hint_pool)
  on conflict (room_id) do update
    set secret_answer = excluded.secret_answer,
        hint_pool = excluded.hint_pool,
        created_at = now();

  update public.rooms
  set status = 'playing',
      victim_player_id = p_victim_player_id,
      game_state = p_game_state
  where id = p_room_id;
end;
$$;

-- 正解を取得する。ゲーム中は被害者のみ、勝敗確定後（gameover / victory）は参加者全員
create or replace function public.get_room_secret(p_room_id uuid, p_player_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret jsonb;
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.rooms
    where id = p_room_id
      and (
        victim_player_id = p_player_id
        or game_state ->> 'phase' in ('gameover', 'victory')
      )
  ) then
    raise exception 'お題を確認できるのは被害者のみです。' using errcode = '42501';
  end if;

  select secret_answer into v_secret from public.room_secrets where room_id = p_room_id;
  return v_secret;
end;
$$;

-- 被害者がお題確認を終えたら Phase 2（victim_hint）へ進める
create or replace function public.confirm_secret_checked(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  update public.rooms
  set game_state = jsonb_set(game_state, '{phase}', '"victim_hint"')
  where id = p_room_id
    and status = 'playing'
    and victim_player_id = p_player_id
    and game_state ->> 'phase' = 'secret_check';
end;
$$;

drop function if exists public.submit_initial_hints(uuid, uuid, text, jsonb);

-- ---------------------------------------------------------------------------
-- Phase 3〜4 / 2ターン目以降
-- ローカル版 useGameState.tsx の reducer（TOGGLE_CARD_SELECTION / RESOLVE_DEDUCTION /
-- DISMISS_RESULT / SUBMIT_HINT）と同じ規則をサーバー側で適用する。
-- 定数は src/hooks/useGameState.tsx・src/utils/victimHintFlow.ts と揃えること:
--   DEDUCTION_SELECTION_COUNT = 6 / MAX_EXPLORATION = 4 / MAX_HINTS_PER_CATEGORY = 2
-- ---------------------------------------------------------------------------

create or replace function public.jsonb_text_array(p_value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array(select jsonb_array_elements_text(coalesce(p_value, '[]'::jsonb))), '{}');
$$;

-- gameLogic.ts の checkVictory と同じ判定：残り3枚が各カテゴリ1枚ずつで、すべて正解
create or replace function public.is_online_victory(p_board jsonb, p_excluded text[], p_secret jsonb)
returns boolean
language sql
immutable
as $$
  select count(*) = 3
    and count(*) filter (
      where c ->> 'category' = 'occupation' and c ->> 'id' = p_secret -> 'occupation' ->> 'id'
    ) = 1
    and count(*) filter (
      where c ->> 'category' = 'weapon' and c ->> 'id' = p_secret -> 'weapon' ->> 'id'
    ) = 1
    and count(*) filter (
      where c ->> 'category' = 'motive' and c ->> 'id' = p_secret -> 'motive' ->> 'id'
    ) = 1
  from jsonb_array_elements(p_board) c
  where not ((c ->> 'id') = any (p_excluded));
$$;

revoke all on function public.is_online_victory(jsonb, text[], jsonb) from public, anon, authenticated;

-- 探偵が除外候補カードを選択／解除する（選択状態は全員に同期される）
create or replace function public.toggle_deduction_card(
  p_room_id uuid,
  p_player_id uuid,
  p_token text,
  p_card_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_state jsonb;
  v_selected text[];
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status is distinct from 'playing' or v_room.victim_player_id = p_player_id then
    raise exception 'カードを選択できるのは探偵のみです。' using errcode = '42501';
  end if;

  v_state := v_room.game_state;
  if v_state ->> 'phase' is distinct from 'deduction' then
    raise exception '現在はカードを選択できるフェーズではありません。';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_state -> 'boardCards') c where c ->> 'id' = p_card_id
  ) or p_card_id = any (public.jsonb_text_array(v_state -> 'excludedCardIds')) then
    raise exception '選択できないカードです。';
  end if;

  v_selected := public.jsonb_text_array(v_state -> 'selectedCardsForRemoval');
  if p_card_id = any (v_selected) then
    v_selected := array_remove(v_selected, p_card_id);
  elsif cardinality(v_selected) >= 6 then
    -- ローカル版と同様、7枚目は無視する
    return;
  else
    v_selected := v_selected || p_card_id;
  end if;

  update public.rooms
  set game_state = v_state || jsonb_build_object('selectedCardsForRemoval', to_jsonb(v_selected))
  where id = p_room_id;
end;
$$;

create or replace function public.clear_deduction_selection(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  update public.rooms
  set game_state = game_state || jsonb_build_object('selectedCardsForRemoval', '[]'::jsonb)
  where id = p_room_id
    and status = 'playing'
    and victim_player_id is distinct from p_player_id
    and game_state ->> 'phase' = 'deduction';
end;
$$;

-- 探偵が選んだ6枚で推理を確定し、成功／失敗（パターンA）と勝敗を判定する
create or replace function public.resolve_deduction(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_state jsonb;
  v_secret jsonb;
  v_selected text[];
  v_excluded text[];
  v_has_hit boolean;
  v_history jsonb;
  v_counter int;
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status is distinct from 'playing' or v_room.victim_player_id = p_player_id then
    raise exception '推理を確定できるのは探偵のみです。' using errcode = '42501';
  end if;

  v_state := v_room.game_state;
  if v_state ->> 'phase' is distinct from 'deduction' then
    raise exception '現在は推理を確定できるフェーズではありません。';
  end if;

  v_selected := public.jsonb_text_array(v_state -> 'selectedCardsForRemoval');
  if cardinality(v_selected) <> 6 then
    raise exception 'カードをちょうど6枚選択してください。';
  end if;

  select secret_answer into v_secret from public.room_secrets where room_id = p_room_id;
  if v_secret is null then
    raise exception 'お題が見つかりません。';
  end if;

  v_has_hit := v_selected && array[
    v_secret -> 'occupation' ->> 'id',
    v_secret -> 'weapon' ->> 'id',
    v_secret -> 'motive' ->> 'id'
  ];

  -- deductionHistory.ts の createDeductionHistoryEntry と同じ形式
  v_history := coalesce(v_state -> 'deductionHistory', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'roundIndex', jsonb_array_length(coalesce(v_state -> 'deductionHistory', '[]'::jsonb)) + 1,
      'selectedCards', (
        select coalesce(jsonb_agg(c order by array_position(v_selected, c ->> 'id')), '[]'::jsonb)
        from jsonb_array_elements(v_state -> 'boardCards') c
        where (c ->> 'id') = any (v_selected)
      ),
      'outcome', case when v_has_hit then 'failure' else 'success' end
    )
  );

  v_state := v_state || jsonb_build_object(
    'selectedCardsForRemoval', '[]'::jsonb,
    'deductionHistory', v_history
  );
  v_counter := coalesce((v_state ->> 'explorationCounter')::int, 1);

  if v_has_hit then
    -- パターンA：選んだ6枚は除外せず場に残し、探索カウンタを +1
    if v_counter >= 4 then
      v_state := v_state || jsonb_build_object('phase', 'gameover', 'roundResult', null);
    else
      v_state := v_state || jsonb_build_object(
        'phase', 'result',
        'explorationCounter', v_counter + 1,
        'roundResult', jsonb_build_object('outcome', 'failure', 'failsRemaining', 4 - (v_counter + 1))
      );
    end if;
  else
    v_excluded := public.jsonb_text_array(v_state -> 'excludedCardIds') || v_selected;
    v_state := v_state || jsonb_build_object('excludedCardIds', to_jsonb(v_excluded));
    if public.is_online_victory(v_state -> 'boardCards', v_excluded, v_secret) then
      v_state := v_state || jsonb_build_object('phase', 'victory', 'roundResult', null);
    else
      v_state := v_state || jsonb_build_object(
        'phase', 'result',
        'roundResult', jsonb_build_object('outcome', 'success')
      );
    end if;
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- 結果ダイアログの「続ける」：手札を A・B 1枚ずつ補充し、次の被害者ターンへ進める（誰が押してもよい）
create or replace function public.dismiss_round_result(p_room_id uuid, p_player_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_state jsonb;
  v_secret jsonb;
  v_pool jsonb;
  v_hand jsonb;
  v_unavailable text[];
  v_group text;
  v_card jsonb;
  v_can_submit_hint boolean;
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  v_state := v_room.game_state;
  -- 複数人がほぼ同時に押した場合、2回目以降は何もしない
  if v_room.status is distinct from 'playing'
    or v_state ->> 'phase' is distinct from 'result'
    or coalesce(jsonb_typeof(v_state -> 'roundResult'), 'null') = 'null' then
    return;
  end if;

  select secret_answer, hint_pool into v_secret, v_pool
    from public.room_secrets where room_id = p_room_id;

  if public.is_online_victory(
    v_state -> 'boardCards',
    public.jsonb_text_array(v_state -> 'excludedCardIds'),
    v_secret
  ) then
    update public.rooms
    set game_state = v_state || jsonb_build_object('phase', 'victory', 'roundResult', null)
    where id = p_room_id;
    return;
  end if;

  -- hintRefill.ts の refillVictimHintHand と同じ：使用済み・手札にあるカードを除いて A・B を1枚ずつ
  v_hand := coalesce(v_state -> 'victimHintHand', '[]'::jsonb);
  v_unavailable := public.jsonb_text_array(v_state -> 'usedHintCardIds')
    || array(select h ->> 'id' from jsonb_array_elements(v_hand) h);
  foreach v_group in array array['A', 'B'] loop
    select c into v_card
      from jsonb_array_elements(coalesce(v_pool, '[]'::jsonb)) c
      where c ->> 'group' = v_group and not ((c ->> 'id') = any (v_unavailable))
      order by random()
      limit 1;
    if v_card is not null then
      v_hand := v_hand || jsonb_build_array(v_card);
      v_unavailable := v_unavailable || (v_card ->> 'id');
    end if;
  end loop;

  -- victimHintFlow.ts の hasAvailableHintCategory と同じ
  v_can_submit_hint := exists (
    select 1 from unnest(array['occupation', 'weapon', 'motive']) k
    where jsonb_array_length(coalesce(v_state -> 'hintMessagesByCategory' -> k, '[]'::jsonb)) < 2
  );

  if v_can_submit_hint then
    v_state := v_state || jsonb_build_object(
      'phase', 'victim_hint',
      'roundResult', null,
      'victimHintHand', v_hand,
      'victimTurnSkipNotice', null
    );
  else
    v_state := v_state || jsonb_build_object(
      'phase', 'deduction',
      'roundResult', null,
      'victimHintHand', v_hand,
      'victimTurnSkipNotice',
      'すべてのカテゴリにヒントが2組出揃いました。被害者ターンをスキップし、探偵ターンへ進みます。',
      'selectedCardsForRemoval', '[]'::jsonb
    );
  end if;

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

-- 被害者のヒント提出（Phase 2）。ローカル版 reducer の SUBMIT_HINT と同じ規則で1組ずつ受け付ける
--   初回ターン：まだヒントの無いカテゴリに1組設置。3カテゴリそろった時点で Phase 3 へ
--   2ターン目以降：ヒントが2組未満のカテゴリに1組だけ追加し、Phase 3 へ
-- p_hint: { "targetCategory": "weapon", "hintCardAId": "...", "hintCardBId": "..." }
drop function if exists public.submit_additional_hint(uuid, uuid, text, jsonb);

create or replace function public.submit_victim_hint(
  p_room_id uuid,
  p_player_id uuid,
  p_token text,
  p_hint jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_state jsonb;
  v_hand jsonb;
  v_category text := p_hint ->> 'targetCategory';
  v_messages jsonb;
  v_card_a jsonb;
  v_card_b jsonb;
  v_used_ids text[];
  v_initial boolean;
  v_next_phase text;
begin
  if not public.is_room_member(p_room_id, p_player_id, p_token) then
    raise exception 'プレイヤー認証に失敗しました。' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status is distinct from 'playing'
    or v_room.victim_player_id is distinct from p_player_id then
    raise exception 'ヒントを提出できるのは被害者のみです。' using errcode = '42501';
  end if;

  v_state := v_room.game_state;
  if v_state ->> 'phase' is distinct from 'victim_hint' then
    raise exception '現在はヒントを提出できるフェーズではありません。';
  end if;
  if v_category is null or v_category not in ('occupation', 'weapon', 'motive') then
    raise exception 'ヒントを設置するカテゴリを指定してください。';
  end if;

  v_initial := not coalesce((v_state ->> 'initialHintsComplete')::boolean, false);
  v_messages := coalesce(
    v_state -> 'hintMessagesByCategory',
    '{"occupation": [], "weapon": [], "motive": []}'::jsonb
  );
  if v_initial and jsonb_array_length(coalesce(v_messages -> v_category, '[]'::jsonb)) >= 1 then
    raise exception '初回は各カテゴリに1組ずつ。すでに設置済みの行は選べません。';
  end if;
  if jsonb_array_length(coalesce(v_messages -> v_category, '[]'::jsonb)) >= 2 then
    raise exception 'このカテゴリはすでにヒントが2個提出されています。';
  end if;

  v_hand := coalesce(v_state -> 'victimHintHand', '[]'::jsonb);
  select c into v_card_a from jsonb_array_elements(v_hand) c
    where c ->> 'id' = p_hint ->> 'hintCardAId' and c ->> 'group' = 'A';
  select c into v_card_b from jsonb_array_elements(v_hand) c
    where c ->> 'id' = p_hint ->> 'hintCardBId' and c ->> 'group' = 'B';
  if v_card_a is null or v_card_b is null then
    raise exception '手札にないヒントカードが指定されています（A群・B群から1枚ずつ選んでください）。';
  end if;
  v_used_ids := array[v_card_a ->> 'id', v_card_b ->> 'id'];

  v_messages := jsonb_set(
    v_messages,
    array[v_category],
    coalesce(v_messages -> v_category, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('targetCategory', v_category, 'hintCardA', v_card_a, 'hintCardB', v_card_b)
    )
  );

  -- 初回は3カテゴリすべてに1組以上そろうまで被害者ターンを続ける
  v_next_phase := case
    when v_initial and exists (
      select 1 from unnest(array['occupation', 'weapon', 'motive']) cat
      where jsonb_array_length(coalesce(v_messages -> cat, '[]'::jsonb)) = 0
    ) then 'victim_hint'
    else 'deduction'
  end;

  v_state := v_state || jsonb_build_object(
    'hintMessagesByCategory', v_messages,
    'victimHintHand', (
      select coalesce(jsonb_agg(c order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_hand) with ordinality as t(c, ord)
      where not ((c ->> 'id') = any (v_used_ids))
    ),
    'usedHintCardIds', coalesce(v_state -> 'usedHintCardIds', '[]'::jsonb) || to_jsonb(v_used_ids),
    'initialHintsComplete', v_next_phase = 'deduction',
    'selectedCardsForRemoval', '[]'::jsonb,
    'victimTurnSkipNotice', null,
    'phase', v_next_phase
  );

  update public.rooms set game_state = v_state where id = p_room_id;
end;
$$;

grant execute on function public.start_online_game(uuid, uuid, text, uuid, jsonb, jsonb) to anon;
grant execute on function public.get_room_secret(uuid, uuid, text) to anon;
grant execute on function public.confirm_secret_checked(uuid, uuid, text) to anon;
grant execute on function public.toggle_deduction_card(uuid, uuid, text, text) to anon;
grant execute on function public.clear_deduction_selection(uuid, uuid, text) to anon;
grant execute on function public.resolve_deduction(uuid, uuid, text) to anon;
grant execute on function public.dismiss_round_result(uuid, uuid, text) to anon;
grant execute on function public.submit_victim_hint(uuid, uuid, text, jsonb) to anon;
