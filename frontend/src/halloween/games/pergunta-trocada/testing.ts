import { makeCtx, makePlayers } from '../../engine/testkit'
import type { EngineCtx, HCommand, HInput } from '../../engine/types'
import { MESA_KEY, engine, mesaOf, questionsOf, type PtCard, type PtMesa, type State } from './engine'

/**
 * Atalhos dos testes da "Pergunta Trocada" (motor e telas): montar uma
 * partida, escolher o impostor e chegar rápido numa fase. Só os testes
 * importam este arquivo.
 */

export const NOW = 1_000_000

export type Fields = Record<string, unknown>

/** Começa uma partida com `n` jogadores (1..n). Sem rodada maluca, a não ser que o teste peça. */
export function start(n = 5, options: Fields = { rounds: 3, chaos: false }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx num instante, com as respostas `{ jogador: campos }` na chave da fase. */
export function ctxAt(state: State, now: number, answers: Record<number, Fields> = {}, extra: Partial<EngineCtx> = {}): EngineCtx {
  const inputs: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(answers)) inputs[Number(id)] = { ...fields, k: state.inputKey }
  return makeCtx({ players: makePlayers(Math.max(1, ...state.roster)), now, inputs, ...extra })
}

export const skip = (id = 1): HCommand => ({ id, type: 'skip' })

/** Troca o impostor da rodada (null = rodada sem impostor) para o teste ficar determinístico. */
export function rig(state: State, impostor: number | null): State {
  const mesa: PtMesa = { ...mesaOf(state), impostor }
  const questions = questionsOf(mesa)
  const secrets: Record<string, PtCard | PtMesa> = {}
  for (const id of state.roster) {
    secrets[String(id)] = { question: id === impostor ? questions.odd : questions.group, odd: id === impostor }
  }
  secrets[MESA_KEY] = mesa
  return { ...state, private: secrets }
}

/** Avança pelos prazos (ninguém age) até a fase pedida. */
export function toPhase(state: State, phase: State['phase']): State {
  let current = state
  for (let i = 0; i < 12 && current.phase !== phase; i += 1) current = engine.step(current, ctxAt(current, current.deadline ?? NOW))
  if (current.phase !== phase) throw new Error(`não chegou em ${phase} (parou em ${current.phase})`)
  return current
}

/** Rodada com o impostor escolhido, todo mundo respondendo `answers` (padrão: "resposta N"). */
export function answered(n = 5, impostor: number | null = 1, answers?: Record<number, string>, options: Fields = { rounds: 3, chaos: false }) {
  const { state } = start(n, options)
  const rigged = rig(state, impostor)
  const fields: Record<number, Fields> = {}
  for (const id of rigged.roster) fields[id] = { answer: answers?.[id] ?? `resposta ${id}` }
  return engine.step(rigged, ctxAt(rigged, NOW + 5000, fields))
}

/** Até a votação (respostas na mesa e conversa pelos prazos). */
export function voting(n = 5, impostor: number | null = 1, options?: Fields) {
  return toPhase(answered(n, impostor, undefined, options), 'vote')
}

/** Fecha a votação com os votos `{ eleitor: alvo }`. */
export function vote(state: State, votes: Record<number, number>): State {
  const fields: Record<number, Fields> = {}
  for (const [voter, target] of Object.entries(votes)) fields[Number(voter)] = { vote: target }
  return engine.step(state, ctxAt(state, state.deadline ?? NOW, fields))
}

/** Estado como as telas recebem (sem private). */
export function publicJson(state: State) {
  const copy: Partial<State> = { ...state }
  delete copy.private
  return JSON.stringify(copy)
}
