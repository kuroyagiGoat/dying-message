import { HINT_A_CARDS, HINT_B_CARDS } from '../constants/cards'
import { INITIAL_EXPLORATION } from '../hooks/useGameState'
import { createEmptyHintMessages, type HintCard } from '../types/game'
import type { OnlineGameState, RoomPlayer } from '../types/online'
import { createBoardCards, createInitialVictimHintHand } from './setupGame'

/** 場札27枚（各カテゴリ9枚）と被害者の初期手札（A6/B6）を生成する。正解はサーバー側で抽選する */
export function buildInitialOnlineGameState(): OnlineGameState {
  return {
    phase: 'secret_check',
    boardCards: createBoardCards(),
    excludedCardIds: [],
    hintMessagesByCategory: createEmptyHintMessages(),
    explorationCounter: INITIAL_EXPLORATION,
    victimHintHand: createInitialVictimHintHand(),
    usedHintCardIds: [],
    initialHintsComplete: false,
    deductionHistory: [],
    selectedCardsForRemoval: [],
    roundResult: null,
    victimTurnSkipNotice: null,
  }
}

/** 手札補充の抽選元（サーバー側で使用済み・手札を除いて A・B 1枚ずつ引く） */
export function buildHintCardPool(): HintCard[] {
  return [...HINT_A_CARDS, ...HINT_B_CARDS]
}

/** 指定がない（または指定したプレイヤーが退出済みの）場合はランダムに被害者を選ぶ */
export function resolveVictimPlayerId(players: RoomPlayer[], preferredId: string | null): string {
  if (preferredId && players.some((p) => p.id === preferredId)) {
    return preferredId
  }
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % players.length
  return players[index].id
}
