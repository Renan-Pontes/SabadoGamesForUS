import type { Card, GamePhase, GameState, Player } from './types'

/**
 * Leitura do estado para as telas da Mente Natalina. Tudo puro (sem React,
 * sem relógio): as telas desenham o que sai daqui e os testes conferem.
 * As regras continuam todas no servidor.
 */

/** Mão em ordem crescente: a primeira é sempre a próxima a jogar. */
export function sortedHand(cards: readonly number[]): number[] {
  return [...cards].sort((a, b) => a - b)
}

export function cardWord(count: number): string {
  return count === 1 ? 'carta' : 'cartas'
}

/** Quantas cartas ainda estão nas mãos de quem segue no jogo. */
export function cardsLeft(state: GameState): number {
  return state.players.filter((p) => !p.isEliminated).reduce((sum, p) => sum + p.cards.length, 0)
}

export function nameOf(state: GameState, id: string | null | undefined): string {
  if (!id) return 'Alguém'
  return state.players.find((p) => p.id === id)?.name ?? 'Alguém'
}

/**
 * Dispersão determinística (0..1): parece sorteio, mas é sempre igual para
 * a mesma entrada — a pilha não "pula" a cada poll e o render fica puro.
 */
export function scatter(seed: number, salt = 0): number {
  const hashed = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return hashed - Math.floor(hashed)
}

/** Posição de uma carta já jogada na pilha do centro da mesa (graus e em). */
export function pileTilt(value: number, index: number): { rotate: number; x: number; y: number } {
  return {
    rotate: Math.round((scatter(value, index + 1) - 0.5) * 34),
    x: Math.round((scatter(value, index + 7) - 0.5) * 18) / 10,
    y: Math.round((scatter(value, index + 13) - 0.5) * 12) / 10,
  }
}

/**
 * Índices das cartas da pilha que foram jogadas cedo demais: depois delas
 * caiu uma carta menor (no co-op a carta errada volta para a mão de quem
 * tinha a menor e é jogada de novo depois).
 */
export function mistakeIndexes(played: readonly Card[]): Set<number> {
  const out = new Set<number>()
  let lowestAfter = Number.POSITIVE_INFINITY
  for (let i = played.length - 1; i >= 0; i -= 1) {
    if (lowestAfter < played[i].value) out.add(i)
    lowestAfter = Math.min(lowestAfter, played[i].value)
  }
  return out
}

export type HiddenCard = { playerId: string; name: string; value: number }

export type Mistake = {
  /** Muda a cada erro novo (rodada + tamanho da pilha + carta). */
  key: string
  cutterId: string
  cutterName: string
  /** A carta que foi jogada cedo demais. */
  card: number
  /** As cartas menores que ainda estavam escondidas nas mãos (ordem crescente). */
  hidden: HiddenCard[]
  /** Quem tinha a menor carta (o servidor chama de "cortado"). */
  victimId: string | null
  victimName: string | null
  coop: boolean
}

/** O erro da última jogada, se a última jogada foi um erro. */
export function mistakeOf(state: GameState): Mistake | null {
  const cutterId = state.lastCutterPlayer
  const top = state.playedCards[state.playedCards.length - 1]
  if (!cutterId || !top) return null
  const hidden = state.players
    .filter((p) => !p.isEliminated)
    .flatMap((p) => p.cards.filter((value) => value < top.value).map((value) => ({ playerId: p.id, name: p.name, value })))
    .sort((a, b) => a.value - b.value)
  const victimId = state.lastCutPlayer
  return {
    key: `${state.round}-${state.playedCards.length}-${top.value}`,
    cutterId,
    cutterName: nameOf(state, cutterId),
    card: top.value,
    hidden,
    victimId,
    victimName: victimId ? nameOf(state, victimId) : null,
    coop: state.mode === 'coop',
  }
}

/**
 * O erro, falado: curto e sem número (os números e a piada ficam na tela,
 * em `mistakeLine`).
 */
