import { useState } from 'react'
import { useGameState } from '../hooks/useGameState'
import './secret-check-modal.css'

const CATEGORY_LABEL: Record<string, string> = {
  occupation: '職業',
  weapon: '凶器',
  motive: '動機',
}

export function SecretCheckModal() {
  const { state, dispatch } = useGameState()
  const [revealed, setRevealed] = useState(false)

  const victim = state.players.find((p) => p.role === 'victim')
  const secret = state.secretAnswer

  if (!victim || !secret) {
    return null
  }

  const confirmAndContinue = () => {
    dispatch({ type: 'SET_PHASE', phase: 'victim_hint' })
  }

  return (
    <div className="secret-check-overlay" role="dialog" aria-modal="true" aria-labelledby="secret-check-title">
      <div className="secret-check-modal">
        <h2 id="secret-check-title" className="secret-check-modal__title">
          お題確認
        </h2>
        <p className="secret-check-modal__warning">
          <strong>被害者（{victim.name}さん）以外は画面を見ないでください。</strong>
          <br />
          探偵の方は、この画面が閉じるまで目をそらすか、別の場所でお待ちください。
        </p>

        {!revealed ? (
          <div className="secret-check-modal__actions">
            <button
              type="button"
              className="secret-check-modal__btn-primary"
              onClick={() => setRevealed(true)}
            >
              お題を確認する
            </button>
          </div>
        ) : (
          <>
            <ul className="secret-check-modal__answers">
              <li>
                <span className="secret-check-modal__category">{CATEGORY_LABEL.occupation}</span>
                {secret.occupation.name}
              </li>
              <li>
                <span className="secret-check-modal__category">{CATEGORY_LABEL.weapon}</span>
                {secret.weapon.name}
              </li>
              <li>
                <span className="secret-check-modal__category">{CATEGORY_LABEL.motive}</span>
                {secret.motive.name}
              </li>
            </ul>
            <div className="secret-check-modal__actions">
              <button
                type="button"
                className="secret-check-modal__btn-primary"
                onClick={confirmAndContinue}
              >
                確認しました（Phase 2へ）
              </button>
              <button
                type="button"
                className="secret-check-modal__btn-secondary"
                onClick={() => setRevealed(false)}
              >
                お題を隠す
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
