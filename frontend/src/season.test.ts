import { describe, expect, it } from 'vitest'
import { HALLOWEEN_SLUGS } from './halloween/slugs'
import { getGameMeta } from './lib/gameCatalog'
import { SEASON_SLUGS, isSeasonSlug, seasonGames, splitSeason } from './season'

describe('catálogo de Natal', () => {
  it('tem só os jogos simples escolhidos', () => {
    expect(SEASON_SLUGS).toEqual(['espiao-assombrado', 'pergunta-trocada', 'duas-verdades', 'cozinha-da-ceia', 'fabrica-de-presentes', 'abobora-bomba', 'retrato-assombrado', 'cidade-dorme', 'read-my-mind', 'a-cacada'])
  })

  it('todo slug existe (jogo novo registrado ou jogo antigo no catálogo)', () => {
    for (const slug of SEASON_SLUGS) {
      const known = (HALLOWEEN_SLUGS as readonly string[]).includes(slug) || getGameMeta(slug).howTo.length > 1
      expect(known, slug).toBe(true)
    }
  })

  it('filtra e ordena pela vitrine', () => {
    const games = [
      { id: 1, slug: 'lobisomem' },
      { id: 2, slug: 'a-cacada' },
      { id: 3, slug: 'espiao-assombrado' },
      { id: 4, slug: 'quiz-do-terror' },
    ]
    expect(seasonGames(games).map((game) => game.slug)).toEqual(['espiao-assombrado', 'a-cacada'])
    expect(isSeasonSlug('lobisomem')).toBe(false)
    // Nada é apagado: o resto vira "Old", na ordem do servidor.
    expect(splitSeason(games).old.map((game) => game.slug)).toEqual(['lobisomem', 'quiz-do-terror'])
    expect(isSeasonSlug(null)).toBe(false)
  })
})
