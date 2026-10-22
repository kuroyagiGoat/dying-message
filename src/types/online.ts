import type { GameState } from './game'

export type RoomStatus = 'waiting' | 'playing' | 'closed'

/** rooms.game_state に保存し全員へ同期する状態。正解（secretAnswer）は含めない */
export type OnlineGameState = Pick<
  GameState,
  | 'phase'
  | 'boardCards'
  | 'excludedCardIds'
  | 'hintMessagesByCategory'
  | 'explorationCounter'
  | 'victimHintHand'
  | 'usedHintCardIds'
  | 'initialHintsComplete'
  | 'deductionHistory'
  | 'selectedCardsForRemoval'
  | 'roundResult'
  | 'victimTurnSkipNotice'
>

export interface Room {
  id: string
  code: string
  status: RoomStatus
  host_player_id: string
  victim_player_id: string | null
  game_state: OnlineGameState | null
  created_at: string
}

export interface RoomPlayer {
  id: string
  room_id: string
  name: string
  is_host: boolean
  joined_at: string
}

/** この端末が参加している部屋と、この端末のプレイヤー情報 */
export interface RoomSession {
  room: Room
  self: RoomPlayer
  /** 本人確認用トークン（DB にはハッシュのみ保存し、再接続用にこの端末の localStorage にだけ保持する） */
  token: string
}
