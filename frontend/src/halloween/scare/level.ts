import { useSyncExternalStore } from 'react'

/**
 * Aviso de entrada e nível dos sustos deste aparelho.
 *
 * Antes de qualquer susto, o site mostra o aviso para cardíacos (ui/ScareWarning).
 * Quem lê escolhe:
 *   - 'pesadelo' → sustos de verdade, mais frequentes, com tensão antes do
 *                  grito e às vezes um segundo bote depois do "alívio";
 *   - 'leve'     → só os de meme: todo susto assustador vira um de meme
 *                  neste aparelho, venha de onde vier (host, jogo, sorteio).
 *
 * Sem escolha (aviso ainda aberto), o palco não mostra susto nenhum.
 * A escolha fica guardada no aparelho; a TV pode trocar no controle do canto.
 */

export type ScareLevel = 'pesadelo' | 'leve'

export type ScareConsent = { level: ScareLevel; at: number }

/** Mude o sufixo se o texto do aviso mudar de verdade: todo mundo vê de novo. */
export const SCARE_WARNING_KEY = 'sabado_hw_aviso_v1'

/** Modo pesadelo: o que muda em relação ao normal. */
export const NIGHTMARE = {
  /** Sustos automáticos da TV a cada 3–6 min (normal: 4–9). */
  randomMinMs: 3 * 60_000,
  randomMaxMs: 6 * 60_000,
  /** Assustador automático no máximo a cada 6 min (normal: 15); no meio, meme. */
  scaryGapMs: 6 * 60_000,
  /** Chance de, depois de um susto assustador, vir o "falso alívio" e um segundo bote. */
  doubleTapChance: 0.3,
  /** Quanto tempo de tela normal entre o primeiro susto e o segundo bote. */
  doubleTapGapMs: 1400,
} as const

function isLevel(value: unknown): value is ScareLevel {
  return value === 'pesadelo' || value === 'leve'
}

/** Lê a escolha guardada (ou null se o aviso ainda não foi respondido). */
export function parseConsent(raw: string | null): ScareConsent | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ScareConsent>
    if (!isLevel(parsed.level)) return null
    return { level: parsed.level, at: typeof parsed.at === 'number' ? parsed.at : 0 }
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

/** A escolha feita no aviso (null = aviso ainda aberto). */
export function getScareConsent(): ScareConsent | null {
  return consent
}

/** O nível escolhido, ou null se ninguém respondeu o aviso neste aparelho. */
export function getScareLevel(): ScareLevel | null {
  return consent?.level ?? null
}

export function hasScareConsent(): boolean {
  return consent !== null
}

/** Responde o aviso (ou troca o nível depois). Guarda no aparelho. */
export function setScareLevel(level: ScareLevel, now: number = Date.now()): void {
  if (consent?.level === level) return
  consent = { level, at: now }
  try {
    window.localStorage.setItem(SCARE_WARNING_KEY, JSON.stringify(consent))
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
  emit()
}

/** Só para testes: esquece a escolha. */
export function resetScareConsentForTests(next: ScareConsent | null = null): void {
  consent = next
  emit()
}

export function subscribeScareLevel(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A escolha do aviso, re-renderizando quando muda. */
export function useScareConsent(): ScareConsent | null {
  return useSyncExternalStore(subscribeScareLevel, getScareConsent, () => null)
}
