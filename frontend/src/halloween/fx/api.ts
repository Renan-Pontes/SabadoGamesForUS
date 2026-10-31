import { request } from '../../lib/api'

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

/** Host: "😱 Assustar a TV" (sem tipo = a TV sorteia; `name` para o zoom/olhos). */
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
