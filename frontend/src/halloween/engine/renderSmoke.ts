import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { seededRng } from './helpers'
import { makeCtx, makePlayers, runSimulation, type SimulationOptions } from './testkit'
import type { BaseState, HInput, HPlayer, HalloweenEngine, HalloweenViewProps } from './types'

/**
 * Teste de fumaça das telas: joga uma partida simulada (só com o `bot`) e
 * desenha a TV e o celular de cada jogador em cada momento diferente da
 * partida, com `renderToString`. Pega erro de desenho — campo null numa
 * fase, lista vazia, segredo que não chegou — antes da festa; na TV de
 * verdade isso viraria "A tela tropeçou".
 *
 *   renderAllPhases({ engine, Tv, Phone }, { players: 8, seed: 3 })
 *
 * Os efeitos (useEffect) não rodam no render de servidor: som, susto e
 * animação ficam de fora; o que se testa é o desenho de cada fase.
 */

export type RenderSmokeModule<S extends BaseState> = {
  engine: HalloweenEngine<S>
  Tv: ComponentType<HalloweenViewProps<S>>
  Phone: ComponentType<HalloweenViewProps<S>>
}

export type RenderSmokeResult = {
  /** Momentos desenhados (fase|rodada|inputKey|over). */
  moments: string[]
  /** Fases que apareceram na partida. */
  phases: string[]
  renders: number
}

type WithPrivate = BaseState & { private?: Record<string, unknown> }

function momentKey(state: BaseState): string {
  return `${state.phase}|${state.round ?? ''}|${state.inputKey}|${state.over}`
}

export function renderAllPhases<S extends BaseState>(
  module: RenderSmokeModule<S>,
  sim: SimulationOptions & { players?: number },
): RenderSmokeResult {
  const players: HPlayer[] = makePlayers(typeof sim.players === 'number' ? sim.players : 4)
  const result = runSimulation(module.engine, { ...sim, players })
  const seen = new Set<string>()
  const phases = new Set<string>()
  let renders = 0
  const noop = () => {}

  const render = (Screen: ComponentType<HalloweenViewProps<S>>, props: HalloweenViewProps<S>, label: string) => {
    try {
      renderToString(createElement(Screen, props))
      renders += 1
    } catch (error) {
      const text = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
      throw new Error(`a tela quebrou em ${label}: ${text}`)
    }
  }

  for (const full of result.history) {
    const key = momentKey(full)
    if (seen.has(key)) continue
    seen.add(key)
    phases.add(full.phase)

    // Como o framework entrega: o `state` das telas chega sem `private`.
    const { private: secrets, ...rest } = full as S & WithPrivate
    const state = rest as unknown as S
    const at = typeof full.deadline === 'number' ? full.deadline - 3000 : 1_000_000
    const base = {
      code: 'TEST',
      state,
      players,
      now: () => at,
      send: noop,
      sendSlot: noop,
      command: noop,
      options: { ...(sim.options ?? {}) },
    }

    render(
      module.Tv,
      { ...base, view: 'tv', me: null, isHost: false, myInput: null, mine: null, slots: {} } as HalloweenViewProps<S>,
      `TV (${key})`,
    )

    const ctx = makeCtx({ players, now: at, rng: seededRng(renders + 1), options: { ...(sim.options ?? {}) } })
    for (const player of players) {
      if (!full.roster.includes(player.id)) continue
      const mine = (secrets?.[String(player.id)] ?? null) as HalloweenViewProps<S>['mine']
      const phone = {
        ...base,
        view: player.isHost ? 'host' : 'player',
        me: player,
        isHost: player.isHost,
        mine,
        slots: {},
      }
      render(module.Phone, { ...phone, myInput: null } as HalloweenViewProps<S>, `celular de ${player.id} (${key})`)

      // E de novo "depois de responder": a tela de espera também precisa desenhar.
      const answer = module.engine.bot(full, player.id, ctx)
      if (answer && !('_slot' in answer)) {
        const myInput = { k: full.inputKey, ...answer } as HInput
        render(module.Phone, { ...phone, myInput } as HalloweenViewProps<S>, `celular de ${player.id} já respondido (${key})`)
      }
    }
  }

  return { moments: [...seen], phases: [...phases], renders }
}
