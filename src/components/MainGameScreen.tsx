import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Card,
  CardCategory,
  DyingMessage,
  HintCard,
  RoundResult,
  SecretAnswer,
} from '../types/game'
import {
  DEDUCTION_SELECTION_COUNT,
  MAX_EXPLORATION,
  useGameState,
} from '../hooks/useGameState'
import {
  countInitialHintsRemaining,
  hasAvailableHintCategory,
  MAX_HINTS_PER_CATEGORY,
  splitVictimHintHand,
} from '../utils/victimHintFlow'
import { DeductionHistoryList } from './DeductionHistoryList'
import './main-game-screen.css'

const PHASE_LABEL: Record<string, string> = {
  victim_hint: 'Phase 2: 被害者ヒント作成',
  deduction: 'Phase 3: 探偵の推理・決定',
  result: 'Phase 4: 結果発表',
  gameover: 'ゲームオーバー',
  victory: '勝利',
}

const CATEGORY_LABEL: Record<CardCategory, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

export const CATEGORY_ORDER: CardCategory[] = ['occupation', 'weapon', 'motive']

export function groupBoardByCategory(boardCards: Card[]) {
  return {
    occupation: boardCards.filter((c) => c.category === 'occupation'),
    weapon: boardCards.filter((c) => c.category === 'weapon'),
    motive: boardCards.filter((c) => c.category === 'motive'),
  }
}

