import { describe, expect, it } from 'vitest'
import { getAccent } from '../games/theme'
import { getGameMeta } from '../lib/gameCatalog'
import { HALLOWEEN_GAMES, HALLOWEEN_METAS, getHalloweenMeta } from './catalog'
import { optionDefaults } from './engine/helpers'
import { runSimulation } from './engine/testkit'
import { HALLOWEEN_MODULES, HALLOWEEN_REGISTRY, getHalloweenGame } from './registry'
import { HALLOWEEN_SLUGS } from './slugs'

/**
 * Guarda da plataforma: os dez jogos registrados, metas dentro das regras
 * de ouro do HALLOWEEN.md e todo motor terminando sozinho. Vale para os
 * provisórios de agora e para os de verdade da Etapa 2.
 */

const VIBES = ['Cooperativo', 'Dedução', 'Blefe', 'Negociação', 'Corrida', 'Aposta', 'Festa', 'Estratégia']

describe('registro e catálogo', () => {
  it('os dez slugs estão no registro e no catálogo, na mesma ordem', () => {
    expect(Object.keys(HALLOWEEN_REGISTRY).sort()).toEqual([...HALLOWEEN_SLUGS].sort())
    expect(Object.keys(HALLOWEEN_METAS).sort()).toEqual([...HALLOWEEN_SLUGS].sort())
    expect(HALLOWEEN_GAMES.map((meta) => meta.slug)).toEqual([...HALLOWEEN_SLUGS])
    expect(HALLOWEEN_MODULES.map((game) => game.meta.slug)).toEqual([...HALLOWEEN_SLUGS])
    for (const slug of HALLOWEEN_SLUGS) {
      expect(getHalloweenGame(slug)?.meta).toBe(getHalloweenMeta(slug))
    }
    expect(getHalloweenGame('nao-existe')).toBeNull()
    expect(getHalloweenMeta(null)).toBeNull()
  })

  it('o catálogo antigo e o tema enxergam os jogos de Halloween', () => {
    for (const meta of HALLOWEEN_GAMES) {
      expect(getGameMeta(meta.slug)).toEqual({
        icon: meta.icon,
        pitch: meta.pitch,
        howTo: meta.howTo,
        duration: meta.duration,
        vibe: meta.vibe,
      })
      expect(getAccent(meta.slug)).toBe(meta.accent)
    }
    // Os jogos antigos continuam com o que tinham.
    expect(getGameMeta('read-my-mind').icon).toBe('🧠')
    expect(getAccent('read-my-mind').main).toBe('#22d3ee')
  })

  it('cores diferentes por jogo', () => {
    const mains = HALLOWEEN_GAMES.map((meta) => meta.accent.main.toLowerCase())
    expect(new Set(mains).size).toBe(mains.length)
  })
})

describe.each(HALLOWEEN_GAMES.map((meta) => [meta.slug, meta] as const))('meta de %s', (_slug, meta) => {
  it('segue as regras de ouro', () => {
    expect(meta.name.length).toBeGreaterThan(2)
    expect(meta.icon.length).toBeGreaterThan(0)
    expect(meta.tagline.length).toBeGreaterThan(5)
    expect(meta.pitch.length).toBeGreaterThan(10)
    expect(VIBES).toContain(meta.vibe)
    // "Como jogar" com 3 a 5 passos curtinhos.
    expect(meta.howTo.length).toBeGreaterThanOrEqual(3)
    expect(meta.howTo.length).toBeLessThanOrEqual(5)
    for (const step of meta.howTo) {
      const words = step.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word))
      expect(words.length, `passo longo demais: "${step}"`).toBeLessThanOrEqual(15)
    }
    expect(meta.minPlayers).toBeGreaterThanOrEqual(1)
    expect(meta.maxPlayers).toBe(15)
    expect(meta.minPlayers).toBeLessThanOrEqual(meta.maxPlayers)
    for (const key of ['main', 'light', 'glow', 'contrast', 'sigil'] as const) {
      expect(meta.accent[key].length).toBeGreaterThan(0)
    }
  })

  it('opções válidas: chaves únicas e o padrão entre as escolhas', () => {
    const keys = meta.options.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const option of meta.options) {
      expect(option.choices.length).toBeGreaterThanOrEqual(2)
      expect(option.choices.map((choice) => choice.value)).toContain(option.default)
    }
  })
})

describe.each(HALLOWEEN_MODULES.map((game) => [game.meta.slug, game] as const))('motor de %s', (_slug, game) => {
  const sizes = [...new Set([Math.max(game.meta.minPlayers, 1), 8, 15])]
  it.each(sizes)('termina sozinho com %i jogadores', (players) => {
    const result = runSimulation(game.engine, { players, seed: players, options: optionDefaults(game.meta.options) })
    expect(result.state.over).toBe(true)
  })

  it('termina com gente offline e o host pulando', () => {
    const result = runSimulation(game.engine, {
      players: 9,
      seed: 4,
      offlineIds: [3, 7],
      skipProbability: 0.2,
      actProbability: 0.5,
      options: optionDefaults(game.meta.options),
    })
    expect(result.state.over).toBe(true)
  })
})
