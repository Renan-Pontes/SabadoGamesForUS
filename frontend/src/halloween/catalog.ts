import type { HalloweenGameMeta } from './engine/types'
import { HALLOWEEN_SLUGS, type HalloweenSlug } from './slugs'
import { meta as espiaoAssombrado } from './games/espiao-assombrado/meta'
import { meta as cidadeDorme } from './games/cidade-dorme/meta'
import { meta as retratoAssombrado } from './games/retrato-assombrado/meta'
import { meta as mentiraMacabra } from './games/mentira-macabra/meta'
import { meta as respostaDoAlem } from './games/resposta-do-alem/meta'
import { meta as quemMorrePrimeiro } from './games/quem-morre-primeiro/meta'
import { meta as aboboraBomba } from './games/abobora-bomba/meta'
import { meta as portasDoAlem } from './games/portas-do-alem/meta'
import { meta as quizDoTerror } from './games/quiz-do-terror/meta'
import { meta as corridaDeVassouras } from './games/corrida-de-vassouras/meta'

/**
 * Os metas dos jogos de Halloween (nome, regras, cores, opções), sem as
 * telas nem os motores — leve o bastante para o catálogo, as prateleiras e
 * o tema importarem sem puxar os jogos inteiros.
 */
export const HALLOWEEN_METAS: Record<HalloweenSlug, HalloweenGameMeta> = {
  'espiao-assombrado': espiaoAssombrado,
  'cidade-dorme': cidadeDorme,
  'retrato-assombrado': retratoAssombrado,
  'mentira-macabra': mentiraMacabra,
  'resposta-do-alem': respostaDoAlem,
  'quem-morre-primeiro': quemMorrePrimeiro,
  'abobora-bomba': aboboraBomba,
  'portas-do-alem': portasDoAlem,
  'quiz-do-terror': quizDoTerror,
  'corrida-de-vassouras': corridaDeVassouras,
}

/** Na ordem da prateleira (a mesma de `slugs.ts`). */
export const HALLOWEEN_GAMES: HalloweenGameMeta[] = HALLOWEEN_SLUGS.map((slug) => HALLOWEEN_METAS[slug])

export function getHalloweenMeta(slug: string | null | undefined): HalloweenGameMeta | null {
  if (!slug) return null
  return (HALLOWEEN_METAS as Record<string, HalloweenGameMeta | undefined>)[slug] ?? null
}
