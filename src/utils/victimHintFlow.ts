import type { CardCategory, HintCard, HintMessagesByCategory } from '../types/game'

export const VICTIM_CATEGORIES: CardCategory[] = ['occupation', 'weapon', 'motive']
export const MAX_HINTS_PER_CATEGORY = 2

export function hasAvailableHintCategory(
  hints: HintMessagesByCategory,
): boolean {
  return VICTIM_CATEGORIES.some(
    (cat) => hints[cat].length < MAX_HINTS_PER_CATEGORY,
  )
}

export function isInitialHintSetupComplete(
  hints: HintMessagesByCategory,
): boolean {
  return VICTIM_CATEGORIES.every((cat) => hints[cat].length >= 1)
}

export function countInitialHintsRemaining(hints: HintMessagesByCategory): number {
  return VICTIM_CATEGORIES.filter((cat) => hints[cat].length === 0).length
}

/** 被害者手札を A群・B群に分ける（提出済み・消費済みは手札に含まれない） */
export function splitVictimHintHand(hand: HintCard[]): {
  hintA: HintCard[]
  hintB: HintCard[]
} {
  return {
    hintA: hand.filter((card) => card.group === 'A'),
    hintB: hand.filter((card) => card.group === 'B'),
  }
}
