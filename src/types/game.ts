/** 場に並ぶお題カード（職業・凶器・動機）のカテゴリ */
export type CardCategory = 'occupation' | 'weapon' | 'motive'

/** 場に配置されるお題カード */
export interface Card {
  id: string
  category: CardCategory
  name: string
}

/** ヒントカードの群（メッセージは A → B の順で組み合わせる） */
export type HintCardGroup = 'A' | 'B'

/** 被害者がメッセージ作成に使うヒントカード */
export interface HintCard {
  id: string
  group: HintCardGroup
  name: string
}

export type Phase =
  | 'setup'
  | 'secret_check'
  | 'victim_hint'
  | 'deduction'
  | 'result'
  | 'gameover'
  | 'victory'

export type PlayerRole = 'victim' | 'detective'

export interface Player {
  id: string
  name: string
  role: PlayerRole
}

/** 各カテゴリ1枚ずつの正解（事件の真実） */
export interface SecretAnswer {
  occupation: Card
  weapon: Card
  motive: Card
}

/** 被害者が確定したダイイングメッセージ */
export interface DyingMessage {
  targetCategory: CardCategory
  hintCardA: HintCard
  hintCardB: HintCard
}

/** カテゴリ行の右端にスタック表示するヒント履歴 */
export type HintMessagesByCategory = Record<CardCategory, DyingMessage[]>

export function createEmptyHintMessages(): HintMessagesByCategory {
  return {
    occupation: [],
    weapon: [],
    motive: [],
  }
}

/** 直近ラウンドの推理結果（結果ダイアログ用） */
export interface RoundResult {
  outcome: 'success' | 'failure'
  failsRemaining?: number
}

/** 探偵ターン1回分の推理ログ（被害者向け履歴表示用） */
export interface DeductionHistoryEntry {
  /** 表示用ラウンド番号（1始まり） */
  roundIndex: number
  selectedCards: Card[]
  outcome: 'success' | 'failure'
}

export interface GameState {
  phase: Phase
  players: Player[]
  boardCards: Card[]
  excludedCardIds: string[]
  secretAnswer: SecretAnswer | null
  /** カテゴリごとにスタックされたダイイングメッセージ */
  hintMessagesByCategory: HintMessagesByCategory
  selectedCardsForRemoval: string[]
  /** 探索カウンタ（1〜4で開始、失敗のたびに+1、最大値で失敗するとゲームオーバー） */
  explorationCounter: number
  victimHintHand: HintCard[]
  /** 一度使用したヒントカード ID（再配布しない） */
  usedHintCardIds: string[]
  /** 初回3カテゴリへのヒント設置が完了したか */
  initialHintsComplete: boolean
  /** 被害者ターンスキップ時に一度だけ表示する案内 */
  victimTurnSkipNotice: string | null
  /** 完了した探偵推理の履歴（古い順） */
  deductionHistory: DeductionHistoryEntry[]
  roundResult: RoundResult | null
}

export type GameStateAction =
  | { type: 'START_GAME'; players: Player[] }
  | { type: 'RESET' }
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'SUBMIT_HINT'; message: DyingMessage }
  | { type: 'RESOLVE_DEDUCTION' }
  | { type: 'DISMISS_RESULT' }
  | { type: 'DISMISS_VICTIM_TURN_SKIP_NOTICE' }
  | { type: 'SKIP_VICTIM_TURN_TO_DEDUCTION' }
  | { type: 'SET_SECRET_ANSWER'; secretAnswer: SecretAnswer }
  | { type: 'SET_VICTIM_HINT_HAND'; victimHintHand: HintCard[] }
  | { type: 'TOGGLE_CARD_SELECTION'; cardId: string }
  | { type: 'CLEAR_CARD_SELECTION' }
