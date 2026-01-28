export type Game = {
  id: number
  slug: string
  name: string
  description: string
  min_players: number
  max_players: number
  is_active: boolean
}

export type Player = {
  id: number
  name: string
  user?: {
    id: number
    username: string
    email: string
    profile?: {
      nickname: string
    }
  }
  device_id: string
  is_host: boolean
  ready: boolean
  online?: boolean
  joined_at: string
  last_seen_at: string
  state?: Record<string, unknown>
}

export type Room = {
  id: number
  code: string
  game: Game
  status: 'lobby' | 'live' | 'ended'
  created_at: string
  last_activity_at: string
  tv_last_seen_at?: string | null
  tv_connected?: boolean
  players?: Player[]
  state?: Record<string, unknown>
}
