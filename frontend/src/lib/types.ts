export type Game = {
  id: number
  slug: string
  name: string
  description: string
  min_players: number
  max_players: number
  is_active: boolean
}

/**
 * Conta como o backend devolve (`UserSerializer`). Conta de convidado (entrou
 * só com apelido) vem com `email` vazio; o perfil pode faltar numa conta
 * criada fora do fluxo normal de cadastro.
 */
export type AuthUser = {
  id: number
  username: string
  email: string
  profile?: { nickname: string } | null
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
  has_guessed?: boolean | null
  is_valete?: boolean
  public_guess?: string | null
  online?: boolean
  joined_at: string
  last_seen_at: string
  state?: Record<string, unknown>
}

/**
 * Último pedido de efeito da sala (susto, música). É um evento, não um
 * estado: `music` só vem preenchido quando o último pedido foi de música.
 */
export type RoomFxEvent = {
  id: number
  scare?: string | null
  music?: 'on' | 'off' | null
  name?: string | null
  at?: number
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
  /** Sobe a cada mudança na sala (Noite do Terror). */
  version?: number
  fx?: RoomFxEvent | Record<string, never> | null
}