function MessageStack({ messages }: { messages: DyingMessage[] }) {
  if (messages.length === 0) {
    return null
  }

  return (
    <div className="main-game__message-slot" aria-label="ダイイングメッセージ">
      {messages.map((msg, index) => (
        <div
          key={`${msg.hintCardA.id}-${msg.hintCardB.id}-${index}`}
          className="main-game__message-pair"
        >
          <span className="main-game__hint-display main-game__hint-display--a">
            {msg.hintCardA.name}
          </span>
          <span className="main-game__hint-display main-game__hint-display--b">
            {msg.hintCardB.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export function CategoryRow({
  category,
  cards,
  messages,
  excludedIds,
  selectedIds,
  answerIds,
  selectable,
  onToggle,
}: {
  category: CardCategory
  cards: Card[]
  messages: DyingMessage[]
  excludedIds: Set<string>
  selectedIds: Set<string>
  answerIds: Set<string>
  selectable: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className="main-game__category-row">
      <div className="main-game__row-label">{CATEGORY_LABEL[category]}</div>
      <div className="main-game__row-scroll">
        <div className="main-game__row-inner">
          <div className="main-game__topic-cards">
            {cards.map((card) => {
              const excluded = excludedIds.has(card.id)
              const selected = selectedIds.has(card.id)
              const isAnswer = answerIds.has(card.id)
              const clickable = selectable && !excluded
              return (
                <button
                  key={card.id}
                  type="button"
                  className={[
                    'main-game__card',
                    excluded ? 'main-game__card--excluded' : '',
                    selected ? 'main-game__card--selected' : '',
                    isAnswer ? 'main-game__card--answer' : '',
                    clickable ? 'main-game__card--clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!clickable}
                  aria-label={isAnswer ? `${card.name}（正解）` : card.name}
                  onClick={() => onToggle(card.id)}
                >
                  {card.name}
                </button>
              )
            })}
          </div>
          <MessageStack messages={messages} />
        </div>
      </div>
    </div>
  )
}

function VictimHintPanel() {
  const { state, dispatch } = useGameState()
  const [targetCategory, setTargetCategory] = useState<CardCategory>('occupation')

  useEffect(() => {
    if (state.phase !== 'victim_hint' || !state.initialHintsComplete) {
      return
    }
    if (hasAvailableHintCategory(state.hintMessagesByCategory)) {
      return
    }
    dispatch({ type: 'SKIP_VICTIM_TURN_TO_DEDUCTION' })
  }, [
    dispatch,
    state.phase,
    state.initialHintsComplete,
    state.hintMessagesByCategory,
  ])
  const [hintAId, setHintAId] = useState<string | null>(null)
  const [hintBId, setHintBId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hintCountByCategory = useMemo(
    () => ({
      occupation: state.hintMessagesByCategory.occupation.length,
      weapon: state.hintMessagesByCategory.weapon.length,
      motive: state.hintMessagesByCategory.motive.length,
    }),
    [state.hintMessagesByCategory],
  )

  const isInitialHintPhase = !state.initialHintsComplete

  const isCategoryAtLimit = (category: CardCategory) =>
    hintCountByCategory[category] >= MAX_HINTS_PER_CATEGORY

  const isCategoryDisabled = (category: CardCategory) => {
    if (isInitialHintPhase) {
      return hintCountByCategory[category] >= 1
    }
    return isCategoryAtLimit(category)
  }

  const initialCategoriesRemaining = useMemo(
    () => countInitialHintsRemaining(state.hintMessagesByCategory),
    [state.hintMessagesByCategory],
  )

  useEffect(() => {
    if (!isCategoryDisabled(targetCategory)) {
      return
    }
    const available = CATEGORY_ORDER.find((cat) => !isCategoryDisabled(cat))
    if (available) {
      setTargetCategory(available)
    }
  }, [targetCategory, hintCountByCategory, isInitialHintPhase])

  const hintAOptions = state.victimHintHand.filter((c) => c.group === 'A')
  const hintBOptions = state.victimHintHand.filter((c) => c.group === 'B')

  const submitHint = () => {
    if (isInitialHintPhase && hintCountByCategory[targetCategory] >= 1) {
      setError('初回は各カテゴリに1組ずつ。すでに設置済みの行は選べません。')
      return
    }
    if (!isInitialHintPhase && isCategoryAtLimit(targetCategory)) {
      setError('このカテゴリはすでにヒントが2個提出されています。')
      return
    }
    if (!hintAId || !hintBId) {
      setError('A群・B群からそれぞれ1枚ずつ選んでください。')
      return
    }
    const hintCardA = state.victimHintHand.find((c) => c.id === hintAId)
    const hintCardB = state.victimHintHand.find((c) => c.id === hintBId)
    if (!hintCardA || !hintCardB) {
      setError('選択したヒントカードが見つかりません。')
      return
    }
    dispatch({
      type: 'SUBMIT_HINT',
      message: { targetCategory, hintCardA, hintCardB },
    })
    setHintAId(null)
    setHintBId(null)
    setError(null)
  }

  return (
    <>
      <h2>被害者：ヒント作成</h2>
      {isInitialHintPhase && (
        <p className="main-game__initial-hint-note">
          初回ターン：職業・凶器・動機の<strong>3行すべて</strong>に1組ずつ設置してください（残り
          {initialCategoriesRemaining}カテゴリ）。
        </p>
      )}
      <section>
        <label>ターゲット（絞り込みたい行）</label>
        <div className="main-game__radio-row">
          {CATEGORY_ORDER.map((cat) => {
            const disabled = isCategoryDisabled(cat)
            const initialDone = isInitialHintPhase && hintCountByCategory[cat] >= 1
            return (
              <label
                key={cat}
                className={
                  disabled ? 'main-game__radio-option main-game__radio-option--disabled' : 'main-game__radio-option'
                }
              >
                <input
                  type="radio"
                  name="target-category"
                  checked={targetCategory === cat}
                  disabled={disabled}
                  onChange={() => setTargetCategory(cat)}
                />
                {CATEGORY_LABEL[cat]}
                {initialDone && (
                  <span className="main-game__radio-limit-note">（初回設置済み）</span>
                )}
                {!isInitialHintPhase && isCategoryAtLimit(cat) && (
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
            {hintAOptions.map((card) => (
              <HintChip
                key={card.id}
                card={card}
                group="A"
                name="hint-a"
                checked={hintAId === card.id}
                onChange={() => setHintAId(card.id)}
              />
            ))}
          </div>
        </section>
        <section className="main-game__hint-column">
          <label>ヒント B群（1枚）</label>
          <div className="main-game__hint-options">
            {hintBOptions.map((card) => (
              <HintChip
                key={card.id}
                card={card}
                group="B"
                name="hint-b"
                checked={hintBId === card.id}
                onChange={() => setHintBId(card.id)}
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
        onClick={submitHint}
        disabled={
          hintAOptions.length === 0 ||
          hintBOptions.length === 0 ||
          isCategoryDisabled(targetCategory)
        }
      >
        {isInitialHintPhase
          ? initialCategoriesRemaining <= 1
            ? '設置して探偵ターンへ（Phase 3）'
            : `このカテゴリにヒントを設置（残り${initialCategoriesRemaining}）`
          : 'ヒントを提出する（Phase 3へ）'}
      </button>
      <DeductionHistoryList
        history={state.deductionHistory}
        titleId="deduction-history-victim"
      />
    </>
  )
}

export function HintChip({
  card,
  group,
  name,
  checked,
  onChange,
  disabled = false,
}: {
  card: HintCard
  group: 'A' | 'B'
  name: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  const toneClass =
    group === 'A' ? 'main-game__hint-chip--a' : 'main-game__hint-chip--b'
  return (
    <label
      className={`main-game__hint-chip ${toneClass}${disabled ? ' main-game__hint-chip--disabled' : ''}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      {card.name}
    </label>
  )
}

export function DetectiveVictimHandHints({
  hintA,
  hintB,
}: {
  hintA: HintCard[]
  hintB: HintCard[]
}) {
  if (hintA.length === 0 && hintB.length === 0) {
    return (
      <p className="main-game__detective-hints-empty">
        被害者の手札に未使用のヒントカードはありません。
      </p>
    )
  }

  return (
    <div className="main-game__detective-hints">
      <div className="main-game__detective-hints-line">
        <span className="main-game__detective-hints-label">ヒントA</span>
        {hintA.map((card) => (
          <span
            key={card.id}
            className="main-game__hint-display main-game__hint-display--a main-game__hint-display--compact"
          >
            {card.name}
          </span>
        ))}
      </div>
      <div className="main-game__detective-hints-line">
        <span className="main-game__detective-hints-label">ヒントB</span>
        {hintB.map((card) => (
          <span
            key={card.id}
            className="main-game__hint-display main-game__hint-display--b main-game__hint-display--compact"
          >
            {card.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function DetectivePanel() {
  const { state, dispatch } = useGameState()
  const selectedCount = state.selectedCardsForRemoval.length

  const victimHandByGroup = useMemo(
    () => splitVictimHintHand(state.victimHintHand),
    [state.victimHintHand],
  )

  if (state.phase !== 'deduction' && state.phase !== 'result') {
    return null
  }

  return (
    <>
      <h2>探偵：6枚選択・決定</h2>
      <div className="main-game__detective-row">
        <p className="main-game__selection-count">
          選択中: {selectedCount}/{DEDUCTION_SELECTION_COUNT} 枚
        </p>
        {state.phase === 'deduction' && (
          <DetectiveVictimHandHints
            hintA={victimHandByGroup.hintA}
            hintB={victimHandByGroup.hintB}
          />
        )}
        <button
          type="button"
          className="main-game__btn main-game__btn--secondary"
          onClick={() => dispatch({ type: 'CLEAR_CARD_SELECTION' })}
          disabled={selectedCount === 0 || state.phase === 'result'}
        >
          選択をクリア
        </button>
        <button
          type="button"
          className="main-game__btn main-game__btn--primary"
          disabled={
            state.phase !== 'deduction' ||
            selectedCount !== DEDUCTION_SELECTION_COUNT
          }
          onClick={() => dispatch({ type: 'RESOLVE_DEDUCTION' })}
        >
          この6枚を除外する
        </button>
      </div>
      <DeductionHistoryList
        history={state.deductionHistory}
        title="過去の推理履歴"
        titleId="deduction-history-detective"
      />
    </>
  )
}

export function VictimTurnSkipNoticeDialogView({
  notice,
  onDismiss,
}: {
  notice: string
  onDismiss: () => void
}) {
  return (
    <div className="main-game__dialog-overlay" role="dialog" aria-modal="true">
      <div className="main-game__dialog">
        <h3>被害者ターンをスキップ</h3>
        <p>{notice}</p>
        <button
          type="button"
          className="main-game__btn main-game__btn--primary"
          onClick={onDismiss}
        >
          探偵ターンへ
        </button>
      </div>
    </div>
  )
}

function VictimTurnSkipNoticeDialog() {
  const { state, dispatch } = useGameState()

  if (state.phase !== 'deduction' || !state.victimTurnSkipNotice) {
    return null
  }

  return (
    <VictimTurnSkipNoticeDialogView
      notice={state.victimTurnSkipNotice}
      onDismiss={() => dispatch({ type: 'DISMISS_VICTIM_TURN_SKIP_NOTICE' })}
    />
  )
}

export function RoundResultDialogView({
  result,
  explorationCounter,
  onContinue,
  continueDisabled = false,
  footnote,
}: {
  result: RoundResult
  explorationCounter: number
  onContinue: () => void
  continueDisabled?: boolean
  footnote?: ReactNode
}) {
  const title =
    result.outcome === 'success' ? '真実への接近！' : '捜査の迷走…'
  const body =
    result.outcome === 'success'
      ? '探偵たちの鋭い推理により、6つの容疑（カード）が晴れた。被害者の残した手がかりからさらに絞り込もう。'
      : explorationCounter >= MAX_EXPLORATION
      ? `探偵たちの推理は的外れだったようだ。探索カウンタが最大（${MAX_EXPLORATION}）に達した。次の推理失敗でゲームオーバーとなる。`
      : `探偵たちの推理は的外れだったようだ。探索カウンタが1増えた（現在 ${explorationCounter}/${MAX_EXPLORATION}）。`

  return (
    <div className="main-game__dialog-overlay" role="dialog" aria-modal="true">
      <div className="main-game__dialog">
        <h3>{title}</h3>
        <p>{body}</p>
        {footnote}
        <button
          type="button"
          className="main-game__btn main-game__btn--primary"
          onClick={onContinue}
          disabled={continueDisabled}
        >
          続ける
        </button>
      </div>
    </div>
  )
}

function ResultDialog() {
  const { state, dispatch } = useGameState()
  const result = state.roundResult

  if (state.phase !== 'result' || !result) {
    return null
  }

  return (
    <RoundResultDialogView
      result={result}
      explorationCounter={state.explorationCounter}
      onContinue={() => dispatch({ type: 'DISMISS_RESULT' })}
    />
  )
}

function SecretAnswerHighlight({ secret }: { secret: SecretAnswer }) {
  const rows: { category: CardCategory; card: Card }[] = [
    { category: 'occupation', card: secret.occupation },
    { category: 'weapon', card: secret.weapon },
    { category: 'motive', card: secret.motive },
  ]

  return (
    <div className="main-game__end-answer">
      <h4 className="main-game__end-answer-title">事件の真実（正解）</h4>
      <ul className="main-game__end-answer-list">
        {rows.map(({ category, card }) => (
          <li key={category} className="main-game__end-answer-item">
            <span className="main-game__end-answer-category">
              {CATEGORY_LABEL[category]}
            </span>
            <span className="main-game__end-answer-name">{card.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EndResultDialog({
  dismissed,
  onDismiss,
}: {
  dismissed: boolean
  onDismiss: () => void
}) {
  const { state } = useGameState()
  const isEndPhase = state.phase === 'gameover' || state.phase === 'victory'

  if (!isEndPhase || dismissed) {
    return null
  }

  return (
    <EndResultDialogView
      outcome={state.phase === 'gameover' ? 'gameover' : 'victory'}
      secret={state.secretAnswer}
      onDismiss={onDismiss}
    />
  )
}

export function EndResultDialogView({
  outcome,
  secret,
  onDismiss,
}: {
  outcome: 'gameover' | 'victory'
  secret: SecretAnswer | null
  onDismiss: () => void
}) {
  const title =
    outcome === 'gameover'
      ? '迷宮入り — 探偵の敗北'
      : '隠された真実がすべて暴かれた。'

  const lead =
    outcome === 'gameover'
      ? '探索カウンタが最大のまま推理に失敗しました。事件は未解決のまま……。'
      : '被害者の残した手がかりから、ついに事件の全貌が判明した！'

  return (
    <div className="main-game__dialog-overlay" role="dialog" aria-modal="true">
      <div className="main-game__dialog main-game__dialog--end">
        <h3>{title}</h3>
        <p className="main-game__dialog-lead">{lead}</p>
        {secret && <SecretAnswerHighlight secret={secret} />}
        <button
          type="button"
          className="main-game__btn main-game__btn--primary"
          onClick={onDismiss}
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

export function MainGameScreen() {
  const { state, dispatch, resetGame } = useGameState()

  const victim = state.players.find((p) => p.role === 'victim')
  const excludedSet = useMemo(() => new Set(state.excludedCardIds), [state.excludedCardIds])
  const selectedSet = useMemo(
    () => new Set(state.selectedCardsForRemoval),
    [state.selectedCardsForRemoval],
  )
  const grouped = useMemo(() => groupBoardByCategory(state.boardCards), [state.boardCards])

  const isEndPhase = state.phase === 'gameover' || state.phase === 'victory'
  const answerIds = useMemo(() => {
    if (!state.secretAnswer || !isEndPhase) {
      return new Set<string>()
    }
    return new Set([
      state.secretAnswer.occupation.id,
      state.secretAnswer.weapon.id,
      state.secretAnswer.motive.id,
    ])
  }, [state.secretAnswer, isEndPhase])

  const selectable = state.phase === 'deduction'
  const onToggle = (id: string) => dispatch({ type: 'TOGGLE_CARD_SELECTION', cardId: id })

  const [endDialogDismissed, setEndDialogDismissed] = useState(false)

  useEffect(() => {
    if (isEndPhase) {
      setEndDialogDismissed(false)
    }
  }, [isEndPhase, state.phase])

  const showFinalBoardExtras = isEndPhase && endDialogDismissed

  return (
    <div className="main-game">
      <header className="main-game__header">
        <h1>{PHASE_LABEL[state.phase] ?? state.phase}</h1>
        <div className="main-game__meta">
          <span className="main-game__exploration">
            探索: {state.explorationCounter}/{MAX_EXPLORATION}
          </span>
          {victim && <span>被害者: {victim.name}さん</span>}
        </div>
        <button type="button" className="main-game__reset" onClick={resetGame}>
          タイトルに戻る
        </button>
      </header>

      <div className="main-game__board">
        {CATEGORY_ORDER.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            cards={grouped[category]}
            messages={state.hintMessagesByCategory[category]}
            excludedIds={excludedSet}
            selectedIds={selectedSet}
            answerIds={answerIds}
            selectable={selectable}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="main-game__action-bar">
        {state.phase === 'victim_hint' && <VictimHintPanel />}
        <DetectivePanel />
        {showFinalBoardExtras && (
          <DeductionHistoryList
            history={state.deductionHistory}
            title="このゲームの推理履歴"
            titleId="deduction-history-final"
          />
        )}
      </div>

      <ResultDialog />
      <VictimTurnSkipNoticeDialog />
      <EndResultDialog
        dismissed={endDialogDismissed}
        onDismiss={() => setEndDialogDismissed(true)}
      />
    </div>
  )
}
