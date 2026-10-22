import { useMemo, useState } from 'react'
import type { CardCategory, HintCard } from '../types/game'
import type { OnlineGameState, RoomSession } from '../types/online'
import { submitAdditionalHint, submitInitialHints } from '../utils/roomService'
import { MAX_HINTS_PER_CATEGORY, splitVictimHintHand } from '../utils/victimHintFlow'
import { DeductionHistoryList } from './DeductionHistoryList'
import { CATEGORY_ORDER, HintChip } from './MainGameScreen'
import './main-game-screen.css'
import './online-screen.css'

const CATEGORY_LABEL: Record<CardCategory, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

type DraftField = 'hintCardAId' | 'hintCardBId'

interface Draft {
  hintCardAId: string | null
  hintCardBId: string | null
}

const EMPTY_DRAFTS: Record<CardCategory, Draft> = {
  occupation: { hintCardAId: null, hintCardBId: null },
  weapon: { hintCardAId: null, hintCardBId: null },
  motive: { hintCardAId: null, hintCardBId: null },
}

function isDraftComplete(draft: Draft): boolean {
  return draft.hintCardAId !== null && draft.hintCardBId !== null
}

interface OnlineVictimHintPanelProps {
  session: RoomSession
  gameState: OnlineGameState
}

export function OnlineVictimHintPanel(props: OnlineVictimHintPanelProps) {
  return props.gameState.initialHintsComplete ? (
    <OnlineAdditionalHintPanel {...props} />
  ) : (
    <OnlineInitialHintPanel {...props} />
  )
}

