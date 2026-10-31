import { request } from '../../lib/api'

/**
 * Cliente do contrato HTTP da Noite do Terror (ver "Backend (F1)" no
 * HALLOWEEN.md). O backend é um depósito de JSON: o juiz lê e grava
 * `room.state`, cada celular grava o próprio `player.state`.
 *
 * Toda função aceita um `transport` opcional — o padrão é o `request()` do
 * app (com o token da sessão); os testes passam um falso.
 */

export type Transport = <T>(path: string, init?: RequestInit) => Promise<T>

export type RoomStatus = 'lobby' | 'live' | 'ended'

export type SyncPlayer = {
  id: number
  name: string
  is_host: boolean
  ready: boolean
  online: boolean
  joined_at: string
  /** Com `mine=1`, vem null para todo mundo menos eu. */
  state: Record<string, unknown> | null
}

export type SyncRoom = {
  code: string
  status: RoomStatus
  game: { slug: string; name: string; min_players: number; max_players: number } | null
  state: Record<string, unknown> | null
  fx: Record<string, unknown> | null
  tv_connected: boolean
}

export type SyncFull = {
  same: false
  v: number
  t: number
  /** Meu id de jogador nesta sala (null para a TV ou quem não entrou). */
  me: number | null
  room: SyncRoom
  players: SyncPlayer[]
}

/** Resposta barata: a sala ainda está na versão que eu já tenho. */
export type SyncSame = { same: true; v: number; t: number }

export type SyncResponse = SyncFull | SyncSame

export type SyncQuery = {
  /** Versão que eu já tenho; se não mudou, volta `{ same: true }`. */
  v?: number | null
  /** Só o meu `state` vem cheio (economiza a banda dos celulares). */
  mine?: boolean
  /** Marca a TV como conectada. */
  tv?: boolean
}

function roomPath(code: string, rest: string) {
  return `/rooms/${encodeURIComponent(code)}/${rest}`
}

export function fetchSync(code: string, query: SyncQuery = {}, transport: Transport = request): Promise<SyncResponse> {
  const params = new URLSearchParams()
  if (typeof query.v === 'number') params.set('v', String(query.v))
  if (query.mine) params.set('mine', '1')
  if (query.tv) params.set('tv', '1')
  const search = params.toString()
  // no-store: o poll nunca pode receber uma resposta guardada pelo navegador.
  return transport<SyncResponse>(roomPath(code, `sync/${search ? `?${search}` : ''}`), { cache: 'no-store' })
}

/**
 * Só o juiz chama: substitui `room.state` inteiro e sobe a versão. Com
 * `slug`, o backend recusa (409) se a sala já trocou de jogo — um juiz
 * atrasado não atropela o jogo novo.
 */
export function pushRoomState(
  code: string,
  state: Record<string, unknown>,
  status?: RoomStatus,
  options: { slug?: string; transport?: Transport } = {},
): Promise<{ v: number; t: number }> {
  const body: Record<string, unknown> = { state }
  if (status) body.status = status
  if (options.slug) body.slug = options.slug
  return (options.transport ?? request)(roomPath(code, 'sync_room/'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Substitui o `player.state` de quem chama (exige login). Use pelo writer. */
export function postPlayerState(
  code: string,
  state: Record<string, unknown>,
  transport: Transport = request,
): Promise<{ player_id: number; state: Record<string, unknown> }> {
  return transport(roomPath(code, 'state/'), {
    method: 'POST',
    body: JSON.stringify({ state }),
  })
}
