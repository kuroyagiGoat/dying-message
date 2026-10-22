import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import type { CardCategory, SecretAnswer } from '../types/game'
import type { Room, RoomPlayer, RoomSession } from '../types/online'
import {
  buildHintCardPool,
  buildInitialOnlineGameState,
  resolveVictimPlayerId,
} from './onlineGameSetup'
import type { StoredOnlineSession } from './onlineSessionStore'

export const ROOM_CODE_PATTERN = /^[0-9]{4}$/
export const MAX_PLAYER_NAME_LENGTH = 20
export const MIN_ONLINE_PLAYERS = 2
const MAX_CREATE_ATTEMPTS = 10
const UNIQUE_VIOLATION = '23505'
const PLAYER_COLUMNS = 'id, room_id, name, is_host, joined_at'

export class RoomError extends Error {}

export function generateRoomCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  return value.toString().padStart(4, '0')
}

function toRoomError(error: PostgrestError, fallback: string): RoomError {
  console.error(error)
  return new RoomError(`${fallback}（${error.message}）`)
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function authParams(session: RoomSession) {
  return {
    p_room_id: session.room.id,
    p_player_id: session.self.id,
    p_token: session.token,
  }
}

export function validatePlayerName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new RoomError('プレイヤー名を入力してください。')
  }
  if (trimmed.length > MAX_PLAYER_NAME_LENGTH) {
    throw new RoomError(`プレイヤー名は${MAX_PLAYER_NAME_LENGTH}文字以内で入力してください。`)
  }
  return trimmed
}

async function insertPlayer(
  room: Room,
  playerId: string,
  name: string,
  isHost: boolean,
): Promise<{ self: RoomPlayer | null; token: string; error: PostgrestError | null }> {
  const token = crypto.randomUUID()
  const { data, error } = await getSupabase()
    .from('room_players')
    .insert({
      id: playerId,
      room_id: room.id,
      name,
      is_host: isHost,
      token_hash: await hashToken(token),
    })
    .select(PLAYER_COLUMNS)
    .single<RoomPlayer>()
  return { self: data, token, error }
}

export async function createRoom(hostName: string): Promise<RoomSession> {
  const supabase = getSupabase()
  const name = validatePlayerName(hostName)
  const hostPlayerId = crypto.randomUUID()

  let room: Room | null = null
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS && !room; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code: generateRoomCode(), host_player_id: hostPlayerId })
      .select()
      .single<Room>()
    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue
      throw toRoomError(error, '部屋の作成に失敗しました。')
    }
    room = data
  }
  if (!room) {
    throw new RoomError('空いているルームコードが見つかりませんでした。時間をおいて再度お試しください。')
  }

  const { self, token, error: playerError } = await insertPlayer(room, hostPlayerId, name, true)
  if (playerError || !self) {
    await supabase.from('rooms').delete().eq('id', room.id)
    throw toRoomError(playerError!, 'ホストの登録に失敗しました。')
  }

  return { room, self, token }
}

export async function joinRoom(code: string, playerName: string): Promise<RoomSession> {
  const supabase = getSupabase()
  const name = validatePlayerName(playerName)
  const normalizedCode = code.trim()
  if (!ROOM_CODE_PATTERN.test(normalizedCode)) {
    throw new RoomError('ルームコードは4桁の数字で入力してください。')
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select()
    .eq('code', normalizedCode)
    .neq('status', 'closed')
    .maybeSingle<Room>()
  if (roomError) {
    throw toRoomError(roomError, '部屋の検索に失敗しました。')
  }
  if (!room) {
    throw new RoomError('そのルームコードの部屋は見つかりませんでした。')
  }
  if (room.status !== 'waiting') {
    throw new RoomError('その部屋はすでにゲームを開始しています。')
  }

  const { self, token, error: playerError } = await insertPlayer(
    room,
    crypto.randomUUID(),
    name,
    false,
  )
  if (playerError || !self) {
    if (playerError?.code === UNIQUE_VIOLATION) {
      throw new RoomError('同じ名前のプレイヤーが既に参加しています。別の名前を入力してください。')
    }
    throw toRoomError(playerError!, '部屋への参加に失敗しました。')
  }

  return { room, self, token }
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data, error } = await getSupabase()
    .from('rooms')
    .select()
    .eq('id', roomId)
    .single<Room>()
  if (error) {
    throw toRoomError(error, '部屋情報の取得に失敗しました。')
  }
  return data
}

export async function fetchRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
  const { data, error } = await getSupabase()
    .from('room_players')
    .select(PLAYER_COLUMNS)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
  if (error) {
    throw toRoomError(error, '参加者一覧の取得に失敗しました。')
  }
  return data as RoomPlayer[]
}

/**
 * 保存済みセッションから再接続する。
 * 部屋が無い・解散済み・プレイヤーが退出済み・トークン不一致のときは null（復元不可）。
 * 通信エラーは RoomError を投げる（セッションは消さずに再試行できるようにする）。
 */
