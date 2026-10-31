import { fuseLeftAt, heatRate, type AbbState } from './engine'

/**
 * Contas pequenas das telas da Abóbora-Bomba (TV e celular). Ficam fora de
 * `Tv.tsx`/`Phone.tsx` porque esses arquivos só exportam o componente.
 */

/** O tique-taque da TV começa quando o pavio de quem segura chega aqui. */
export const TICK_FROM_MS = 5000
/** Quanto tempo a explosão cobre a TV antes do placar aparecer. */
export const BOOM_REVEAL_MS = 3600
/** Passou com menos que isto de pavio: "passou por um fio!" na TV… */
export const CLOSE_CALL_MS = 1000
/** …durante os primeiros segundos da posse seguinte. */
export const CLOSE_CALL_SHOW_MS = 2500

/** ❤️❤️🖤 — ou 👻 para quem virou fantasma. */
export function heartsText(lives: number, max: number): string {
  if (lives <= 0) return '👻'
  return '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, max - lives))
}

/** Segundos inteiros para mostrar (para cima: 0,2 s ainda é "1"). */
export function secondsOf(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000))
}

/** Quanto do pavio de alguém sobra agora (0..1), para desenhar a corda. */
export function fuseFraction(state: AbbState, id: number, now: number): number {
  if (state.fuseMs <= 0) return 0
  return Math.max(0, Math.min(1, fuseLeftAt(state, id, now) / state.fuseMs))
}

/** "1,5×" */
export function heatLabel(heat: number): string {
  return `${String(heatRate(heat)).replace('.', ',')}×`
}

/** "34 s" de pavio poupado. */
export function savedText(ms: number): string {
  return `${Math.round(ms / 1000)} s`
}

export type Point = { x: number; y: number }

/**
 * A mesa da TV é um retângulo de cantos redondos, e os assentos ficam
 * espaçados por igual no contorno (numa elipse, com 15 pessoas, os das
 * laterais se amontoavam). As contas são em "alturas do palco": a largura
 * vale STAGE_ASPECT — a proporção típica do palco numa TV 16:9.
 */
export const STAGE_ASPECT = 2.3
/** Centros dos assentos: de 7% a 93% da largura e de 10% a 90% da altura. */
const HALF_W = 0.43 * STAGE_ASPECT
const HALF_H = 0.4
const CORNER = 0.2

type Segment = { length: number; at: (d: number) => [number, number] }

const EDGE_W = HALF_W - CORNER
const EDGE_H = HALF_H - CORNER
const ARC = (Math.PI / 2) * CORNER

function arcAt(cx: number, cy: number, from: number) {
  return (d: number): [number, number] => {
    const angle = from + d / CORNER
    return [cx + CORNER * Math.cos(angle), cy + CORNER * Math.sin(angle)]
  }
}

/** O contorno a partir do meio de cima, no sentido horário (a ordem dos passes). */
const SEGMENTS: Segment[] = [
  { length: EDGE_W, at: (d) => [d, -HALF_H] },
  { length: ARC, at: arcAt(EDGE_W, -EDGE_H, -Math.PI / 2) },
  { length: 2 * EDGE_H, at: (d) => [HALF_W, -EDGE_H + d] },
  { length: ARC, at: arcAt(EDGE_W, EDGE_H, 0) },
  { length: 2 * EDGE_W, at: (d) => [EDGE_W - d, HALF_H] },
  { length: ARC, at: arcAt(-EDGE_W, EDGE_H, Math.PI / 2) },
  { length: 2 * EDGE_H, at: (d) => [-HALF_W, EDGE_H - d] },
  { length: ARC, at: arcAt(-EDGE_W, -EDGE_H, Math.PI) },
  { length: EDGE_W, at: (d) => [-EDGE_W + d, -HALF_H] },
]
const PERIMETER = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0)

/** Lugar do assento `index` (de `count`) na mesa, em % do palco. */
export function seatPosition(index: number, count: number): Point {
  const total = Math.max(1, count)
  let d = (PERIMETER * (((index % total) + total) % total)) / total
  for (const segment of SEGMENTS) {
    if (d <= segment.length) {
      const [px, py] = segment.at(d)
      return { x: 50 + (px / STAGE_ASPECT) * 100, y: 50 + py * 100 }
    }
    d -= segment.length
  }
  return { x: 50, y: 50 - HALF_H * 100 }
}

/** Um ponto entre o assento e o centro da mesa (onde a abóbora pousa). */
export function towardCenter(point: Point, amount: number): Point {
  return { x: point.x + (50 - point.x) * amount, y: point.y + (50 - point.y) * amount }
}

/** Vibra o celular, se der (computador e iPhone não vibram — tudo bem). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
  } catch {
    // Sem vibração: segue o jogo.
  }
}
