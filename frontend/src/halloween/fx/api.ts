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

export function sendRoomFx(code: string, payload: RoomFxRequest) {
  return request<{ fx: RoomFx }>(`/rooms/${code}/fx/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getRoomFx(code: string) {
  return request<{ fx: RoomFx | Record<string, never>; t: number }>(`/rooms/${code}/fx/`)
}
