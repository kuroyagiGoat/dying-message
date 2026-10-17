import { HINT_A_CARDS, HINT_B_CARDS } from '../constants/cards'
import type { HintCard, HintCardGroup } from '../types/game'

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null
  }
  return items[Math.floor(Math.random() * items.length)]
}

function drawHintCard(
  group: HintCardGroup,
  hand: HintCard[],
  usedHintCardIds: string[],
): HintCard | null {
  const unavailable = new Set([
    ...usedHintCardIds,
    ...hand.map((card) => card.id),
  ])
  const pool = group === 'A' ? HINT_A_CARDS : HINT_B_CARDS
  const available = pool.filter((card) => !unavailable.has(card.id))
  return pickRandom(available)
}

/** 推理後：手札に A・B をそれぞれ1枚ずつランダム補充（使用済みは除外） */
export function refillVictimHintHand(
  currentHand: HintCard[],
  usedHintCardIds: string[],
): HintCard[] {
  const hand = [...currentHand]
  const usedIds = [...usedHintCardIds]

  const cardA = drawHintCard('A', hand, usedIds)
  if (cardA) {
    hand.push(cardA)
  }

  const cardB = drawHintCard('B', hand, usedIds)
  if (cardB) {
    hand.push(cardB)
  }

  return hand
}
