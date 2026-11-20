/**
 * Temporada do Sábado Games: Natal 2026.
 *
 * O catálogo foi enxugado de propósito — "o povo gosta de jogo simples de
 * entender". Os jogos desta lista são a vitrine de Natal; os outros não foram
 * apagados: vão para a gaveta "Old" do catálogo (fechada por padrão).
 *
 * A ordem é a da vitrine: o primeiro já vem selecionado no lobby.
 */
export const SEASON_SLUGS = [
  'espiao-assombrado', // Espião de Natal
  'abobora-bomba', // Presente-Bomba (batata quente)
  'retrato-assombrado', // Retrato de Natal (espião desenhado)
  'cidade-dorme',
  'a-cacada',
] as const

/**
 * Sustos automáticos da TV (o de 4–9 min e o raro). Desligados no Natal: o
 * host ainda solta efeitos na mão pelo painel.
 */
export const AUTO_SCARES = false

export type SeasonSlug = (typeof SEASON_SLUGS)[number]

export function isSeasonSlug(slug: string | null | undefined): slug is SeasonSlug {
  return Boolean(slug) && (SEASON_SLUGS as readonly string[]).includes(slug as string)
}

/** Ordena pela vitrine; o que não estiver na lista fica de fora. */
export function seasonGames<T extends { slug: string }>(games: T[]): T[] {
  return SEASON_SLUGS.map((slug) => games.find((game) => game.slug === slug)).filter(
    (game): game is T => Boolean(game),
  )
}

/** Separa a vitrine de Natal (na ordem dela) dos jogos "Old" (na ordem do servidor). */
export function splitSeason<T extends { slug: string }>(games: T[]): { season: T[]; old: T[] } {
  return { season: seasonGames(games), old: games.filter((game) => !isSeasonSlug(game.slug)) }
}
