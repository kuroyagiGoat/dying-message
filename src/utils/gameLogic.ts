import type { Card, SecretAnswer } from '../types/game'

export function getRemainingCards(
  boardCards: Card[],
  excludedCardIds: string[],
): Card[] {
  const excluded = new Set(excludedCardIds)
  return boardCards.filter((card) => !excluded.has(card.id))
}

export function checkVictory(
  remaining: Card[],
  secret: SecretAnswer,
): boolean {
  if (remaining.length !== 3) {
    return false
  }
  const occupation = remaining.filter((c) => c.category === 'occupation')
  const weapon = remaining.filter((c) => c.category === 'weapon')
  const motive = remaining.filter((c) => c.category === 'motive')
  if (occupation.length !== 1 || weapon.length !== 1 || motive.length !== 1) {
    return false
  }
  return (
    occupation[0].id === secret.occupation.id &&
    weapon[0].id === secret.weapon.id &&
    motive[0].id === secret.motive.id
  )
}
