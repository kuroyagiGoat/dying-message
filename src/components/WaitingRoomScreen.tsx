import { useState } from 'react'
import type { RoomLobbyState } from '../hooks/useRoomLobby'
import type { RoomSession } from '../types/online'
import { MIN_ONLINE_PLAYERS, leaveRoom, startOnlineGame } from '../utils/roomService'
import './online-screen.css'

const RANDOM_VICTIM = 'random'

const CONNECTION_LABEL = {
  connecting: '接続中…',
  connected: 'リアルタイム同期中',
  error: '同期が切断されました（「再読み込み」で最新化できます）',
} as const

interface WaitingRoomScreenProps {
  session: RoomSession
  lobby: RoomLobbyState
  onLeft: () => void
}

export function WaitingRoomScreen({ session, lobby, onLeft }: WaitingRoomScreenProps) {
  const { players, connection, error, refresh } = lobby
  const [victimChoice, setVictimChoice] = useState<string>(RANDOM_VICTIM)
  const [pending, setPending] = useState<'start' | 'leave' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const isHost = session.self.is_host
  const canStart = players.length >= MIN_ONLINE_PLAYERS

  const run = async (kind: 'start' | 'leave', action: () => Promise<void>) => {
    setPending(kind)
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '通信に失敗しました。')
    } finally {
      setPending(null)
    }
  }

  const handleStart = () =>
    run('start', async () => {
      await startOnlineGame(
        session,
        players,
        victimChoice === RANDOM_VICTIM ? null : victimChoice,
      )
      // Realtime の通知が遅れてもホスト自身は確実にゲーム画面へ進める
      await refresh()
    })

  const handleLeave = () =>
    run('leave', async () => {
      await leaveRoom(session)
      onLeft()
    })

  return (
    <section className="online-screen">
      <h1 className="online-screen__title">待機中</h1>
      <p className="online-screen__subtitle">{CONNECTION_LABEL[connection]}</p>

      <div className="online-screen__section online-screen__panel online-screen__code-panel">
        <span className="online-screen__label">ルームコード</span>
        <span className="online-screen__room-code">{session.room.code}</span>
        <span className="online-screen__note">このコードを他のプレイヤーに伝えてください。</span>
      </div>

      <div className="online-screen__section">
        <div className="online-screen__row online-screen__row--between">
          <span className="online-screen__label">参加者（{players.length}人）</span>
          <button
            type="button"
            className="online-screen__btn-secondary"
            onClick={() => void refresh()}
          >
            再読み込み
          </button>
        </div>
        <ul className="online-screen__player-list">
          {players.map((player) => (
            <li key={player.id} className="online-screen__player-item">
              <span>{player.name}</span>
              <span className="online-screen__badges">
                {player.is_host && <span className="online-screen__badge">ホスト</span>}
                {player.id === session.self.id && (
                  <span className="online-screen__badge online-screen__badge--self">あなた</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div className="online-screen__section">
          <label className="online-screen__label" htmlFor="online-victim-select">
            被害者（残りのプレイヤーは探偵になります）
          </label>
          <select
            id="online-victim-select"
            className="online-screen__input"
            value={victimChoice}
            onChange={(e) => setVictimChoice(e.target.value)}
            disabled={pending !== null}
          >
            <option value={RANDOM_VICTIM}>ランダムに決める</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(error || actionError) && (
        <p className="online-screen__error" role="alert">
          {actionError ?? error}
        </p>
      )}

      <div className="online-screen__actions">
        {isHost ? (
          <>
            <button
              type="button"
              className="online-screen__btn-primary"
              onClick={() => void handleStart()}
              disabled={!canStart || pending !== null}
            >
              {pending === 'start' ? '開始中…' : 'ゲーム開始'}
            </button>
            {!canStart && (
              <p className="online-screen__note">
                あと{MIN_ONLINE_PLAYERS - players.length}人以上の参加を待っています。
              </p>
            )}
          </>
        ) : (
          <p className="online-screen__note">ホストがゲームを開始するまでお待ちください。</p>
        )}
        <button
          type="button"
          className="online-screen__btn-danger"
          onClick={() => void handleLeave()}
          disabled={pending !== null}
        >
          {isHost ? '部屋を解散する' : '部屋から退出する'}
        </button>
      </div>
    </section>
  )
}
