import { useSyncExternalStore } from 'react'

/**
 * Aviso de entrada e o modo pesadelo.
 *
 * O site é da mesa de amigos e roda sempre no pesadelo — não existe modo
 * leve. O aviso (ui/ScareWarning) é um anúncio para quem cair aqui por acaso:
 * mostra o que vai acontecer e para quem não é recomendado. Antes de alguém
 * apertar "Entendi" naquele aparelho, o palco não mostra susto nenhum.
 */

export type ScareConsent = { at: number }

/** Mude o sufixo se o texto do aviso mudar de verdade: todo mundo vê de novo. */
export const SCARE_WARNING_KEY = 'sabado_hw_aviso_v1'

/** O pesadelo (vale sempre). */
export const NIGHTMARE = {
  /** Sustos automáticos da TV a cada 3–6 min. */
  randomMinMs: 3 * 60_000,
  randomMaxMs: 6 * 60_000,
  /** Assustador automático no máximo a cada 6 min; no meio, meme. */
  scaryGapMs: 6 * 60_000,
  /** Chance de, depois de um susto assustador, vir o "falso alívio" e um segundo bote. */
  doubleTapChance: 0.3,
  /** Quanto tempo de tela normal entre o primeiro susto e o segundo bote. */
  doubleTapGapMs: 1400,
} as const

/** Lê o aceite guardado (ou null se o aviso ainda não foi respondido). */
export function parseConsent(raw: string | null): ScareConsent | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { at?: unknown } | null
    if (!parsed || typeof parsed !== 'object') return null
    return { at: typeof parsed.at === 'number' ? parsed.at : 0 }
  } catch {
    return null
  }
}

function load(): ScareConsent | null {
  try {
    if (typeof window === 'undefined') return null
    return parseConsent(window.localStorage.getItem(SCARE_WARNING_KEY))
  } catch {
    return null
  }
}

let consent: ScareConsent | null = load()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of [...listeners]) listener()
}

export function getScareConsent(): ScareConsent | null {
  return consent
}

export function hasScareConsent(): boolean {
  return consent !== null
}

/** "Entendi, quero entrar": guarda no aparelho e libera os sustos. */
export function acceptScareWarning(now: number = Date.now()): void {
  if (consent) return
  consent = { at: now }
  try {
    window.localStorage.setItem(SCARE_WARNING_KEY, JSON.stringify(consent))
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
  emit()
}

/** Só para testes. */
export function resetScareConsentForTests(next: ScareConsent | null = null): void {
  consent = next
  emit()
}

export function subscribeScareConsent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** O aceite do aviso, re-renderizando quando muda. */
export function useScareConsent(): ScareConsent | null {
  return useSyncExternalStore(subscribeScareConsent, getScareConsent, () => null)
}
