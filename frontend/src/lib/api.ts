import type { Game, Player, Room } from './types'

const DEFAULT_API = 'https://api.sabadogames.app'
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

/**
 * `UserSerializer` sempre devolve id, username e email; só o perfil pode
 * faltar, para uma conta criada fora do fluxo normal de cadastro.
 */
export async function getMe(): Promise<{
  user: { id: number; username: string; email: string; profile?: { nickname: string } }
}> {
  return request('/auth/me/')
}

export async function updateProfile(payload: { nickname: string }): Promise<{ profile: { nickname: string } }> {
  return request('/auth/profile/', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function updatePassword(payload: {
  current_password: string
  new_password: string
  confirm_password: string
}): Promise<{ ok: boolean }> {
  return request('/auth/password/', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function listGames(): Promise<Game[]> {
  return request<Game[]>('/games/')
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

export async function listRoomPlayers(code: string): Promise<{ players: Player[] }> {
  return request<{ players: Player[] }>(`/rooms/${code}/players/`)
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

export async function startRoom(
  code: string,
  payload?: { mode?: 'coop' | 'versus'; advanced?: boolean; themes?: string[]; rounds?: number },
): Promise<Room> {
  return request<Room>(`/rooms/${code}/start/`, {
    method: 'POST',
    body: payload ? JSON.stringify(payload) : undefined,
  })
}

export async function endRoom(code: string): Promise<{ status: Room['status'] }> {
  return request<{ status: Room['status'] }>(`/rooms/${code}/end/`, {
    method: 'POST',
  })
}

export async function restartRoom(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/restart/`, {
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

export async function tvPing(code: string, payload?: { device_id?: string }): Promise<{
  ok: boolean
  tv_connected: boolean
  tv_last_seen_at: string
}> {
  return request(`/rooms/${code}/tv_ping/`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
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

export async function betBlefJack(code: string, bet: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/blef_jack_bet/`, {
    method: 'POST',
    body: JSON.stringify({ bet }),
  })
}

export async function declareBlefJack(code: string, declared_value: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/blef_jack_declare/`, {
    method: 'POST',
    body: JSON.stringify({ declared_value }),
  })
}

export async function guessBlefJack(code: string, winner_player_id: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/blef_jack_guess/`, {
    method: 'POST',
    body: JSON.stringify({ winner_player_id }),
  })
}

// --- A Caçada ---------------------------------------------------------------

export async function cacadaSetup(code: string, hex: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/cacada_setup/`, {
    method: 'POST',
    body: JSON.stringify({ hex }),
  })
}

export async function cacadaAsk(
  code: string,
  payload: { target_player_id: number; hex: string },
): Promise<Room> {
  return request<Room>(`/rooms/${code}/cacada_ask/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cacadaSearch(code: string, hex: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/cacada_search/`, {
    method: 'POST',
    body: JSON.stringify({ hex }),
  })
}

export async function cacadaPenalty(code: string, hex: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/cacada_penalty/`, {
    method: 'POST',
    body: JSON.stringify({ hex }),
  })
}

// --- Sintonia ---------------------------------------------------------------

export async function sintoniaClue(code: string, clue: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/sintonia_clue/`, {
    method: 'POST',
    body: JSON.stringify({ clue }),
  })
}

export async function sintoniaGuess(code: string, value: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/sintonia_guess/`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}

export async function tickSintonia(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/sintonia_tick/`, { method: 'POST' })
}

// --- Caveira ----------------------------------------------------------------

export async function caveiraPlace(code: string, card: 'rosa' | 'caveira'): Promise<Room> {
  return request<Room>(`/rooms/${code}/caveira_place/`, {
    method: 'POST',
    body: JSON.stringify({ card }),
  })
}

export async function caveiraBid(code: string, amount: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/caveira_bid/`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

export async function caveiraPass(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/caveira_pass/`, { method: 'POST' })
}

export async function caveiraFlip(code: string, targetPlayerId?: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/caveira_flip/`, {
    method: 'POST',
    body: JSON.stringify(targetPlayerId ? { target_player_id: targetPlayerId } : {}),
  })
}

// --- A Resistência ----------------------------------------------------------

export async function resistenciaPropose(code: string, team: number[]): Promise<Room> {
  return request<Room>(`/rooms/${code}/resistencia_propose/`, {
    method: 'POST',
    body: JSON.stringify({ team }),
  })
}

export async function resistenciaVote(code: string, approve: boolean): Promise<Room> {
  return request<Room>(`/rooms/${code}/resistencia_vote/`, {
    method: 'POST',
    body: JSON.stringify({ approve }),
  })
}

export async function resistenciaMission(code: string, success: boolean): Promise<Room> {
  return request<Room>(`/rooms/${code}/resistencia_mission/`, {
    method: 'POST',
    body: JSON.stringify({ success }),
  })
}

// --- Palavra-Chave ----------------------------------------------------------

export async function palavraChaveClue(code: string, word: string, count: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/palavra_chave_clue/`, {
    method: 'POST',
    body: JSON.stringify({ word, count }),
  })
}

export async function palavraChaveGuess(code: string, index: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/palavra_chave_guess/`, {
    method: 'POST',
    body: JSON.stringify({ index }),
  })
}

export async function palavraChavePass(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/palavra_chave_pass/`, { method: 'POST' })
}

// --- O Infiltrado -----------------------------------------------------------

export async function infiltradoAccuse(code: string, accusedPlayerId: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/infiltrado_accuse/`, {
    method: 'POST',
    body: JSON.stringify({ accused_player_id: accusedPlayerId }),
  })
}

export async function infiltradoVote(code: string, agree: boolean): Promise<Room> {
  return request<Room>(`/rooms/${code}/infiltrado_vote/`, {
    method: 'POST',
    body: JSON.stringify({ agree }),
  })
}

export async function infiltradoSpyGuess(code: string, location: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/infiltrado_spy_guess/`, {
    method: 'POST',
    body: JSON.stringify({ location }),
  })
}

export async function tickInfiltrado(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/infiltrado_tick/`, { method: 'POST' })
}

// --- Perfil -----------------------------------------------------------------

export async function perfilGuess(code: string, guess: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/perfil_guess/`, {
    method: 'POST',
    body: JSON.stringify({ guess }),
  })
}

export async function perfilNext(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/perfil_next/`, { method: 'POST' })
}

