import type { Game, Player, Room } from './types'

const DEFAULT_API = 'http://localhost:8000'
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? DEFAULT_API
const BASE_URL = `${API_URL.replace(/\/$/, '')}/api`
const TOKEN_KEY = 'sabado_token'

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated() {
  return Boolean(getToken())
}

const mockGames: Game[] = [
  {
    id: 1,
    slug: 'read-my-mind',
    name: 'Read My Mind',
    description: 'Ordene cartas em silêncio: coopere ou elimine no versus.',
    min_players: 2,
    max_players: 10,
    is_active: true,
  },
  {
    id: 2,
    slug: 'confinamento-solitario',
    name: 'Confinamento Solitario: Valete de Copas',
    description: 'Descubra o próprio naipe vendo o dos outros. Errou, sai.',
    min_players: 3,
    max_players: 12,
    is_active: true,
  },
  {
    id: 3,
    slug: 'concurso-de-beleza',
    name: 'Concurso de Beleza: Rei de Ouros',
    description: 'Escolha um número. O alvo é a média * 0.8. Quem chegar mais perto vence.',
    min_players: 3,
    max_players: 12,
    is_active: true,
  },
  {
    id: 4,
    slug: 'future-sugoroku',
    name: 'Future Sugoroku',
    description: 'Role os dados, avance pelas salas e encontre a saída em 15 turnos.',
    min_players: 2,
    max_players: 16,
    is_active: true,
  },
  {
    id: 5,
    slug: 'leilao-de-cem-votos',
    name: 'Leilão de Cem Votos',
    description: 'Aposte pontos para ganhar o pote da rodada. Excedente aumenta o pote seguinte.',
    min_players: 2,
    max_players: 12,
    is_active: true,
  },
  {
    id: 6,
    slug: 'sabado-quiz',
    name: 'Sábado Quiz',
    description: 'Perguntas rápidas para aquecer a galera antes do jogo principal.',
    min_players: 2,
    max_players: 12,
    is_active: true,
  },
  {
    id: 7,
    slug: 'corrida-de-cliques',
    name: 'Corrida de Cliques',
    description: 'Velocidade no celular decide o campeão da rodada.',
    min_players: 2,
    max_players: 8,
    is_active: true,
  },
  {
    id: 8,
    slug: 'desafio-mimica',
    name: 'Desafio Mímica',
    description: 'Jogadores recebem pistas e a TV mostra o tempo rolando.',
    min_players: 3,
    max_players: 10,
    is_active: true,
  },
]

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed (${response.status})`)
  }

  return (await response.json()) as T
}

export async function registerAccount(payload: {
  email: string
  password: string
  nickname: string
}): Promise<{ token: string }> {
  return request<{ token: string }>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function loginAccount(payload: { email: string; password: string }): Promise<{ token: string }> {
  return request<{ token: string }>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getMe(): Promise<{ user: { id?: number; email?: string; profile?: { nickname: string } } }> {
  return request('/auth/me/')
}

export async function updateProfile(payload: { nickname: string }): Promise<{ profile: { nickname: string } }> {
  return request('/auth/profile/', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listGames(): Promise<Game[]> {
  try {
    return await request<Game[]>('/games/')
  } catch (error) {
    console.warn('API offline, usando jogos de demonstração.', error)
    return mockGames
  }
}

export async function createRoom(params: {
  game_id?: number
  game_slug?: string
  host_name?: string
}): Promise<Room> {
  return request<Room>('/rooms/', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getRoom(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/`)
}

export async function joinRoom(code: string, payload: { name?: string; device_id?: string }): Promise<{ player: Player }> {
  return request<{ player: Player }>(`/rooms/${code}/join/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendHeartbeat(code: string, playerId: number): Promise<{ ok: boolean; player_id: number }> {
  return request<{ ok: boolean; player_id: number }>(`/rooms/${code}/heartbeat/`, {
    method: 'POST',
    body: JSON.stringify({ player_id: playerId }),
  })
}

export async function startRoom(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/start/`, {
    method: 'POST',
  })
}

export async function endRoom(code: string): Promise<{ status: Room['status'] }> {
  return request<{ status: Room['status'] }>(`/rooms/${code}/end/`, {
    method: 'POST',
  })
}

export async function changeRoomGame(code: string, payload: { game_id?: number; game_slug?: string }): Promise<Room> {
  return request<Room>(`/rooms/${code}/change_game/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function setReady(code: string, ready: boolean): Promise<{ player_id: number; ready: boolean }> {
  return request<{ player_id: number; ready: boolean }>(`/rooms/${code}/ready/`, {
    method: 'POST',
    body: JSON.stringify({ ready }),
  })
}

export async function updatePlayerState(
  code: string,
  state: Record<string, unknown>,
): Promise<{ player_id: number; state: Record<string, unknown> }> {
  return request<{ player_id: number; state: Record<string, unknown> }>(`/rooms/${code}/state/`, {
    method: 'POST',
    body: JSON.stringify({ state }),
  })
}

export async function setReadMyMindMode(code: string, mode: 'coop' | 'versus'): Promise<Room> {
  return request<Room>(`/rooms/${code}/read_my_mind_mode/`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}

export async function playReadMyMindCard(code: string, card: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/read_my_mind_play/`, {
    method: 'POST',
    body: JSON.stringify({ card }),
  })
}

export async function tickReadMyMind(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/read_my_mind_tick/`, {
    method: 'POST',
  })
}

export async function submitConfinamentoGuess(code: string, guess: 'hearts' | 'diamonds' | 'clubs' | 'spades'): Promise<Room> {
  return request<Room>(`/rooms/${code}/confinamento_guess/`, {
    method: 'POST',
    body: JSON.stringify({ guess }),
  })
}

export async function tickConfinamento(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/confinamento_tick/`, {
    method: 'POST',
  })
}

export async function submitBelezaGuess(code: string, value: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/beleza_guess/`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}

export async function tickBeleza(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/beleza_tick/`, {
    method: 'POST',
  })
}

export async function rollSugoroku(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/sugoroku_roll/`, {
    method: 'POST',
  })
}

export async function moveSugoroku(
  code: string,
  payload: { action: 'move' | 'stay' | 'back'; direction?: 'N' | 'S' | 'E' | 'W' },
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/rooms/${code}/sugoroku_move/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function unlockSugoroku(code: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/rooms/${code}/sugoroku_unlock/`, {
    method: 'POST',
    body: JSON.stringify({ ready: true }),
  })
}

export async function tickSugoroku(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/sugoroku_tick/`, {
    method: 'POST',
  })
}

export async function chooseSugorokuPenalty(code: string, target_player_id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/rooms/${code}/sugoroku_penalty_choice/`, {
    method: 'POST',
    body: JSON.stringify({ target_player_id }),
  })
}

export async function bidLeilao(code: string, bid: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/rooms/${code}/leilao_bid/`, {
    method: 'POST',
    body: JSON.stringify({ bid }),
  })
}

export async function tickLeilao(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/leilao_tick/`, {
    method: 'POST',
  })
}
