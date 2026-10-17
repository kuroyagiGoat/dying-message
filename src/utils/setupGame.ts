import {
  HINT_A_CARDS,
  HINT_B_CARDS,
  MOTIVE_CARDS,
  OCCUPATION_CARDS,
  WEAPON_CARDS,
} from '../constants/cards'
import type { Card, HintCard, Player, SecretAnswer } from '../types/game'

export const TOPIC_CARDS_PER_CATEGORY = 9
export const INITIAL_HINT_A_COUNT = 6
export const INITIAL_HINT_B_COUNT = 6

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function pickRandomN<T>(pool: T[], count: number): T[] {
  if (count > pool.length) {
    throw new Error(`プール枚数(${pool.length})が選出枚数(${count})より少ないです`)
  }
  return shuffle(pool).slice(0, count)
}

/** 各カテゴリのプールからランダム9枚ずつ選出（計27枚） */
export function createBoardCards(): Card[] {
  const occupation = pickRandomN(OCCUPATION_CARDS, TOPIC_CARDS_PER_CATEGORY)
  const weapon = pickRandomN(WEAPON_CARDS, TOPIC_CARDS_PER_CATEGORY)
  const motive = pickRandomN(MOTIVE_CARDS, TOPIC_CARDS_PER_CATEGORY)
  return [...occupation, ...weapon, ...motive]
}

/** 場に並んだ27枚のうち、各カテゴリ1枚を正解として選ぶ */
export function drawSecretAnswerFromBoard(boardCards: Card[]): SecretAnswer {
  const occupationCards = boardCards.filter((c) => c.category === 'occupation')
  const weaponCards = boardCards.filter((c) => c.category === 'weapon')
  const motiveCards = boardCards.filter((c) => c.category === 'motive')

  return {
    occupation: pickRandom(occupationCards),
    weapon: pickRandom(weaponCards),
    motive: pickRandom(motiveCards),
  }
}

/** 初期手札：A群6枚 + B群6枚をプールからランダム配布 */
export function createInitialVictimHintHand(): HintCard[] {
  const aCards = pickRandomN(HINT_A_CARDS, INITIAL_HINT_A_COUNT)
  const bCards = pickRandomN(HINT_B_CARDS, INITIAL_HINT_B_COUNT)
  return [...aCards, ...bCards]
}

export interface GameStartPayload {
  players: Player[]
  boardCards: Card[]
  secretAnswer: SecretAnswer
  victimHintHand: HintCard[]
}

export function buildGameStartPayload(players: Player[]): GameStartPayload {
  const boardCards = createBoardCards()
  return {
    players,
    boardCards,
    secretAnswer: drawSecretAnswerFromBoard(boardCards),
    victimHintHand: createInitialVictimHintHand(),
  }
}
