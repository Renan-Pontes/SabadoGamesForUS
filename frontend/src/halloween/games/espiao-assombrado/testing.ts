import { expect } from 'vitest'
import { makeCtx, makePlayers } from '../../engine/testkit'
import type { EngineCtx, HCommand, HInput } from '../../engine/types'
import { PLACES } from './content'
import { engine, mesaOf, type EspiaoState } from './engine'
import { MESA_KEY, REVEAL_SECONDS, type MesaSecret, type RoundKind, type SpyCard } from './rules'

/**
 * Atalhos dos testes do "Espião Assombrado" (motor e telas): montar uma
 * partida, escolher quem é espião e chegar rápido numa fase. Só os testes
 * importam este arquivo.
 */

export const NOW = 1_000_000

export type Fields = Record<string, unknown>

/** Começa uma partida com `n` jogadores (1..n). */
export function start(n = 5, options: Fields = { rounds: 3 }, extra: Partial<EngineCtx> = {}) {
  const ctx = makeCtx({ players: makePlayers(n), now: NOW, options, ...extra })
  return { ctx, state: engine.init(ctx) }
}

/** ctx num instante, com as respostas `{ jogador: campos }` na chave dada (padrão: a da fase). */
export function ctxAt(
  state: EspiaoState,
  now: number,
  answers: Record<number, Fields> = {},
  extra: Partial<EngineCtx> & { key?: string } = {},
) {
  const { key = state.inputKey, ...rest } = extra
  const inputs: Record<number, HInput> = {}
  for (const [id, fields] of Object.entries(answers)) inputs[Number(id)] = { ...fields, k: key }
  return makeCtx({ players: makePlayers(Math.max(...state.roster, 1)), now, inputs, ...rest })
}

export const skip = (id = 1): HCommand => ({ id, type: 'skip' })

/** Troca quem é espião (e o tipo da rodada) para o teste ficar determinístico. */
export function rig(state: EspiaoState, spies: number[], kind: RoundKind = 'normal'): EspiaoState {
  const mesa = mesaOf(state)
  const place = PLACES[mesa.place]
  const secrets: Record<string, SpyCard | MesaSecret> = {}
  state.roster.forEach((id, index) => {
    secrets[String(id)] = spies.includes(id)
      ? { spy: true }
      : { spy: false, place: place.name, icon: place.icon, role: place.roles[index % place.roles.length] }
  })
  secrets[MESA_KEY] = { ...mesa, kind, spies: state.roster.filter((id) => spies.includes(id)) }
  return { ...state, private: secrets }
}

/** Do início até a conversa, com os espiões escolhidos. */
export function talking(n = 5, spies: number[] = [1], kind: RoundKind = 'normal', options: Fields = { rounds: 3 }) {
  const { state } = start(n, options)
  const talk = engine.step(rig(state, spies, kind), ctxAt(state, state.deadline!))
  expect(talk.phase).toBe('talk')
  return talk
}

/** Abre uma acusação de `by` contra `target`, 60 s depois do começo da conversa. */
export function accuse(talk: EspiaoState, by: number, target: number, now = NOW + REVEAL_SECONDS * 1000 + 60_000) {
  const next = engine.step(talk, ctxAt(talk, now, { [by]: { accuse: target, at: now } }))
  expect(next.phase).toBe('accuse')
  return next
}

export const placeName = (state: EspiaoState) => PLACES[mesaOf(state).place].name

/** Estado como as telas recebem (sem private). */
export function publicJson(state: EspiaoState) {
  const copy: Partial<EspiaoState> = { ...state }
  delete copy.private
  return JSON.stringify(copy)
}
