import type { Card, DeductionHistoryEntry } from '../types/game'

export function resolveSelectedCards(
  boardCards: Card[],
  selectedIds: string[],
): Card[] {
  const byId = new Map(boardCards.map((card) => [card.id, card]))
  return selectedIds
    .map((id) => byId.get(id))
    .filter((card): card is Card => card !== undefined)
}

export function createDeductionHistoryEntry(
  history: DeductionHistoryEntry[],
  boardCards: Card[],
  selectedIds: string[],
  outcome: 'success' | 'failure',
): DeductionHistoryEntry {
  return {
    roundIndex: history.length + 1,
    selectedCards: resolveSelectedCards(boardCards, selectedIds),
    outcome,
  }
}
