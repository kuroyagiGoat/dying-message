import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { GameState, GameStateAction } from '../types/game'
import { createEmptyHintMessages } from '../types/game'
import { createDeductionHistoryEntry } from '../utils/deductionHistory'
import { checkVictory, getRemainingCards } from '../utils/gameLogic'
import { refillVictimHintHand } from '../utils/hintRefill'
import { buildGameStartPayload } from '../utils/setupGame'
import {
  hasAvailableHintCategory,
  isInitialHintSetupComplete,
} from '../utils/victimHintFlow'

const VICTIM_TURN_SKIP_MESSAGE =
  'すべてのカテゴリにヒントが2組出揃いました。被害者ターンをスキップし、探偵ターンへ進みます。'

export const MAX_EXPLORATION = 4
export const INITIAL_EXPLORATION = 1
export const DEDUCTION_SELECTION_COUNT = 6

export function createInitialGameState(): GameState {
  return {
    phase: 'setup',
    players: [],
    boardCards: [],
    excludedCardIds: [],
    secretAnswer: null,
    hintMessagesByCategory: createEmptyHintMessages(),
    selectedCardsForRemoval: [],
    explorationCounter: INITIAL_EXPLORATION,
    victimHintHand: [],
    usedHintCardIds: [],
    initialHintsComplete: false,
    victimTurnSkipNotice: null,
    deductionHistory: [],
    roundResult: null,
  }
}