export async function tickPerfil(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/perfil_tick/`, { method: 'POST' })
}

// --- Tutorial narrado (o host conduz; TV e celulares acompanham) ---------------

export async function setTutorial(
  code: string,
  payload: { active: boolean; step?: number },
): Promise<{ tutorial: { active: boolean; step: number } | null }> {
  return request(`/rooms/${code}/tutorial/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// --- Camaleão ----------------------------------------------------------------

export async function camaleaoClue(code: string, word: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/camaleao_clue/`, {
    method: 'POST',
    body: JSON.stringify({ word }),
  })
}

export async function camaleaoVote(code: string, targetPlayerId: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/camaleao_vote/`, {
    method: 'POST',
    body: JSON.stringify({ target_player_id: targetPlayerId }),
  })
}

export async function camaleaoGuess(code: string, word: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/camaleao_guess/`, {
    method: 'POST',
    body: JSON.stringify({ word }),
  })
}

export async function tickCamaleao(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/camaleao_tick/`, { method: 'POST' })
}

// --- Lobisomem de Uma Noite -------------------------------------------------

export type LobisomemNightPayload = {
  target_player_id?: number | null
  first_player_id?: number | null
  second_player_id?: number | null
  center_index?: number | null
  center_indexes?: number[]
}

export async function lobisomemNight(code: string, payload: LobisomemNightPayload): Promise<Room> {
  return request<Room>(`/rooms/${code}/lobisomem_night/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function lobisomemVote(code: string, targetPlayerId: number | null): Promise<Room> {
  return request<Room>(`/rooms/${code}/lobisomem_vote/`, {
    method: 'POST',
    body: JSON.stringify({ target_player_id: targetPlayerId }),
  })
}

export async function lobisomemOpenVote(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/lobisomem_open_vote/`, { method: 'POST' })
}

export async function tickLobisomem(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/lobisomem_tick/`, { method: 'POST' })
}

// --- Corrida de Camelos ----------------------------------------------------

export type CamelosTileKind = 'oasis' | 'miragem'
export type CamelosFinalKind = 'winner' | 'loser'

export async function camelosRoll(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/camelos_roll/`, { method: 'POST' })
}

export async function camelosBetLeg(code: string, camel: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/camelos_bet_leg/`, {
    method: 'POST',
    body: JSON.stringify({ camel }),
  })
}

export async function camelosTile(code: string, space: number, kind: CamelosTileKind): Promise<Room> {
  return request<Room>(`/rooms/${code}/camelos_tile/`, {
    method: 'POST',
    body: JSON.stringify({ space, kind }),
  })
}

export async function camelosBetFinal(code: string, camel: string, kind: CamelosFinalKind): Promise<Room> {
  return request<Room>(`/rooms/${code}/camelos_bet_final/`, {
    method: 'POST',
    body: JSON.stringify({ camel, kind }),
  })
}

// --- Não Para ---------------------------------------------------------------

export async function naoParaRoll(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/naopara_roll/`, { method: 'POST' })
}

export async function naoParaChoose(code: string, optionIndex: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/naopara_choose/`, {
    method: 'POST',
    body: JSON.stringify({ option_index: optionIndex }),
  })
}

export async function naoParaStop(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/naopara_stop/`, { method: 'POST' })
}

// --- Palpite Certo ----------------------------------------------------------

export async function palpiteAnswer(code: string, value: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/palpite_answer/`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}

export async function palpiteBet(code: string, slots: number[]): Promise<Room> {
  return request<Room>(`/rooms/${code}/palpite_bet/`, {
    method: 'POST',
    body: JSON.stringify({ slots }),
  })
}

export async function tickPalpite(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/palpite_tick/`, { method: 'POST' })
}

// --- Artista Falso ----------------------------------------------------------

export async function artistaStroke(code: string, points: number[][]): Promise<Room> {
  return request<Room>(`/rooms/${code}/artista_stroke/`, {
    method: 'POST',
    body: JSON.stringify({ points }),
  })
}

export async function artistaVote(code: string, targetPlayerId: number): Promise<Room> {
  return request<Room>(`/rooms/${code}/artista_vote/`, {
    method: 'POST',
    body: JSON.stringify({ target_player_id: targetPlayerId }),
  })
}

export async function artistaGuess(code: string, word: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/artista_guess/`, {
    method: 'POST',
    body: JSON.stringify({ word }),
  })
}

export async function tickArtista(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/artista_tick/`, { method: 'POST' })
}

// --- Bomba-Relógio ----------------------------------------------------------

export async function bombaPass(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/bomba_pass/`, { method: 'POST' })
}

export async function tickBomba(code: string): Promise<Room> {
  return request<Room>(`/rooms/${code}/bomba_tick/`, { method: 'POST' })
}
