import { useCallback, useEffect, useState } from 'react'
import { useRoomLobby } from '../hooks/useRoomLobby'
import type { RoomSession } from '../types/online'
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredOnlineSession,
} from '../utils/onlineSessionStore'
import { restoreRoomSession } from '../utils/roomService'
import { OnlineEntryScreen } from './OnlineEntryScreen'
import { OnlineGameScreen } from './OnlineGameScreen'
import { WaitingRoomScreen } from './WaitingRoomScreen'
import './online-screen.css'

interface OnlineModeScreenProps {
  onBackToTitle: () => void
}

function OnlineRoom({ session, onLeft }: { session: RoomSession; onLeft: () => void }) {
  const lobby = useRoomLobby(session)
  const { room } = lobby

  useEffect(() => {
    if (room.status === 'closed') clearStoredSession()
  }, [room.status])

  if (room.status === 'closed' && !session.self.is_host) {
    return (
      <section className="online-screen">
        <h1 className="online-screen__title">部屋が解散されました</h1>
        <p className="online-screen__subtitle">ホストが部屋を閉じました。</p>
        <div className="online-screen__actions">
          <button type="button" className="online-screen__btn-primary" onClick={onLeft}>
            タイトルへ戻る
          </button>
        </div>
      </section>
    )
  }

  if (room.status === 'playing' && room.game_state) {
    return (
      <OnlineGameScreen
        session={session}
        room={room}
        gameState={room.game_state}
        players={lobby.players}
        onLeft={onLeft}
      />
    )
  }

  return <WaitingRoomScreen session={session} lobby={lobby} onLeft={onLeft} />
}

function RestoringScreen({
  error,
  onRetry,
  onAbandon,
}: {
  error: string | null
  onRetry: () => void
  onAbandon: () => void
}) {
  return (
    <section className="online-screen">
      <h1 className="online-screen__title">再接続中</h1>
      {error ? (
        <>
          <p className="online-screen__error" role="alert">
            {error}
          </p>
          <div className="online-screen__actions">
            <button type="button" className="online-screen__btn-primary" onClick={onRetry}>
              再試行
            </button>
            <button type="button" className="online-screen__btn-secondary" onClick={onAbandon}>
              再接続をやめてタイトルへ戻る
            </button>
          </div>
        </>
      ) : (
        <p className="online-screen__subtitle" role="status">
          前回参加していた部屋に再接続しています…
        </p>
      )}
    </section>
  )
}

export function OnlineModeScreen({ onBackToTitle }: OnlineModeScreenProps) {
  const [stored, setStored] = useState<StoredOnlineSession | null>(loadStoredSession)
  const [session, setSession] = useState<RoomSession | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  const abandonStored = useCallback(() => {
    clearStoredSession()
    setStored(null)
    onBackToTitle()
  }, [onBackToTitle])

  useEffect(() => {
    if (!stored || session) return
    let cancelled = false
    setRestoreError(null)
    restoreRoomSession(stored)
      .then((restored) => {
        if (cancelled) return
        if (restored) {
          setSession(restored)
        } else {
          abandonStored()
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setRestoreError(e instanceof Error ? e.message : '再接続に失敗しました。')
      })
    return () => {
      cancelled = true
    }
  }, [stored, session, restoreAttempt, abandonStored])

  const handleEntered = (entered: RoomSession) => {
    saveStoredSession(entered)
    setSession(entered)
  }

  const handleLeft = () => {
    clearStoredSession()
    setStored(null)
    setSession(null)
  }

  if (session) {
    return <OnlineRoom session={session} onLeft={handleLeft} />
  }

  if (stored) {
    return (
      <RestoringScreen
        error={restoreError}
        onRetry={() => setRestoreAttempt((n) => n + 1)}
        onAbandon={abandonStored}
      />
    )
  }

  return <OnlineEntryScreen onEntered={handleEntered} onBack={onBackToTitle} />
}
