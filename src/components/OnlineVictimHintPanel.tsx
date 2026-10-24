import { useMemo, useState } from 'react'
import type { CardCategory } from '../types/game'
import type { OnlineGameState, RoomSession } from '../types/online'
import { submitVictimHint } from '../utils/roomService'
import {
  countInitialHintsRemaining,
  MAX_HINTS_PER_CATEGORY,
  splitVictimHintHand,
} from '../utils/victimHintFlow'
import { DeductionHistoryList } from './DeductionHistoryList'
import { CATEGORY_ORDER, HintChip } from './MainGameScreen'
import './main-game-screen.css'
import './online-screen.css'

const CATEGORY_LABEL: Record<CardCategory, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

interface OnlineVictimHintPanelProps {
  session: RoomSession
  gameState: OnlineGameState
}

/**
 * 被害者のヒント作成（ローカル版 VictimHintPanel と同じ1組ずつの提出方式）。
 * 初回ターンは未設置の行に1組ずつ設置し、3行そろうと Phase 3 へ進む。
 * 2ターン目以降はヒントが2組未満の行に1組だけ追加する。
 */
export function OnlineVictimHintPanel({ session, gameState }: OnlineVictimHintPanelProps) {
  const [preferredCategory, setPreferredCategory] = useState<CardCategory>('occupation')
  const [hintAId, setHintAId] = useState<string | null>(null)
  const [hintBId, setHintBId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { hintMessagesByCategory } = gameState
  const isInitialHintPhase = !gameState.initialHintsComplete
  const { hintA, hintB } = useMemo(
    () => splitVictimHintHand(gameState.victimHintHand),
    [gameState.victimHintHand],
  )
  const initialCategoriesRemaining = countInitialHintsRemaining(hintMessagesByCategory)

  const hintCount = (cat: CardCategory) => hintMessagesByCategory[cat].length
  const isCategoryAtLimit = (cat: CardCategory) => hintCount(cat) >= MAX_HINTS_PER_CATEGORY
  const isCategoryDisabled = (cat: CardCategory) =>
    isInitialHintPhase ? hintCount(cat) >= 1 : isCategoryAtLimit(cat)

  const targetCategory = isCategoryDisabled(preferredCategory)
    ? (CATEGORY_ORDER.find((cat) => !isCategoryDisabled(cat)) ?? preferredCategory)
    : preferredCategory

  const submit = async () => {
    if (isCategoryDisabled(targetCategory)) {
      setError(
        isInitialHintPhase
          ? '初回は各カテゴリに1組ずつ。すでに設置済みの行は選べません。'
          : 'このカテゴリはすでにヒントが2個提出されています。',
      )
      return
    }
    if (!hintAId || !hintBId) {
      setError('A群・B群からそれぞれ1枚ずつ選んでください。')
      return
    }
    setPending(true)
    setError(null)
    try {
      await submitVictimHint(session, { targetCategory, hintCardAId: hintAId, hintCardBId: hintBId })
      setHintAId(null)
      setHintBId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ヒントの提出に失敗しました。')
    } finally {
      setPending(false)
    }
  }

  const submitLabel = pending
    ? '提出中…'
    : isInitialHintPhase
      ? initialCategoriesRemaining <= 1
        ? '設置して探偵ターンへ（Phase 3）'
        : `このカテゴリにヒントを設置（残り${initialCategoriesRemaining}）`
      : 'ヒントを提出する（Phase 3へ）'

  return (
    <>
      <h2>被害者：ヒント作成</h2>
      <p className="main-game__initial-hint-note">
        {isInitialHintPhase ? (
          <>
            初回ターン：職業・凶器・動機の<strong>3行すべて</strong>に1組ずつ（A群1枚＋B群1枚）設置してください。1組ずつ提出でき、設置したヒントはすぐに探偵の画面に表示されます（残り
            {initialCategoriesRemaining}カテゴリ）。
          </>
        ) : (
          <>
            手札にA群・B群が1枚ずつ補充されました。ヒントが2組に達していない行を1つ選び、
            <strong>1組だけ</strong>追加してください。
          </>
        )}
      </p>
      <section>
        <label>ターゲット（ヒントを設置する行）</label>
        <div className="main-game__radio-row">
          {CATEGORY_ORDER.map((cat) => {
            const disabled = isCategoryDisabled(cat)
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
                  onChange={() => setPreferredCategory(cat)}
                />
                {CATEGORY_LABEL[cat]}
                {isInitialHintPhase && disabled && (
                  <span className="main-game__radio-limit-note">（初回設置済み）</span>
                )}
                {!isInitialHintPhase && disabled && (
                  <span className="main-game__radio-limit-note">（上限2個に達しました）</span>
                )}
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
        disabled={pending || hintA.length === 0 || hintB.length === 0 || isCategoryDisabled(targetCategory)}
      >
        {submitLabel}
      </button>
      <DeductionHistoryList history={gameState.deductionHistory} titleId="online-history-victim" />
    </>
  )
}
