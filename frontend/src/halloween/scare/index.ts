import { useEffect } from 'react'
import { clearScareNames, emitScare, setScareNames, suppressScares } from './bus'
import type { ScareKind } from './bus'

/**
 * Efeitos da TV — a API que os jogos usam.
 *
 * Natal: só VISITAS (cameos.ts) — pequenas, nos cantos e no fundo, som
 * baixinho, sem fala e sem susto:
 *   triggerScare('cameo')                     // uma visita sorteada
 *   triggerScare('peek', { name: 'Pedro' })   // duende desconfiado: "Hmm… Pedro?"
 *   triggerScare('cookie')                    // biscoito de gengibre acena do canto
 *   triggerScare('snowman')                   // boneco de neve acena (e o chapéu pula)
 *   triggerScare('parachuteGift')             // presente desce de paraquedas
 *   triggerScare('santaSleigh' | 'penguin' | 'shootingStar' | 'reindeerHop' | 'chimneyElf')
 * Os efeitos de tela cheia de Natal ('hohoho', 'blizzard'...) e o zoom 🤨📸
 * continuam no código, mas nenhum jogo da temporada os chama.
 *
 * Noite do Terror (jogos "Old"):
 *   triggerScare()                          // um susto sorteado (~2/3 assustadores, ~1/3 meme)
 *   triggerScare('scary')                   // só os assustadores (animatrônico, rosto, grito, estática)
 *   useSuppressScares(phase === 'reveal')   // segura os sustos aleatórios
 *
 * O overlay é montado uma vez pela camada global (HalloweenLayer). Sustos
 * aleatórios (só na TV, a cada 4–9 minutos) dependem de AUTO_SCARES (season.ts).
 */

export type { ConcreteScare, FestiveEffect, ScareKind, ScareRequest, XmasEffect } from './bus'
export type { Cameo, CameoRequest, HostCameoButton } from './cameos'
export {
  CAMEOS,
  CAMEO_INFO,
  CAMEO_RANDOM,
  HOST_CAMEO_BUTTONS,
  RANDOM_CAMEOS,
  isCameo,
  isCameoRequest,
  isCameoShowing,
  onCameo,
  pickCameo,
  resolveCameo,
} from './cameos'
export {
  AUTO_SCARY_GAP_MS,
  FESTIVE_EFFECTS,
  FESTIVE_RANDOM,
  XMAS_EFFECTS,
  isFestiveEffect,
  isXmasEffect,
  pickFestiveEffect,
  MEME_SCARES,
  RARE_SCARE,
  SCARE_KINDS,
  SCARES_WITH_NAME,
  SCARY_RANDOM,
  SCARY_SCARES,
  isConcreteScare,
  isScareShowing,
  isScareSuppressed,
  isScaryScare,
  onScare,
  pickAutoScare,
  pickScare,
  pickScaryScare,
  resolveScareKind,
  scareNames,
} from './bus'

/** Mostra um susto em tela cheia NESTE aparelho (normalmente a TV). */
export function triggerScare(kind: ScareKind = 'random', options?: { name?: string }): void {
  emitScare(kind, options)
}

/**
 * Enquanto `active` for true, os sustos aleatórios ficam suspensos — use em
 * revelações e votações para o meme não atropelar o momento importante.
 * Vários componentes podem suspender ao mesmo tempo (contagem de referências).
 */
export function useSuppressScares(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return suppressScares()
  }, [active])
}

/**
 * Informa os nomes dos jogadores para os sustos que usam nome (zoom suspeito,
 * olhos no escuro). A TV do jogo pode chamar com a lista de jogadores; sem
 * isso, a TV busca os nomes da sala sozinha quando precisa.
 */
export function useScareNames(names: string[]): void {
  const key = names.join('\u0000')
  useEffect(() => {
    const source = `names-${Math.random().toString(36).slice(2)}`
    setScareNames(source, key ? key.split('\u0000') : [])
    return () => clearScareNames(source)
  }, [key])
}