export function mistakeSpoken(m: Mistake): string {
  const low = m.hidden[0]
  if (low && low.playerId === m.cutterId) return `Ops! ${m.cutterName} tinha uma carta menor na própria mão.`
  if (low) return `Ops! ${low.name} ainda tinha uma carta menor.`
  return `Ops! ${m.cutterName} se adiantou.`
}

/** Frase engraçada do erro (só na tela; a voz fala `mistakeSpoken`). */
export function mistakeLine(m: Mistake): string {
  const low = m.hidden[0]
  if (!low) {
    if (m.victimName && m.victimId !== m.cutterId) {
      return m.coop
        ? `Opa! ${m.cutterName} se adiantou e ${m.victimName} ainda tinha uma carta menor!`
        : `${m.cutterName} se adiantou e levou ${m.victimName} junto pro boneco de neve!`
    }
    return `Opa! ${m.cutterName} se adiantou!`
  }
  if (low.playerId === m.cutterId) {
    return `${m.cutterName} jogou ${m.card}... mas tinha ${low.value} na própria mão!`
  }
  const lines = [
    `Opa! ${m.cutterName} jogou ${m.card}, mas ${low.name} ainda tinha ${low.value}!`,
    `${m.cutterName} se adiantou! O ${low.value} estava escondido com ${low.name}.`,
    `O Papai Noel viu tudo: ${low.name} estava segurando o ${low.value}!`,
    `Calma, ${m.cutterName}! Ainda tinha ${low.value} na mão de ${low.name}.`,
  ]
  return lines[Math.floor(scatter(m.card, m.hidden.length) * lines.length)]
}

/** Situação do nível para a TV e para o celular. */
export function levelDone(state: GameState): boolean {
  return state.phase === 'roundBreak' || (state.phase === 'gameOver' && Boolean(state.winner) && state.mode === 'coop')
}

/** Portas abertas do calendário do Advento (níveis vencidos). */
export function doorsOpen(state: GameState): number {
  if (state.phase === 'waiting') return 0
  if (levelDone(state)) return Math.min(state.round, state.maxRounds)
  return Math.max(0, Math.min(state.round - 1, state.maxRounds))
}

/** É a pausa depois do último nível (o servidor encerra em seguida)? */
export function finalBreak(state: GameState): boolean {
  return state.phase === 'roundBreak' && state.round >= state.maxRounds
}

// ---------------------------------------------------------------------------
// Momentos da mesa: o que mudou entre dois polls (a TV toca som disso)
// ---------------------------------------------------------------------------

export type TableSnap = {
  round: number
  phase: GamePhase
  played: number
  top: number | null
  lives: number
  eliminated: number
  mistake: string | null
  /** O erro, como a TV fala. */
  mistakeSpoken: string
  winner: string | null
  winnerName: string
  mode: GameState['mode']
}

export function snapOf(state: GameState): TableSnap {
  const m = mistakeOf(state)
  const top = state.playedCards[state.playedCards.length - 1]
  return {
    round: state.round,
    phase: state.phase,
    played: state.playedCards.length,
    top: top ? top.value : null,
    lives: state.lives,
    eliminated: state.players.filter((p) => p.isEliminated).length,
    mistake: m?.key ?? null,
    mistakeSpoken: m ? mistakeSpoken(m) : '',
    winner: state.winner,
    winnerName: state.winner && state.winner !== 'team' ? nameOf(state, state.winner) : '',
    mode: state.mode,
  }
}

export type TableEvent = 'start' | 'card' | 'cut' | 'timeout' | 'levelDone' | 'newLevel' | 'win' | 'lose'

