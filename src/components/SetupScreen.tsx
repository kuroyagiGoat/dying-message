import { useState } from 'react'
import type { Player } from '../types/game'
import { useGameState } from '../hooks/useGameState'
import './setup-screen.css'

interface DraftPlayer {
  id: string
  name: string
}

function createPlayerId(): string {
  return crypto.randomUUID()
}

interface SetupScreenProps {
  onBackToTitle?: () => void
}

export function SetupScreen({ onBackToTitle }: SetupScreenProps = {}) {
  const { dispatch } = useGameState()
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([])
  const [nameInput, setNameInput] = useState('')
  const [victimId, setVictimId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addPlayer = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setError('プレイヤー名を入力してください。')
      return
    }
    if (draftPlayers.some((p) => p.name === trimmed)) {
      setError('同じ名前のプレイヤーが既に登録されています。')
      return
    }
    setDraftPlayers((prev) => [...prev, { id: createPlayerId(), name: trimmed }])
    setNameInput('')
    setError(null)
  }

  const removePlayer = (id: string) => {
    setDraftPlayers((prev) => prev.filter((p) => p.id !== id))
    setVictimId((current) => (current === id ? null : current))
    setError(null)
  }

  const startGame = () => {
    if (draftPlayers.length < 2) {
      setError('プレイヤーは2名以上必要です。')
      return
    }
    if (!victimId) {
      setError('被害者を1名選択してください。')
      return
    }

    const players: Player[] = draftPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.id === victimId ? 'victim' : 'detective',
    }))

    dispatch({ type: 'START_GAME', players })
  }

  return (
    <section className="setup-screen">
      <h1 className="setup-screen__title">ダイイングメッセージ</h1>
      <p className="setup-screen__subtitle">プレイヤー設定（Phase 1）</p>

      <div className="setup-screen__section">
        <label className="setup-screen__label" htmlFor="player-name">
          プレイヤー名
        </label>
        <div className="setup-screen__row">
          <input
            id="player-name"
            className="setup-screen__input"
            value={nameInput}
            placeholder="名前を入力"
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addPlayer()
            }}
          />
          <button type="button" className="setup-screen__btn-secondary" onClick={addPlayer}>
            追加
          </button>
        </div>
      </div>

      {draftPlayers.length > 0 && (
        <div className="setup-screen__section">
          <span className="setup-screen__label">登録プレイヤー（被害者を1名選択）</span>
          <ul className="setup-screen__player-list">
            {draftPlayers.map((player) => (
              <li key={player.id} className="setup-screen__player-item">
                <label className="setup-screen__player-select">
                  <input
                    type="radio"
                    name="victim"
                    checked={victimId === player.id}
                    onChange={() => setVictimId(player.id)}
                  />
                  <span className="setup-screen__player-name">{player.name}</span>
                </label>
                <button
                  type="button"
                  className="setup-screen__btn-danger"
                  onClick={() => removePlayer(player.id)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="setup-screen__error" role="alert">
          {error}
        </p>
      )}

      <div className="setup-screen__actions">
        <button
          type="button"
          className="setup-screen__btn-primary"
          onClick={startGame}
          disabled={draftPlayers.length < 2 || !victimId}
        >
          ゲーム開始
        </button>
      </div>

      {onBackToTitle && (
        <div className="setup-screen__actions">
          <button type="button" className="setup-screen__btn-secondary" onClick={onBackToTitle}>
            タイトルへ戻る
          </button>
        </div>
      )}
    </section>
  )
}
