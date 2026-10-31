import type { MusicTrack } from '../../audio'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HInput, HPlayer } from '../../engine/types'
import { MAX_POINTS, countPoints, readDrawing, type Stroke } from './drawing'
import { ANSWER_PHASES, DRAW_SLOT, PHASE_SECONDS, drawKeys, type RaPhase, type State } from './engine'

/**
 * Peças pequenas que a TV e o celular do "Retrato Assombrado" dividem (as
 * telas só exportam o componente — regra do react-refresh).
 */

type Slots = Record<string, Record<number, HInput | undefined>>

/** Como um retrato aparece na galeria. */
export type PortraitTone = 'plain' | 'impostor' | 'accused' | 'dim'

/** Quanto a TV espera, na revelação, entre o rufar e o veredito (ms). */
export const VERDICT_DELAY_MS = 2600

/** Trilha de cada fase: swing assombrado para desenhar, tensão para votar e revelar. */
export function trackFor(phase: RaPhase): MusicTrack {
  return phase === 'vote' || phase === 'reveal' || phase === 'guess' ? 'tension' : 'party'
}

/** Fase de resposta? (o prazo tem 2 s de folga escondidos) */
export function isAnswerPhase(phase: RaPhase): boolean {
  return ANSWER_PHASES.includes(phase)
}

/** A folga que a tela esconde do relógio nesta fase. */
export function graceFor(phase: RaPhase): number {
  return isAnswerPhase(phase) ? GRACE_MS : 0
}

/** Prazo como a tela mostra: nas fases de resposta, sem a folga. */
export function shownDeadline(state: State): number | null {
  if (typeof state.deadline !== 'number') return null
  return state.deadline - graceFor(state.phase)
}

/** Duração cheia da fase em ms (a vela cheia). */
export function phaseTotalMs(phase: RaPhase): number {
  return (PHASE_SECONDS[phase] ?? 10) * 1000
}

/** O slot de desenho de alguém, se for desta rodada. */
export function drawSlotOf(slots: Slots, id: number, round: number): HInput | null {
  const input = slots[DRAW_SLOT]?.[id]
  return input && drawKeys(round).includes(input.k) ? input : null
}

/** O desenho de alguém nesta rodada (vazio se ainda não desenhou nada). */
export function drawingOf(slots: Slots, id: number, round: number): Stroke[] {
  return readDrawing(drawSlotOf(slots, id, round)?.s)
}

/** Na 2ª etapa, quantos traços vieram da 1ª (esses não dá para desfazer). */
export function lockedStrokes(slot: HInput | null, round: number, total: number): number {
  if (!slot) return 0
  if (slot.k === drawKeys(round)[0]) return total
  const n1 = slot.n1
  return typeof n1 === 'number' && Number.isInteger(n1) ? Math.max(0, Math.min(total, n1)) : 0
}

/** O que a prancheta do celular mostra e deixa fazer agora. */
export type DrawView = {
  /** 1 ou 2 nas etapas de desenho; 0 na espiadinha e na galeria (só olhar). */
  stage: 0 | 1 | 2
  /** O desenho como o servidor tem (o último envio). */
  sent: Stroke[]
  /** O desenho na tela: os traços que esperam o próximo envio, ou o último envio. */
  strokes: Stroke[]
  /** Da 2ª etapa em diante, quantos traços vieram da 1ª (não dá para desfazê-los); null antes. */
  n1: number | null
  /** Apertou "Pronto" nesta etapa. */
  done: boolean
  canDraw: boolean
  /** A tinta acabou (teto de pontos). */
  full: boolean
}

/**
 * A prancheta do celular, sem React (testável): `slot` é o meu slot 'draw'
 * cru (o de outra rodada é ignorado); `pending`, os traços que ainda
 * esperam o próximo envio (o freio do SEND_GAP_MS).
 */
export function drawView(
  state: Pick<State, 'phase' | 'round' | 'inputKey'>,
  slot: HInput | null | undefined,
  pending: Stroke[] | null,
): DrawView {
  const mineNow = slot && drawKeys(state.round).includes(slot.k) ? slot : null
  const stage = state.phase === 'draw1' ? 1 : state.phase === 'draw2' ? 2 : 0
  const secondHalf = state.phase === 'draw2' || state.phase === 'gallery'
  const sent = readDrawing(mineNow?.s)
  const strokes = pending ?? sent
  // Trava só o que já foi enviado: traço da 2ª etapa ainda na fila não vira "da 1ª".
  const n1 = secondHalf ? lockedStrokes(mineNow, state.round, sent.length) : null
  const done = stage > 0 && mineNow?.k === state.inputKey && mineNow.done === true
  return { stage, sent, strokes, n1, done, canDraw: stage > 0 && !done, full: countPoints(strokes) >= MAX_POINTS - 1 }
}

/** Colunas da galeria: o maior retrato possível numa TV 16:9. */
export function galleryColumns(count: number): number {
  if (count <= 2) return Math.max(1, count)
  if (count === 3) return 3
  if (count === 4) return 2
  if (count <= 6) return 3
  if (count <= 8) return 4
  if (count <= 10) return 5
  if (count <= 12) return 4
  return 5
}

/** Vibração curta ao enviar (desktop e iPhone não vibram: tudo bem). */
export function buzz(ms = 30): void {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Sem vibração neste aparelho.
  }
}

/** "1 ponto" / "3 pontos". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "Ana, Bia e Caio". */
export function namesOf(players: readonly HPlayer[], ids: readonly number[]): string {
  return listNames(ids.map((id) => nameOf(players, id)))
}

/** Uma frase do veredito da rodada, para TV e celular falarem a mesma língua. */
export function verdictText(state: State, players: readonly HPlayer[]): { icon: string; title: string; detail: string } {
  const reveal = state.reveal
  if (!reveal) return { icon: '🗳️', title: 'Contando os votos…', detail: '' }
  const impostorNames = namesOf(players, reveal.impostors)
  const many = reveal.impostors.length > 1
  if (reveal.chaos === 'everyone') {
    return { icon: '🤡', title: 'TODO MUNDO ERA IMPOSTOR!', detail: 'Ninguém sabia a palavra. Não tinha palavra nenhuma!' }
  }
  if (reveal.chaos === 'nobody') {
    const top = reveal.top.length ? namesOf(players, reveal.top) : null
    return {
      icon: '😇',
      title: 'NINGUÉM ERA IMPOSTOR!',
      detail: top ? `Todo mundo sabia a palavra. ${top} leva +2 de consolação.` : 'Todo mundo sabia a palavra. E ninguém votou!',
    }
  }
  if (reveal.accused === null) {
    return {
      icon: '🤝',
      title: reveal.tally.length ? 'EMPATE! Ninguém foi acusado' : 'Ninguém votou!',
      detail: `${many ? 'Os impostores eram' : 'O impostor era'} ${impostorNames} — ${many ? 'escaparam' : 'escapou'}! 🤫`,
    }
  }
  const accused = nameOf(players, reveal.accused)
  if (reveal.caught) {
    const other = reveal.impostors.filter((id) => id !== reveal.accused)
    return {
      icon: '😱',
      title: `${accused} ERA IMPOSTOR!`,
      detail: other.length
        ? `E ${namesOf(players, other)} também era — e escapou! 🤫`
        : 'Mas ainda dá para salvar a honra: adivinhando a palavra.',
    }
  }
  return {
    icon: '😇',
    title: `${accused} ERA INOCENTE!`,
    detail: `${many ? 'Os impostores eram' : 'O impostor era'} ${impostorNames} — ${many ? 'escaparam' : 'escapou'}! 🤫`,
  }
}
