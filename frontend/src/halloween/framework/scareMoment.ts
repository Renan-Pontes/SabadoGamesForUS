import { useEffect, useRef } from 'react'
import { triggerScare } from '../scare'
import type { ConcreteScare } from '../scare'
import type { BaseState, HPlayer, HalloweenGameModule, ScareMoment } from '../engine/types'

/**
 * Sustos dos momentos importantes, em TODOS os aparelhos de uma vez.
 *
 * Cada aparelho olha o estado público da partida; quando o jogo diz que é
 * "o momento" (o espião revelado, alguém morto ao amanhecer, a abóbora
 * explodindo na mão), a TV e os celulares assustam juntos — sem passar pelo
 * backend. O susto sai da mesma chave em todo mundo, então a sala inteira vê
 * o mesmo bicho.
 */

/** Os sustos dos momentos: o vídeo de public/jumpscare/ pesa mais. */
export const MOMENT_SCARES: readonly ConcreteScare[] = ['video', 'video', 'face', 'animatronic', 'video', 'rastejante']

/** Hash simples e estável de texto (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** O mesmo susto em todo aparelho para a mesma chave. */
export function momentScare(key: string): ConcreteScare {
  return MOMENT_SCARES[hash(key) % MOMENT_SCARES.length]
}

/** Este aparelho assusta neste momento? */
export function momentIsForMe(moment: ScareMoment, isTv: boolean, meId: number | null): boolean {
  if (isTv) return moment.tv !== false
  if (!moment.phones) return true
  return meId !== null && moment.phones.includes(meId)
}

/**
 * Decide, a cada estado novo, se há um momento a disparar agora. Puro, para
 * testar: `seen` guarda as chaves já vistas; a primeira chamada só registra
 * (quem chega no meio do momento não leva susto atrasado).
 */
export function nextMoment(
  seen: { keys: Set<string>; primed: boolean },
  moment: ScareMoment | null,
  matchId: string | null,
): { key: string; moment: ScareMoment } | null {
  const key = moment ? `${matchId ?? ''}:${moment.key}` : null
  if (!seen.primed) {
    seen.primed = true
    if (key) seen.keys.add(key)
    return null
  }
  if (!key || !moment || seen.keys.has(key)) return null
  seen.keys.add(key)
  return { key, moment }
}

export function useScareMoment<S extends BaseState>(
  game: HalloweenGameModule<S>,
  state: S | null,
  players: HPlayer[],
  isTv: boolean,
  meId: number | null,
  matchId: string | null,
) {
  const seen = useRef({ keys: new Set<string>(), primed: false })
  const timers = useRef<number[]>([])
  const moment = state && game.scareMoment ? game.scareMoment(state, players) : null
  const momentKey = moment ? moment.key : null
  const ready = state !== null

  useEffect(() => {
    if (!ready) return
    // O efeito desta renderização enxerga o `moment` dela: só a chave importa.
    const hit = nextMoment(seen.current, moment, matchId)
    if (!hit || !momentIsForMe(hit.moment, isTv, meId)) return
    const kind = momentScare(hit.key)
    timers.current.push(window.setTimeout(() => triggerScare(kind), hit.moment.delayMs ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentKey, matchId, ready, isTv, meId])

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    },
    [],
  )
}
