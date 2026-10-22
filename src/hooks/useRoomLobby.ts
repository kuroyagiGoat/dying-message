import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabase'
import type { Room, RoomPlayer, RoomSession } from '../types/online'
import { fetchRoom, fetchRoomPlayers } from '../utils/roomService'

export type LobbyConnection = 'connecting' | 'connected' | 'error'

export interface RoomLobbyState {
  room: Room
  players: RoomPlayer[]
  connection: LobbyConnection
  error: string | null
  refresh: () => Promise<void>
}

/** 部屋の状態（status / game_state）と参加者一覧を Supabase Realtime で購読する */
export function useRoomLobby(session: RoomSession): RoomLobbyState {
  const roomId = session.room.id
  const [room, setRoom] = useState<Room>(session.room)
  const [players, setPlayers] = useState<RoomPlayer[]>([session.self])
  const [connection, setConnection] = useState<LobbyConnection>('connecting')
  const [error, setError] = useState<string | null>(null)

  const refreshPlayers = useCallback(async () => {
    try {
      setPlayers(await fetchRoomPlayers(roomId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '参加者一覧の取得に失敗しました。')
    }
  }, [roomId])

  const refresh = useCallback(async () => {
    try {
      const [latestRoom, latestPlayers] = await Promise.all([
        fetchRoom(roomId),
        fetchRoomPlayers(roomId),
      ])
      setRoom(latestRoom)
      setPlayers(latestPlayers)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '部屋情報の取得に失敗しました。')
    }
  }, [roomId])

  useEffect(() => {
    const supabase = getSupabase()
    const channel = supabase
      .channel(`room-lobby:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        () => void refreshPlayers(),
      )
      // DELETE イベントは filter が効かないため、全件受けて再取得する
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_players' },
        () => void refreshPlayers(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('connected')
          // 購読開始前に起きた変更（参加・ゲーム開始など）を取りこぼさないよう最新化する
          void refresh()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('error')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, refresh, refreshPlayers])

  return { room, players, connection, error, refresh }
}
