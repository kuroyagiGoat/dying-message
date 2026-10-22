import { useEffect, useMemo, useState } from 'react'
import { DEDUCTION_SELECTION_COUNT, MAX_EXPLORATION } from '../hooks/useGameState'
import type { CardCategory, SecretAnswer } from '../types/game'
import type { OnlineGameState, Room, RoomPlayer, RoomSession } from '../types/online'
import {
  clearDeductionSelection,
  confirmSecretChecked,
  dismissRoundResult,
  fetchRoomSecret,
  leaveRoom,
  resolveDeduction,
  toggleDeductionCard,
} from '../utils/roomService'
import { splitVictimHintHand } from '../utils/victimHintFlow'
import { DeductionHistoryList } from './DeductionHistoryList'
import {
  CATEGORY_ORDER,
  CategoryRow,
  DetectiveVictimHandHints,
  EndResultDialogView,
  groupBoardByCategory,
  RoundResultDialogView,
  VictimTurnSkipNoticeDialogView,
} from './MainGameScreen'
import { OnlineVictimHintPanel } from './OnlineVictimHintPanel'
import './main-game-screen.css'
import './online-screen.css'
import './secret-check-modal.css'

const CATEGORY_LABEL: Record<CardCategory, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

const PHASE_LABEL: Record<string, string> = {
  secret_check: 'Phase 1: お題確認',
  victim_hint: 'Phase 2: 被害者ヒント作成',
  deduction: 'Phase 3: 探偵の推理・決定',
  result: 'Phase 4: 結果発表',
  gameover: 'ゲームオーバー',
  victory: '勝利',
}

const EMPTY_SET = new Set<string>()

interface OnlineGameScreenProps {
  session: RoomSession
  room: Room
  gameState: OnlineGameState
  players: RoomPlayer[]
  onLeft: () => void
}

