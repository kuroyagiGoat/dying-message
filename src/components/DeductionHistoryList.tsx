import type { CardCategory, DeductionHistoryEntry } from '../types/game'
import './deduction-history-list.css'

const CATEGORY_LABEL: Record<CardCategory, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

interface DeductionHistoryListProps {
  history: DeductionHistoryEntry[]
  title?: string
  titleId?: string
}

export function DeductionHistoryList({
  history,
  title = '探偵の過去の推理履歴',
  titleId = 'deduction-history-title',
}: DeductionHistoryListProps) {
  return (
    <section className="deduction-history" aria-labelledby={titleId}>
      <h3 id={titleId} className="deduction-history__title">
        {title}
      </h3>
      {history.length === 0 ? (
        <p className="deduction-history__empty">
          まだ探偵の推理は行われていません。
        </p>
      ) : (
        <ul className="deduction-history__list">
          {history.map((entry) => (
            <li key={entry.roundIndex} className="deduction-history__item">
              <div className="deduction-history__header">
                <span className="deduction-history__round">
                  第{entry.roundIndex}回
                </span>
                <span
                  className={
                    entry.outcome === 'success'
                      ? 'deduction-history__outcome deduction-history__outcome--success'
                      : 'deduction-history__outcome deduction-history__outcome--failure'
                  }
                >
                  {entry.outcome === 'success'
                    ? '成功（カード除外）'
                    : '失敗（失敗+1）'}
                </span>
              </div>
              <ul className="deduction-history__card-list">
                {entry.selectedCards.map((card) => (
                  <li key={`${entry.roundIndex}-${card.id}`}>
                    <span className="deduction-history__card-category">
                      {CATEGORY_LABEL[card.category]}
                    </span>
                    {card.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