function gameStateReducer(state: GameState, action: GameStateAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const payload = buildGameStartPayload(action.players)
      return {
        ...state,
        phase: 'secret_check',
        players: payload.players,
        boardCards: payload.boardCards,
        excludedCardIds: [],
        secretAnswer: payload.secretAnswer,
        victimHintHand: payload.victimHintHand,
        hintMessagesByCategory: createEmptyHintMessages(),
        selectedCardsForRemoval: [],
        explorationCounter: INITIAL_EXPLORATION,
        usedHintCardIds: [],
        initialHintsComplete: false,
        victimTurnSkipNotice: null,
        deductionHistory: [],
        roundResult: null,
      }
    }
    case 'RESET':
      return createInitialGameState()
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_PLAYERS':
      return { ...state, players: action.players }
    case 'SET_SECRET_ANSWER':
      return { ...state, secretAnswer: action.secretAnswer }
    case 'SET_VICTIM_HINT_HAND':
      return { ...state, victimHintHand: action.victimHintHand }
    case 'SUBMIT_HINT': {
      const { message } = action
      const victimHintHand = state.victimHintHand.filter(
        (card) =>
          card.id !== message.hintCardA.id && card.id !== message.hintCardB.id,
      )
      const usedHintCardIds = [
        ...state.usedHintCardIds,
        message.hintCardA.id,
        message.hintCardB.id,
      ]
      const hintMessagesByCategory = {
        ...state.hintMessagesByCategory,
        [message.targetCategory]: [
          ...state.hintMessagesByCategory[message.targetCategory],
          message,
        ],
      }

      const initialSetupDone = isInitialHintSetupComplete(hintMessagesByCategory)
      const initialHintsComplete =
        state.initialHintsComplete || initialSetupDone
      const proceedToDeduction =
        state.initialHintsComplete || initialSetupDone

      return {
        ...state,
        phase: proceedToDeduction ? 'deduction' : 'victim_hint',
        hintMessagesByCategory,
        victimHintHand,
        usedHintCardIds,
        initialHintsComplete,
        selectedCardsForRemoval: [],
      }
    }
    case 'RESOLVE_DEDUCTION': {
      if (!state.secretAnswer) {
        return state
      }
      if (state.selectedCardsForRemoval.length !== DEDUCTION_SELECTION_COUNT) {
        return state
      }

      const secretIds = new Set([
        state.secretAnswer.occupation.id,
        state.secretAnswer.weapon.id,
        state.secretAnswer.motive.id,
      ])
      const hasHit = state.selectedCardsForRemoval.some((id) => secretIds.has(id))

      const selectedIds = [...state.selectedCardsForRemoval]

      const deductionHistory = [
        ...state.deductionHistory,
        createDeductionHistoryEntry(
          state.deductionHistory,
          state.boardCards,
          selectedIds,
          hasHit ? 'failure' : 'success',
        ),
      ]

      if (hasHit) {
        if (state.explorationCounter >= MAX_EXPLORATION) {
          return {
            ...state,
            phase: 'gameover',
            selectedCardsForRemoval: [],
            deductionHistory,
            roundResult: null,
          }
        }
        const explorationCounter = state.explorationCounter + 1
        return {
          ...state,
          phase: 'result',
          explorationCounter,
          selectedCardsForRemoval: [],
          deductionHistory,
          roundResult: {
            outcome: 'failure',
            failsRemaining: MAX_EXPLORATION - explorationCounter,
          },
        }
      }

      const excludedCardIds = [...state.excludedCardIds, ...selectedIds]
      const remaining = getRemainingCards(state.boardCards, excludedCardIds)

      if (checkVictory(remaining, state.secretAnswer)) {
        return {
          ...state,
          phase: 'victory',
          excludedCardIds,
          selectedCardsForRemoval: [],
          deductionHistory,
          roundResult: null,
        }
      }

      return {
        ...state,
        phase: 'result',
        excludedCardIds,
        selectedCardsForRemoval: [],
        deductionHistory,
        roundResult: { outcome: 'success' },
      }
    }
    case 'DISMISS_RESULT': {
      if (!state.roundResult || !state.secretAnswer) {
        return state
      }

      const remaining = getRemainingCards(state.boardCards, state.excludedCardIds)

      if (checkVictory(remaining, state.secretAnswer)) {
        return { ...state, phase: 'victory', roundResult: null }
      }

      const victimHintHand = refillVictimHintHand(
        state.victimHintHand,
        state.usedHintCardIds,
      )

      const canSubmitVictimHint = hasAvailableHintCategory(
        state.hintMessagesByCategory,
      )

      if (!canSubmitVictimHint) {
        return {
          ...state,
          phase: 'deduction',
          roundResult: null,
          victimHintHand,
          victimTurnSkipNotice: VICTIM_TURN_SKIP_MESSAGE,
          selectedCardsForRemoval: [],
        }
      }

      return {
        ...state,
        phase: 'victim_hint',
        roundResult: null,
        victimHintHand,
        victimTurnSkipNotice: null,
      }
    }
    case 'DISMISS_VICTIM_TURN_SKIP_NOTICE':
      return { ...state, victimTurnSkipNotice: null }
    case 'SKIP_VICTIM_TURN_TO_DEDUCTION':
      return {
        ...state,
        phase: 'deduction',
        victimTurnSkipNotice: VICTIM_TURN_SKIP_MESSAGE,
        selectedCardsForRemoval: [],
      }
    case 'TOGGLE_CARD_SELECTION': {
      if (state.phase !== 'deduction') {
        return state
      }
      const { cardId } = action
      if (state.excludedCardIds.includes(cardId)) {
        return state
      }
      const selected = state.selectedCardsForRemoval
      if (selected.includes(cardId)) {
        return {
          ...state,
          selectedCardsForRemoval: selected.filter((id) => id !== cardId),
        }
      }
      if (selected.length >= DEDUCTION_SELECTION_COUNT) {
        return state
      }
      return {
        ...state,
        selectedCardsForRemoval: [...selected, cardId],
      }
    }
    case 'CLEAR_CARD_SELECTION':
      return { ...state, selectedCardsForRemoval: [] }
    default:
      return state
  }
}

interface GameStateContextValue {
  state: GameState
  dispatch: Dispatch<GameStateAction>
  resetGame: () => void
}

const GameStateContext = createContext<GameStateContextValue | null>(null)

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameStateReducer, undefined, createInitialGameState)

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const value = useMemo(
    () => ({ state, dispatch, resetGame }),
    [state, resetGame],
  )

  return (
    <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
  )
}

export function useGameState(): GameStateContextValue {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider')
  }
  return context
}