export async function restoreRoomSession(stored: StoredOnlineSession): Promise<RoomSession | null> {
  const supabase = getSupabase()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select()
    .eq('id', stored.roomId)
    .maybeSingle<Room>()
  if (roomError) throw toRoomError(roomError, '部屋情報の取得に失敗しました。')
  if (!room || room.status === 'closed') return null

  const { data: player, error: playerError } = await supabase
    .from('room_players')
    .select(`${PLAYER_COLUMNS}, token_hash`)
    .eq('id', stored.playerId)
    .eq('room_id', stored.roomId)
    .maybeSingle<RoomPlayer & { token_hash: string | null }>()
  if (playerError) throw toRoomError(playerError, 'プレイヤー情報の取得に失敗しました。')
  if (!player || player.token_hash !== (await hashToken(stored.token))) return null

  const { token_hash: _tokenHash, ...self } = player
  return { room, self, token: stored.token }
}

/** ホスト専用：役職と場札・手札を確定し、rooms.status を playing に更新する */
export async function startOnlineGame(
  session: RoomSession,
  players: RoomPlayer[],
  preferredVictimId: string | null,
): Promise<void> {
  if (!session.self.is_host) {
    throw new RoomError('ゲームを開始できるのはホストのみです。')
  }
  if (players.length < MIN_ONLINE_PLAYERS) {
    throw new RoomError(`プレイヤーは${MIN_ONLINE_PLAYERS}名以上必要です。`)
  }

  const { error } = await getSupabase().rpc('start_online_game', {
    ...authParams(session),
    p_victim_player_id: resolveVictimPlayerId(players, preferredVictimId),
    p_game_state: buildInitialOnlineGameState(),
    p_hint_pool: buildHintCardPool(),
  })
  if (error) throw toRoomError(error, 'ゲームの開始に失敗しました。')
}

/** 被害者専用：正解（お題）を取得する */
export async function fetchRoomSecret(session: RoomSession): Promise<SecretAnswer> {
  const { data, error } = await getSupabase().rpc('get_room_secret', authParams(session))
  if (error) throw toRoomError(error, 'お題の取得に失敗しました。')
  if (!data) throw new RoomError('お題がまだ決まっていません。')
  return data as SecretAnswer
}

/** 被害者専用：お題確認を終えて Phase 2 へ進める */
export async function confirmSecretChecked(session: RoomSession): Promise<void> {
  const { error } = await getSupabase().rpc('confirm_secret_checked', authParams(session))
  if (error) throw toRoomError(error, 'フェーズの更新に失敗しました。')
}

export interface HintSelection {
  targetCategory: CardCategory
  hintCardAId: string
  hintCardBId: string
}

/** 被害者専用：3カテゴリ分の初回ヒントを提出し、Phase 3（deduction）へ進める */
export async function submitInitialHints(
  session: RoomSession,
  hints: HintSelection[],
): Promise<void> {
  const { error } = await getSupabase().rpc('submit_initial_hints', {
    ...authParams(session),
    p_hints: hints,
  })
  if (error) throw toRoomError(error, 'ヒントの提出に失敗しました。')
}

/** 被害者専用：2ターン目以降、ヒントが2組未満のカテゴリに1組だけ追加する */
export async function submitAdditionalHint(
  session: RoomSession,
  hint: HintSelection,
): Promise<void> {
  const { error } = await getSupabase().rpc('submit_additional_hint', {
    ...authParams(session),
    p_hint: hint,
  })
  if (error) throw toRoomError(error, 'ヒントの提出に失敗しました。')
}

/** 探偵専用：除外候補カードの選択／解除（全員に同期される） */
export async function toggleDeductionCard(session: RoomSession, cardId: string): Promise<void> {
  const { error } = await getSupabase().rpc('toggle_deduction_card', {
    ...authParams(session),
    p_card_id: cardId,
  })
  if (error) throw toRoomError(error, 'カードの選択に失敗しました。')
}

export async function clearDeductionSelection(session: RoomSession): Promise<void> {
  const { error } = await getSupabase().rpc('clear_deduction_selection', authParams(session))
  if (error) throw toRoomError(error, '選択のクリアに失敗しました。')
}

/** 探偵専用：選択中の6枚で推理を確定する（判定はサーバー側で正解と照合） */
export async function resolveDeduction(session: RoomSession): Promise<void> {
  const { error } = await getSupabase().rpc('resolve_deduction', authParams(session))
  if (error) throw toRoomError(error, '推理の確定に失敗しました。')
}

/** 結果ダイアログを閉じて次のターンへ進める（手札補充はサーバー側で行う） */
export async function dismissRoundResult(session: RoomSession): Promise<void> {
  const { error } = await getSupabase().rpc('dismiss_round_result', authParams(session))
  if (error) throw toRoomError(error, '次のターンへの移行に失敗しました。')
}

export async function leaveRoom(session: RoomSession): Promise<void> {
  const supabase = getSupabase()
  if (session.self.is_host) {
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', session.room.id)
    if (error) throw toRoomError(error, '部屋の解散に失敗しました。')
  }
  const { error } = await supabase.from('room_players').delete().eq('id', session.self.id)
  if (error) throw toRoomError(error, '部屋からの退出に失敗しました。')
}