function OnlineSecretCheckModal({
  session,
  gameState,
}: {
  session: RoomSession
  gameState: OnlineGameState
}) {
  const [secret, setSecret] = useState<SecretAnswer | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hand = useMemo(() => splitVictimHintHand(gameState.victimHintHand), [gameState.victimHintHand])

  const run = async (action: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信に失敗しました。')
    } finally {
      setPending(false)
    }
  }

  const reveal = () =>
    run(async () => {
      setSecret(secret ?? (await fetchRoomSecret(session)))
      setRevealed(true)
    })

  const confirm = () => run(() => confirmSecretChecked(session))

  return (
    <div className="secret-check-overlay" role="dialog" aria-modal="true" aria-labelledby="online-secret-title">
      <div className="secret-check-modal">
        <h2 id="online-secret-title" className="secret-check-modal__title">
          お題確認
        </h2>
        <p className="secret-check-modal__warning">
          <strong>あなたは被害者です。</strong>
          <br />
          周りの人に画面を見られないよう注意して、お題を確認してください。
        </p>

        {!revealed || !secret ? (
          <div className="secret-check-modal__actions">
            <button
              type="button"
              className="secret-check-modal__btn-primary"
              onClick={() => void reveal()}
              disabled={pending}
            >
              {pending ? '取得中…' : 'お題を確認する'}
            </button>
          </div>
        ) : (
          <>
            <ul className="secret-check-modal__answers">
              {CATEGORY_ORDER.map((category) => (
                <li key={category}>
                  <span className="secret-check-modal__category">{CATEGORY_LABEL[category]}</span>
                  {secret[category].name}
                </li>
              ))}
            </ul>
            <p className="secret-check-modal__warning">あなたの初期手札</p>
            <DetectiveVictimHandHints hintA={hand.hintA} hintB={hand.hintB} />
            <div className="secret-check-modal__actions">
              <button
                type="button"
                className="secret-check-modal__btn-primary"
                onClick={() => void confirm()}
                disabled={pending}
              >
                確認しました（Phase 2へ）
              </button>
              <button
                type="button"
                className="secret-check-modal__btn-secondary"
                onClick={() => setRevealed(false)}
                disabled={pending}
              >
                お題を隠す
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="main-game__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

export function OnlineGameScreen({ session, room, gameState, players, onLeft }: OnlineGameScreenProps) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [dismissedSkipNoticeRound, setDismissedSkipNoticeRound] = useState<number | null>(null)
  const [endDialogDismissed, setEndDialogDismissed] = useState(false)
  const [endSecret, setEndSecret] = useState<SecretAnswer | null>(null)

  const isVictim = room.victim_player_id === session.self.id
  const victim = players.find((p) => p.id === room.victim_player_id)
  const phase = gameState.phase
  const isEndPhase = phase === 'gameover' || phase === 'victory'
  const selectedIds = gameState.selectedCardsForRemoval ?? []
  const selectedCount = selectedIds.length
  const roundKey = gameState.deductionHistory.length

  const grouped = useMemo(() => groupBoardByCategory(gameState.boardCards), [gameState.boardCards])
  const excludedSet = useMemo(() => new Set(gameState.excludedCardIds), [gameState.excludedCardIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const hand = useMemo(() => splitVictimHintHand(gameState.victimHintHand), [gameState.victimHintHand])
  const answerIds = useMemo(
    () =>
      endSecret && isEndPhase
        ? new Set([endSecret.occupation.id, endSecret.weapon.id, endSecret.motive.id])
        : EMPTY_SET,
    [endSecret, isEndPhase],
  )

  useEffect(() => {
    if (!isEndPhase || endSecret) return
    fetchRoomSecret(session)
      .then(setEndSecret)
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : 'お題の取得に失敗しました。'))
  }, [isEndPhase, endSecret, session])

  const run = async (key: string, action: () => Promise<void>) => {
    setPendingAction(key)
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '通信に失敗しました。')
    } finally {
      setPendingAction(null)
    }
  }

  const handleLeave = () =>
    run('leave', async () => {
      await leaveRoom(session)
      onLeft()
    })

  const canSelectCards = !isVictim && phase === 'deduction'
  const onToggleCard = (cardId: string) => void run(`toggle:${cardId}`, () => toggleDeductionCard(session, cardId))
  const showSkipNotice =
    phase === 'deduction' &&
    Boolean(gameState.victimTurnSkipNotice) &&
    dismissedSkipNoticeRound !== roundKey

  return (
    <div className="main-game">
      <header className="main-game__header">
        <h1>{PHASE_LABEL[gameState.phase] ?? gameState.phase}</h1>
        <div className="main-game__meta">
          <span className="main-game__exploration">
            探索: {gameState.explorationCounter}/{MAX_EXPLORATION}
          </span>
          {victim && <span>被害者: {victim.name}さん</span>}
          <span>あなた: {session.self.name}（{isVictim ? '被害者' : '探偵'}）</span>
        </div>
        <button
          type="button"
          className="main-game__reset"
          onClick={() => void handleLeave()}
          disabled={pendingAction === 'leave'}
        >
          {session.self.is_host ? '部屋を解散する' : '部屋から退出する'}
        </button>
      </header>

      <div className="main-game__board">
        {CATEGORY_ORDER.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            cards={grouped[category]}
            messages={gameState.hintMessagesByCategory[category]}
            excludedIds={excludedSet}
            selectedIds={selectedSet}
            answerIds={answerIds}
            selectable={canSelectCards}
            onToggle={onToggleCard}
          />
        ))}
      </div>

      <div className="main-game__action-bar">
        {isVictim && phase === 'victim_hint' && (
          <OnlineVictimHintPanel session={session} gameState={gameState} />
        )}

        {!isVictim && (phase === 'secret_check' || phase === 'victim_hint') && (
          <>
            <h2>探偵</h2>
            <p className="online-game__status" role="status">
              <span className="online-game__spinner" aria-hidden="true" />
              {phase === 'secret_check'
                ? '被害者がお題を確認しています。しばらくお待ちください…'
                : gameState.initialHintsComplete
                  ? '被害者が追加のダイイングメッセージを作成中です…'
                  : '被害者がダイイングメッセージを作成中です…'}
            </p>
            <DeductionHistoryList
              history={gameState.deductionHistory}
              title="過去の推理履歴"
              titleId="online-history-detective-waiting"
            />
          </>
        )}

        {(phase === 'deduction' || phase === 'result') && (
          <>
            <h2>{isVictim ? '被害者：探偵の推理を待っています' : '探偵：6枚選択・決定'}</h2>
            {isVictim ? (
              phase === 'deduction' ? (
                <p className="online-game__status" role="status">
                  <span className="online-game__spinner" aria-hidden="true" />
                  探偵が除外する6枚を相談しています…（選択中 {selectedCount}/{DEDUCTION_SELECTION_COUNT} 枚）
                </p>
              ) : (
                <p className="online-game__status" role="status">
                  判定結果が出ました。
                </p>
              )
            ) : (
              <p className="main-game__initial-hint-note">
                正解ではないと思うカードを<strong>ちょうど{DEDUCTION_SELECTION_COUNT}枚</strong>
                選んで確定してください。選択は探偵全員の画面に同期されます。
              </p>
            )}
            <div className="main-game__detective-row">
              {!isVictim && (
                <p className="main-game__selection-count">
                  選択中: {selectedCount}/{DEDUCTION_SELECTION_COUNT} 枚
                </p>
              )}
              {phase === 'deduction' && (
                <DetectiveVictimHandHints hintA={hand.hintA} hintB={hand.hintB} />
              )}
              {!isVictim && (
                <>
                  <button
                    type="button"
                    className="main-game__btn main-game__btn--secondary"
                    onClick={() => void run('clear', () => clearDeductionSelection(session))}
                    disabled={selectedCount === 0 || phase !== 'deduction' || pendingAction !== null}
                  >
                    選択をクリア
                  </button>
                  <button
                    type="button"
                    className="main-game__btn main-game__btn--primary"
                    onClick={() => void run('resolve', () => resolveDeduction(session))}
                    disabled={
                      phase !== 'deduction' ||
                      selectedCount !== DEDUCTION_SELECTION_COUNT ||
                      pendingAction !== null
                    }
                  >
                    {pendingAction === 'resolve' ? '判定中…' : 'この6枚を除外する'}
                  </button>
                </>
              )}
            </div>
            <DeductionHistoryList
              history={gameState.deductionHistory}
              title="過去の推理履歴"
              titleId="online-history-deduction"
            />
          </>
        )}

        {isEndPhase && endDialogDismissed && (
          <DeductionHistoryList
            history={gameState.deductionHistory}
            title="このゲームの推理履歴"
            titleId="online-history-final"
          />
        )}

        {actionError && (
          <p className="main-game__error" role="alert">
            {actionError}
          </p>
        )}
      </div>

      {isVictim && phase === 'secret_check' && (
        <OnlineSecretCheckModal session={session} gameState={gameState} />
      )}

      {phase === 'result' && gameState.roundResult && (
        <RoundResultDialogView
          result={gameState.roundResult}
          explorationCounter={gameState.explorationCounter}
          onContinue={() => void run('dismiss', () => dismissRoundResult(session))}
          continueDisabled={pendingAction === 'dismiss'}
          footnote={
            <p className="online-game__dialog-note">
              誰か1人が「続ける」を押すと、全員の画面が次のターンへ進みます。
            </p>
          }
        />
      )}

      {showSkipNotice && (
        <VictimTurnSkipNoticeDialogView
          notice={gameState.victimTurnSkipNotice!}
          onDismiss={() => setDismissedSkipNoticeRound(roundKey)}
        />
      )}

      {isEndPhase && !endDialogDismissed && (
        <EndResultDialogView
          outcome={phase}
          secret={endSecret}
          onDismiss={() => setEndDialogDismissed(true)}
        />
      )}
    </div>
  )
}