/** 2ターン目以降：ヒントが2組未満のカテゴリを1つ選び、1組だけ追加提出する */
function OnlineAdditionalHintPanel({ session, gameState }: OnlineVictimHintPanelProps) {
  const isCategoryAtLimit = (cat: CardCategory) =>
    gameState.hintMessagesByCategory[cat].length >= MAX_HINTS_PER_CATEGORY
  const [targetCategory, setTargetCategory] = useState<CardCategory>(
    () => CATEGORY_ORDER.find((cat) => !isCategoryAtLimit(cat)) ?? 'occupation',
  )
  const [hintAId, setHintAId] = useState<string | null>(null)
  const [hintBId, setHintBId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { hintA, hintB } = useMemo(
    () => splitVictimHintHand(gameState.victimHintHand),
    [gameState.victimHintHand],
  )

  const submit = async () => {
    if (isCategoryAtLimit(targetCategory)) {
      setError('このカテゴリはすでにヒントが2個提出されています。')
      return
    }
    if (!hintAId || !hintBId) {
      setError('A群・B群からそれぞれ1枚ずつ選んでください。')
      return
    }
    setPending(true)
    setError(null)
    try {
      await submitAdditionalHint(session, { targetCategory, hintCardAId: hintAId, hintCardBId: hintBId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ヒントの提出に失敗しました。')
      setPending(false)
    }
  }

  return (
    <>
      <h2>被害者：ヒント作成</h2>
      <p className="main-game__initial-hint-note">
        手札にA群・B群が1枚ずつ補充されました。ヒントが2組に達していない行を1つ選び、<strong>1組だけ</strong>追加してください。
      </p>
      <section>
        <label>ターゲット（絞り込みたい行）</label>
        <div className="main-game__radio-row">
          {CATEGORY_ORDER.map((cat) => {
            const disabled = isCategoryAtLimit(cat)
            return (
              <label
                key={cat}
                className={
                  disabled
                    ? 'main-game__radio-option main-game__radio-option--disabled'
                    : 'main-game__radio-option'
                }
              >
                <input
                  type="radio"
                  name="online-target-category"
                  checked={targetCategory === cat}
                  disabled={disabled || pending}
                  onChange={() => setTargetCategory(cat)}
                />
                {CATEGORY_LABEL[cat]}
                {disabled && <span className="main-game__radio-limit-note">（上限2個に達しました）</span>}
              </label>
            )
          })}
        </div>
      </section>
      <div className="main-game__hint-columns">
        <section className="main-game__hint-column">
          <label>ヒント A群（1枚）</label>
          <div className="main-game__hint-options">
            {hintA.map((card) => (
              <HintChip
                key={card.id}
                card={card}
                group="A"
                name="online-hint-A"
                checked={hintAId === card.id}
                onChange={() => setHintAId(card.id)}
                disabled={pending}
              />
            ))}
          </div>
        </section>
        <section className="main-game__hint-column">
          <label>ヒント B群（1枚）</label>
          <div className="main-game__hint-options">
            {hintB.map((card) => (
              <HintChip
                key={card.id}
                card={card}
                group="B"
                name="online-hint-B"
                checked={hintBId === card.id}
                onChange={() => setHintBId(card.id)}
                disabled={pending}
              />
            ))}
          </div>
        </section>
      </div>
      {error && (
        <p className="main-game__error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="main-game__btn main-game__btn--primary"
        onClick={() => void submit()}
        disabled={pending || hintA.length === 0 || hintB.length === 0}
      >
        {pending ? '提出中…' : 'ヒントを提出する（Phase 3へ）'}
      </button>
      <DeductionHistoryList history={gameState.deductionHistory} titleId="online-history-victim" />
    </>
  )
}

/** 初回ターン：3カテゴリ分のヒントを選んでまとめて提出する */
function OnlineInitialHintPanel({ session, gameState }: OnlineVictimHintPanelProps) {
  const [targetCategory, setTargetCategory] = useState<CardCategory>('occupation')
  const [drafts, setDrafts] = useState<Record<CardCategory, Draft>>(EMPTY_DRAFTS)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { hintA, hintB } = useMemo(
    () => splitVictimHintHand(gameState.victimHintHand),
    [gameState.victimHintHand],
  )
  const cardById = useMemo(
    () => new Map(gameState.victimHintHand.map((card) => [card.id, card])),
    [gameState.victimHintHand],
  )

  const current = drafts[targetCategory]
  const incompleteCategories = CATEGORY_ORDER.filter((cat) => !isDraftComplete(drafts[cat]))

  const usedInOtherCategory = (cardId: string) =>
    CATEGORY_ORDER.some(
      (cat) =>
        cat !== targetCategory &&
        (drafts[cat].hintCardAId === cardId || drafts[cat].hintCardBId === cardId),
    )

  const choose = (field: DraftField, cardId: string) => {
    setDrafts((prev) => ({ ...prev, [targetCategory]: { ...prev[targetCategory], [field]: cardId } }))
    setError(null)
  }

  const clearCurrent = () => {
    setDrafts((prev) => ({ ...prev, [targetCategory]: { hintCardAId: null, hintCardBId: null } }))
    setError(null)
  }

  const submit = async () => {
    if (incompleteCategories.length > 0) {
      setError(
        `${incompleteCategories.map((cat) => CATEGORY_LABEL[cat]).join('・')}のヒントが未選択です。A群・B群から1枚ずつ選んでください。`,
      )
      setTargetCategory(incompleteCategories[0])
      return
    }
    setPending(true)
    setError(null)
    try {
      await submitInitialHints(
        session,
        CATEGORY_ORDER.map((cat) => ({
          targetCategory: cat,
          hintCardAId: drafts[cat].hintCardAId!,
          hintCardBId: drafts[cat].hintCardBId!,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ヒントの提出に失敗しました。')
      setPending(false)
    }
  }

  const renderChips = (cards: HintCard[], group: 'A' | 'B', field: DraftField) =>
    cards.map((card) => (
      <HintChip
        key={card.id}
        card={card}
        group={group}
        name={`online-hint-${group}`}
        checked={current[field] === card.id}
        onChange={() => choose(field, card.id)}
        disabled={pending || usedInOtherCategory(card.id)}
      />
    ))

  return (
    <>
      <h2>被害者：ヒント作成</h2>
      <p className="main-game__initial-hint-note">
        初回ターン：職業・凶器・動機の<strong>3行すべて</strong>に1組ずつ（A群1枚＋B群1枚）ヒントを選び、まとめて提出してください（残り
        {incompleteCategories.length}カテゴリ）。
      </p>

      <section>
        <label>ターゲット（ヒントを設置する行）</label>
        <div className="main-game__radio-row">
          {CATEGORY_ORDER.map((cat) => (
            <label key={cat} className="main-game__radio-option">
              <input
                type="radio"
                name="online-target-category"
                checked={targetCategory === cat}
                onChange={() => setTargetCategory(cat)}
                disabled={pending}
              />
              {CATEGORY_LABEL[cat]}
              <span className="main-game__radio-limit-note">
                {isDraftComplete(drafts[cat]) ? '（選択済み）' : '（未選択）'}
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="main-game__hint-columns">
        <section className="main-game__hint-column">
          <label>ヒント A群（1枚）</label>
          <div className="main-game__hint-options">{renderChips(hintA, 'A', 'hintCardAId')}</div>
        </section>
        <section className="main-game__hint-column">
          <label>ヒント B群（1枚）</label>
          <div className="main-game__hint-options">{renderChips(hintB, 'B', 'hintCardBId')}</div>
        </section>
      </div>

      <section className="main-game__detective-hints online-game__draft-summary">
        <label>設置予定のダイイングメッセージ</label>
        {CATEGORY_ORDER.map((cat) => {
          const draft = drafts[cat]
          const cardA = draft.hintCardAId ? cardById.get(draft.hintCardAId) : undefined
          const cardB = draft.hintCardBId ? cardById.get(draft.hintCardBId) : undefined
          return (
            <div key={cat} className="main-game__detective-hints-line">
              <span className="main-game__detective-hints-label">{CATEGORY_LABEL[cat]}</span>
              <span className="main-game__hint-display main-game__hint-display--a main-game__hint-display--compact">
                {cardA?.name ?? '（A未選択）'}
              </span>
              <span className="main-game__hint-display main-game__hint-display--b main-game__hint-display--compact">
                {cardB?.name ?? '（B未選択）'}
              </span>
            </div>
          )
        })}
      </section>

      {error && (
        <p className="main-game__error" role="alert">
          {error}
        </p>
      )}

      <div className="main-game__detective-row">
        <button
          type="button"
          className="main-game__btn main-game__btn--secondary"
          onClick={clearCurrent}
          disabled={pending || (current.hintCardAId === null && current.hintCardBId === null)}
        >
          この行の選択をクリア
        </button>
        <button
          type="button"
          className="main-game__btn main-game__btn--primary"
          onClick={() => void submit()}
          disabled={pending}
        >
          {pending ? '提出中…' : 'ヒントを提出する（Phase 3へ）'}
        </button>
      </div>
    </>
  )
}
