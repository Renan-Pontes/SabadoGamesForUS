import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { seededRng } from '../../engine/helpers'
import { renderAllPhases } from '../../engine/renderSmoke'
import { makeCtx, makePlayers, runSimulation } from '../../engine/testkit'
import type { HInput, HPlayer, HalloweenViewProps } from '../../engine/types'
import { botStrokes } from './drawing'
import { engine, type RaSecret, type State } from './engine'
import Phone from './Phone'
import Tv from './Tv'

const ALL_PHASES = ['show', 'draw1', 'peek', 'draw2', 'gallery', 'vote', 'reveal', 'result', 'scores', 'final']
/** Desenhar 15 celulares em cada momento é pesado: com a suíte toda em paralelo, 5 s não bastam. */
const SLOW = 60_000

describe('telas do Retrato Assombrado em todas as fases', () => {
  it.each([3, 8, 15])(
    'desenha TV e celulares com %i jogadores',
    (players) => {
      const result = renderAllPhases({ engine, Tv, Phone }, { players, seed: players, options: { rounds: 3, chaos: true } })
      expect(result.phases).toEqual(expect.arrayContaining(ALL_PHASES))
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )

  it(
    'desenha o chute do impostor pego',
    () => {
      // Acha (barato, só o motor) uma partida em que a mesa pega o impostor; depois desenha essa.
      const options = { rounds: 5, chaos: false }
      const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((candidate) =>
        runSimulation(engine, { players: 5, seed: candidate, options }).history.some((state) => state.phase === 'guess'),
      )
      expect(seed).toBeDefined()
      const result = renderAllPhases({ engine, Tv, Phone }, { players: 5, seed, options })
      expect(result.phases).toContain('guess')
    },
    SLOW,
  )

  it(
    'com gente demorando e o host pulando',
    () => {
      const result = renderAllPhases(
        { engine, Tv, Phone },
        { players: 9, seed: 4, actProbability: 0.3, skipProbability: 0.2, options: { rounds: 3, chaos: true } },
      )
      expect(result.renders).toBeGreaterThan(0)
    },
    SLOW,
  )
})

/** Desenha uma tela com props completas (slots com desenhos de verdade). */
function draw(
  Screen: ComponentType<HalloweenViewProps<State>>,
  state: State,
  players: HPlayer[],
  extra: Partial<HalloweenViewProps<State>> = {},
) {
  const { private: secrets, ...publicState } = state
  const props: HalloweenViewProps<State> = {
    code: 'TEST',
    view: 'tv',
    state: publicState as State,
    players,
    me: null,
    isHost: false,
    myInput: null,
    mine: null,
    now: () => (state.deadline ?? 1_000_000) - 3000,
    send: () => {},
    sendSlot: () => {},
    command: () => {},
    slots: {},
    options: {},
    ...extra,
  }
  void secrets
  return renderToString(createElement(Screen, props))
}

/** Slots com um rabisco de cada um, da 1ª e da 2ª etapa. */
function drawingsFor(state: State): Record<string, Record<number, HInput>> {
  const rng = seededRng(11)
  const draw: Record<number, HInput> = {}
  state.roster.forEach((id, index) => {
    const k = index % 2 ? `draw1-${state.round}` : `draw2-${state.round}`
    draw[id] = { k, s: botStrokes(rng, 3), n1: 1, done: true }
  })
  return { draw }
}

const simulated = new Map<number, State[]>()

/** O primeiro momento da fase pedida numa partida simulada (uma partida por tamanho de mesa). */
function phaseOf(players: number, phase: string): State {
  let history = simulated.get(players)
  if (!history) {
    history = runSimulation(engine, { players, seed: 3, options: { rounds: 3, chaos: false } }).history
    simulated.set(players, history)
  }
  const found = history.find((state) => state.phase === phase)
  if (!found) throw new Error(`a simulação não passou por ${phase}`)
  return found
}

describe('telas em momentos especiais', { timeout: 60_000 }, () => {
  const players = makePlayers(8)

  it('galeria com desenhos de verdade, na TV', () => {
    const state = phaseOf(8, 'gallery')
    const html = draw(Tv, state, players, { slots: drawingsFor(state) })
    expect(html).toContain('<polyline')
    expect(html).toContain('Mortícia')
  })

  it('a TV nunca mostra a palavra antes do resultado', () => {
    for (const phase of ['show', 'draw1', 'peek', 'draw2', 'gallery', 'vote', 'reveal']) {
      const state = phaseOf(8, phase)
      const word = Object.values(state.private).find((secret) => secret.word)?.word
      expect(word).toBeTruthy()
      expect(draw(Tv, state, players, { slots: drawingsFor(state) })).not.toContain(word as string)
    }
  })

  it('celular: o impostor nunca vê a palavra; quem não é impostor vê', () => {
    const state = phaseOf(8, 'draw1')
    const word = Object.values(state.private).find((secret) => secret.word)?.word as string
    for (const player of players) {
      const mine = state.private[String(player.id)]
      const html = draw(Phone, state, players, { view: 'player', me: player, mine })
      if (mine.role === 'impostor') expect(html).not.toContain(word)
      else expect(html).toContain(word)
    }
  })

  it('revelação das rodadas malucas e do impostor pego', () => {
    const vote = phaseOf(5, 'vote')
    const cases: [string, (id: number) => RaSecret][] = [
      ['TODO MUNDO ERA IMPOSTOR', () => ({ role: 'impostor', word: null })],
      ['NINGUÉM ERA IMPOSTOR', () => ({ role: 'artist', word: 'Vassoura' })],
      ['ERA IMPOSTOR', (id) => (id === 2 ? { role: 'impostor', word: null } : { role: 'artist', word: 'Vassoura' })],
    ]
    for (const [title, secrets] of cases) {
      const state = { ...vote, private: Object.fromEntries(vote.roster.map((id) => [String(id), secrets(id)])) }
      const votes: Record<number, HInput> = {}
      for (const id of state.roster) votes[id] = { k: state.inputKey, vote: id === 2 ? 1 : 2 }
      const reveal = engine.step(state, makeCtx({ players: makePlayers(5), now: 2_000_000, inputs: votes }))
      expect(reveal.phase).toBe('reveal')
      const tv = draw(Tv, reveal, makePlayers(5), { slots: drawingsFor(reveal) })
      expect(tv).toContain(title)
      for (const player of makePlayers(5)) {
        const mine = reveal.private[String(player.id)]
        draw(Phone, reveal, makePlayers(5), { view: 'player', me: player, mine })
      }
      // E o resultado, com o chute quando houver.
      const next = engine.step(reveal, makeCtx({ players: makePlayers(5), now: reveal.deadline! }))
      draw(Tv, next, makePlayers(5), { slots: drawingsFor(next) })
      for (const player of makePlayers(5)) {
        const mine = next.private[String(player.id)]
        draw(Phone, next, makePlayers(5), { view: 'player', me: player, mine, myInput: { k: next.inputKey, guess: 'vassoura' } })
      }
    }
  })
})
