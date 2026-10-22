import type { RoomSession } from '../types/online'

const STORAGE_KEY = 'dying_message_session'

/** リロード後の再接続に必要な最小限の情報。token が無いと RPC の本人確認を通れない */
export interface StoredOnlineSession {
  roomId: string
  playerId: string
  token: string
}

function isStoredOnlineSession(value: unknown): value is StoredOnlineSession {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.roomId === 'string' && typeof v.playerId === 'string' && typeof v.token === 'string'
}

export function loadStoredSession(): StoredOnlineSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isStoredOnlineSession(parsed)) return parsed
  } catch {
    // 壊れた値は破棄する
  }
  clearStoredSession()
  return null
}

export function saveStoredSession(session: RoomSession): void {
  const value: StoredOnlineSession = {
    roomId: session.room.id,
    playerId: session.self.id,
    token: session.token,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('セッション情報を保存できませんでした。', e)
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage が使えない環境では何もしない
  }
}
