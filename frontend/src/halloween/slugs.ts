/**
 * Os jogos da Noite do Terror (Halloween 2026).
 *
 * É a única lista de slugs: o catálogo, as prateleiras, o roteamento e o
 * registro dos jogos partem daqui. O backend semeia os mesmos slugs em
 * `seed_games.py`.
 */
export const HALLOWEEN_SLUGS = [
  'espiao-assombrado',
  'cidade-dorme',
  'retrato-assombrado',
  'mentira-macabra',
  'resposta-do-alem',
  'quem-morre-primeiro',
  'abobora-bomba',
  'portas-do-alem',
  'quiz-do-terror',
  'corrida-de-vassouras',
] as const

export type HalloweenSlug = (typeof HALLOWEEN_SLUGS)[number]

export function isHalloweenSlug(slug: string | null | undefined): slug is HalloweenSlug {
  return Boolean(slug) && (HALLOWEEN_SLUGS as readonly string[]).includes(slug as string)
}

/**
 * Jogos ainda em construção: o servidor já conhece, mas ficam fora do
 * catálogo (`listGames`) até ficarem prontos. Cada jogo sai daqui no deploy
 * em que fica pronto e testado.
 */
export const HALLOWEEN_WIP: readonly HalloweenSlug[] = [
]

export function isHalloweenWip(slug: string | null | undefined): boolean {
  return Boolean(slug) && (HALLOWEEN_WIP as readonly string[]).includes(slug as string)
}
