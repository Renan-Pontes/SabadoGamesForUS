import { useEffect, useRef } from 'react'
import { PRANK_SCARES, isScareShowing, triggerScare } from '../scare'

/**
 * Pegadinha de surpresa no celular de cada um, durante os jogos: a tela
 * "quebra", o aparelho "é possuído" ou a "bateria acaba"... e TRAVESSURA.
 * Cada celular rola o próprio dado a cada fase nova — ninguém sabe quando.
 */
export const PHONE_PRANK = {
  /** Chance a cada fase nova. */
  chance: 0.1,
  /** No máximo uma a cada 6 min por celular. */
  minGapMs: 6 * 60_000,
  /** Nada nos 2 primeiros minutos da partida. */
  warmupMs: 2 * 60_000,
  /** Espera depois da fase começar (a pessoa já está olhando a tela). */
  delayMinMs: 4_000,
  delayMaxMs: 14_000,
}

/** Sai pegadinha nesta fase? Puro, para testar. */
export function rollPhonePrank(now: number, startedAt: number, lastAt: number, random: () => number): boolean {
  if (now - startedAt < PHONE_PRANK.warmupMs) return false
  if (now - lastAt < PHONE_PRANK.minGapMs) return false
  return random() < PHONE_PRANK.chance
}

let lastPrankAt = Number.NEGATIVE_INFINITY

export function usePhonePrank(enabled: boolean, phaseKey: string | null, myName: string | undefined) {
  const startedAt = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled || !phaseKey) return
    const now = Date.now()
    startedAt.current ??= now
    if (!rollPhonePrank(now, startedAt.current, lastPrankAt, Math.random)) return
    const kind = PRANK_SCARES[Math.floor(Math.random() * PRANK_SCARES.length)]
    const delay = PHONE_PRANK.delayMinMs + Math.random() * (PHONE_PRANK.delayMaxMs - PHONE_PRANK.delayMinMs)
    const timer = window.setTimeout(() => {
      if (isScareShowing()) return
      lastPrankAt = Date.now()
      triggerScare(kind, myName ? { name: myName } : undefined)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [enabled, phaseKey, myName])
}
