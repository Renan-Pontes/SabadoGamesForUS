import { request } from '../../lib/api'
import { AUTO_SCARES } from '../../season'

/** Pedido de visita de Natal sorteada (a TV escolhe; o botão "Surpresa" do host). */
export { CAMEO_RANDOM } from '../scare/cameos'
/** O pedido antigo ('festive'): a TV também o transforma numa visita sorteada. */
export { FESTIVE_RANDOM } from '../scare/bus'

/**
 * O painel do host só mostra o liga/desliga dos sustos aleatórios quando eles
 * existem na temporada (no Natal, AUTO_SCARES = false: o botão some).
 */
export const RANDOM_SCARES_TOGGLE = AUTO_SCARES

/**
 * Efeitos da sala: o host manda um susto ou liga/desliga a música, e a TV
 * executa. Fica num campo próprio da sala (`Room.fx`) para não brigar com o
 * estado do jogo, que só a TV escreve.
 */
export type RoomFx = {
  /** Cresce a cada envio; a TV só executa ids que ainda não viu. */
  id: number
  /** Tipo de susto pedido ('random' deixa a TV escolher). */
  scare?: string | null
  music?: 'on' | 'off' | null
  /** Nome que alguns sustos usam (ex.: o zoom "suspeito" num jogador). */
  name?: string | null
  /** Quando o pedido chegou, em ms do servidor. */
  at?: number
}

export type RoomFxRequest = {
  scare?: string
  music?: 'on' | 'off'
  name?: string
}

/**
 * Valores especiais de `scare` que não assustam: ligam/desligam os sustos
 * aleatórios da TV (o host controla pelo celular).
 */
export const RANDOM_SCARES_ON = 'auto-on'
export const RANDOM_SCARES_OFF = 'auto-off'

export function sendRoomFx(code: string, payload: RoomFxRequest) {
  return request<{ fx: RoomFx }>(`/rooms/${code}/fx/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getRoomFx(code: string) {
  return request<{ fx: RoomFx | Record<string, never>; t: number }>(`/rooms/${code}/fx/`)
}

/**
 * Host: manda um efeito para a TV ('cameo' = visita de Natal sorteada,
 * 'random' = susto de Halloween sorteado; `name` para o duende desconfiado...).
 */
export function scareRoomTv(code: string, kind = 'random', name?: string) {
  return sendRoomFx(code, name ? { scare: kind, name } : { scare: kind })
}

/** Host: liga/desliga a música da TV. */
export function setRoomMusic(code: string, on: boolean) {
  return sendRoomFx(code, { music: on ? 'on' : 'off' })
}

/** Host: liga/desliga os sustos aleatórios da TV. */
export function setRoomRandomScares(code: string, on: boolean) {
  return sendRoomFx(code, { scare: on ? RANDOM_SCARES_ON : RANDOM_SCARES_OFF })
}