/** Eventos entre dois retratos da mesa, na ordem em que devem soar. */
export function eventsBetween(before: TableSnap, after: TableSnap): TableEvent[] {
  const events: TableEvent[] = []
  const restarted =
    after.phase !== 'gameOver' &&
    after.phase !== 'waiting' &&
    (before.phase === 'waiting' || before.phase === 'gameOver' || after.round < before.round)
  if (restarted) return ['start']

  const cut = Boolean(after.mistake) && after.mistake !== before.mistake
  const sameRound = after.round === before.round
  if (cut) events.push('cut')
  else if (after.phase === 'playing' && sameRound && after.played > before.played) events.push('card')

  const lostLife = after.mode === 'coop' && after.lives < before.lives
  const lostPlayer = after.mode === 'versus' && after.eliminated > before.eliminated
  if (!cut && (lostLife || lostPlayer)) events.push('timeout')

  if (after.phase === 'gameOver' && before.phase !== 'gameOver') {
    events.push(after.winner ? 'win' : 'lose')
    return events
  }
  if (after.phase === 'roundBreak' && before.phase !== 'roundBreak') events.push('levelDone')
  else if (after.phase === 'playing' && after.round > before.round) events.push('newLevel')
  return events
}

// Falas da TV: poucas e curtas. A carta jogada não é lida (o número está na
// mesa e a voz repetindo número a cada carta soava robótica); só começo de
// nível, erro, nível vencido e fim.

export function levelDoneLine(round: number, maxRounds: number): string {
  if (round >= maxRounds) return 'Último nível completo!'
  return `Nível ${round} completo!`
}

export function newLevelLine(round: number): string {
  return round === 1 ? 'Valendo! Joguem as cartas em ordem, sem falar nada.' : `Nível ${round}. Valendo!`
}

export function finalLine(snap: Pick<TableSnap, 'winner' | 'winnerName' | 'mode'>): string {
  if (!snap.winner) return snap.mode === 'coop' ? 'Acabaram os enfeites. Fim de jogo!' : 'Fim de jogo!'
  if (snap.winner === 'team') return 'Vitória! Vocês jogaram em total sintonia.'
  return `${snap.winnerName} venceu! Feliz Natal!`
}

/** Ninguém jogou a tempo: no co-op cai um enfeite; no contra, alguém sai. */
export const TIMEOUT_LINE = 'Demoraram demais! Perderam um enfeite.'
export const TIMEOUT_VERSUS_LINE = 'O tempo acabou! Alguém saiu do jogo.'

export type TableSpeech = { ms: number; text: string; minor: boolean }
type SnapWithMax = TableSnap & { maxRounds: number }

/**
 * A fala de um momento da mesa (null = só efeito sonoro, como a carta
 * jogada). `minor` = aviso que perde a graça se sair atrasado (erro, demora).
 */
export function speechFor(event: TableEvent, after: SnapWithMax): TableSpeech | null {
  switch (event) {
    case 'start':
      return { ms: 800, text: newLevelLine(after.round), minor: false }
    case 'cut':
      return after.mistakeSpoken ? { ms: 1500, text: after.mistakeSpoken, minor: true } : null
    case 'timeout':
      return { ms: 1000, text: after.mode === 'coop' ? TIMEOUT_LINE : TIMEOUT_VERSUS_LINE, minor: true }
    case 'levelDone':
      return { ms: 1300, text: levelDoneLine(after.round, after.maxRounds), minor: false }
    case 'newLevel':
      return { ms: 1500, text: newLevelLine(after.round), minor: false }
    case 'win':
    case 'lose':
      return { ms: 1800, text: finalLine(after), minor: false }
    default:
      return null
  }
}

/**
 * Momentos que chegaram juntos falam uma frase só — a do último que tem fala
 * (o erro que acaba o jogo fala só o fim). Nunca duas coladas.
 */
export function speechForEvents(events: readonly TableEvent[], after: SnapWithMax): TableSpeech | null {
  let chosen: TableSpeech | null = null
  for (const event of events) chosen = speechFor(event, after) ?? chosen
  return chosen
}

/** Cartas para mostrar quem segue com quantas (TV e host). */
export function seatLabel(player: Player): string {
  if (player.isEliminated) return 'boneco de neve'
  if (!player.connected) return 'offline'
  if (player.cards.length === 0) return 'mão vazia'
  return `${player.cards.length} ${cardWord(player.cards.length)}`
}
