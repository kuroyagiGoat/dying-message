import { useGameState } from '../hooks/useGameState'

const PHASE_LABEL: Record<string, string> = {
  victim_hint: 'Phase 2: 被害者ヒント作成（未実装）',
  deduction: 'Phase 3: 推理（未実装）',
  result: 'Phase 5: 結果（未実装）',
  gameover: 'ゲームオーバー',
  victory: '勝利',
}

export function PhasePlaceholder() {
  const { state } = useGameState()
  const label = PHASE_LABEL[state.phase] ?? state.phase

  return (
    <main style={{ maxWidth: '36rem', margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.25rem' }}>{label}</h1>
      <p style={{ color: '#444' }}>
        画面遷移の確認用プレースホルダーです。次フェーズの UI は今後実装します。
      </p>
      <dl style={{ marginTop: '1.5rem', lineHeight: 1.7 }}>
        <dt>現在のフェーズ</dt>
        <dd>
          <code>{state.phase}</code>
        </dd>
        <dt>場のカード枚数</dt>
        <dd>
          {state.boardCards.length - state.excludedCardIds.length} / {state.boardCards.length} 枚
        </dd>
        <dt>プレイヤー</dt>
        <dd>
          {state.players.map((p) => (
            <span key={p.id} style={{ display: 'block' }}>
              {p.name}（{p.role === 'victim' ? '被害者' : '探偵'}）
            </span>
          ))}
        </dd>
      </dl>
    </main>
  )
}
