import { useState, type FormEvent } from 'react'
import type { RoomSession } from '../types/online'
import { MAX_PLAYER_NAME_LENGTH, createRoom, joinRoom } from '../utils/roomService'
import './online-screen.css'

interface OnlineEntryScreenProps {
  onEntered: (session: RoomSession) => void
  onBack: () => void
}

export function OnlineEntryScreen({ onEntered, onBack }: OnlineEntryScreenProps) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [pending, setPending] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (kind: 'create' | 'join', action: () => Promise<RoomSession>) => {
    setPending(kind)
    setError(null)
    try {
      onEntered(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信に失敗しました。')
      setPending(null)
    }
  }

  const handleCreate = () => run('create', () => createRoom(playerName))

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    void run('join', () => joinRoom(roomCode, playerName))
  }

  const busy = pending !== null
  const hasName = playerName.trim().length > 0

  return (
    <section className="online-screen">
      <h1 className="online-screen__title">ダイイングメッセージ</h1>
      <p className="online-screen__subtitle">オンラインモード</p>

      <div className="online-screen__section">
        <label className="online-screen__label" htmlFor="online-player-name">
          あなたの名前
        </label>
        <input
          id="online-player-name"
          className="online-screen__input"
          value={playerName}
          maxLength={MAX_PLAYER_NAME_LENGTH}
          placeholder="名前を入力"
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="online-screen__section online-screen__panel">
        <h2 className="online-screen__heading">部屋を作成する</h2>
        <p className="online-screen__note">4桁のルームコードが発行されます。</p>
        <button
          type="button"
          className="online-screen__btn-primary"
          onClick={() => void handleCreate()}
          disabled={busy || !hasName}
        >
          {pending === 'create' ? '作成中…' : '部屋を作成'}
        </button>
      </div>

      <form className="online-screen__section online-screen__panel" onSubmit={handleJoin}>
        <h2 className="online-screen__heading">部屋に参加する</h2>
        <label className="online-screen__label" htmlFor="online-room-code">
          ルームコード（4桁）
        </label>
        <div className="online-screen__row">
          <input
            id="online-room-code"
            className="online-screen__input online-screen__input--code"
            value={roomCode}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={busy}
          />
          <button
            type="submit"
            className="online-screen__btn-primary"
            disabled={busy || !hasName || roomCode.length !== 4}
          >
            {pending === 'join' ? '参加中…' : '参加'}
          </button>
        </div>
      </form>

      {error && (
        <p className="online-screen__error" role="alert">
          {error}
        </p>
      )}

      <div className="online-screen__actions">
        <button
          type="button"
          className="online-screen__btn-secondary"
          onClick={onBack}
          disabled={busy}
        >
          タイトルへ戻る
        </button>
      </div>
    </section>
  )
}
