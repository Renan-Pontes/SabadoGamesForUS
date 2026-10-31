import { useEffect } from 'react'
import { clearScareNames, emitScare, setScareNames, suppressScares } from './bus'
import type { ScareKind } from './bus'

/**
 * Sustos de meme da Noite do Terror — a API que os jogos usam.
 *
 *   triggerScare()                          // um susto sorteado (~2/3 assustadores, ~1/3 meme)
 *   triggerScare('scary')                   // só os assustadores (animatrônico, rosto, grito, estática, apagão, rastejante)
 *   triggerScare('zoom', { name: 'Pedro' }) // zoom suspeito no Pedro 🤨📸
 *   useSuppressScares(phase === 'reveal')   // segura os sustos aleatórios
 *
 * O overlay é montado uma vez pela camada global (HalloweenLayer). Sustos
 * aleatórios só acontecem na TV, a cada 3–6 minutos (modo pesadelo, sempre).
 *
 * Nenhum susto aparece antes de o aparelho passar pelo aviso de entrada
 * (para cardíacos, epilépticos etc.).
 */

export type { ConcreteScare, ScareKind, ScareRequest } from './bus'
export {
  AUTO_SCARY_GAP_MS,
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
  shouldDoubleTap,
} from './bus'
export type { ScareConsent } from './level'
export {
  NIGHTMARE,
  acceptScareWarning,
  getScareConsent,
  hasScareConsent,
  subscribeScareConsent,
  useScareConsent,
} from './level'

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
