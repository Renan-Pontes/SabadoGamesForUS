import type { HalloweenGameModule } from './engine/types'
import { HALLOWEEN_SLUGS, type HalloweenSlug } from './slugs'
import { game as espiaoAssombrado } from './games/espiao-assombrado'
import { game as cidadeDorme } from './games/cidade-dorme'
import { game as retratoAssombrado } from './games/retrato-assombrado'
import { game as mentiraMacabra } from './games/mentira-macabra'
import { game as respostaDoAlem } from './games/resposta-do-alem'
import { game as quemMorrePrimeiro } from './games/quem-morre-primeiro'
import { game as aboboraBomba } from './games/abobora-bomba'
import { game as portasDoAlem } from './games/portas-do-alem'
import { game as quizDoTerror } from './games/quiz-do-terror'
import { game as corridaDeVassouras } from './games/corrida-de-vassouras'

/**
 * Os dez jogos completos: { meta, engine, Tv, Phone }. As telas vêm por
 * React.lazy (cada jogo é um pedaço separado do pacote); os motores ficam
 * no pacote principal, porque a TV-juiz roda o motor assim que a partida
 * começa. Para só listar os jogos, use `catalog.ts`.
 */
export const HALLOWEEN_REGISTRY: Record<HalloweenSlug, HalloweenGameModule> = {
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

export const HALLOWEEN_MODULES: HalloweenGameModule[] = HALLOWEEN_SLUGS.map((slug) => HALLOWEEN_REGISTRY[slug])

export function getHalloweenGame(slug: string | null | undefined): HalloweenGameModule | null {
  if (!slug) return null
  return (HALLOWEEN_REGISTRY as Record<string, HalloweenGameModule | undefined>)[slug] ?? null
}
