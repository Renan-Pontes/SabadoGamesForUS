import { useSyncExternalStore } from 'react'

/**
 * Utilidades de movimento do kit de Halloween.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function snapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches
}

/** A pessoa pediu menos movimento? Re-renderiza se a preferência mudar. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

/**
 * Dispersão determinística a partir do índice: parece sorteio, mas é sempre
 * igual — os morcegos e doces não "pulam" de lugar a cada render.
 */
export function scatter(index: number, salt: number): number {
  const hashed = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return hashed - Math.floor(hashed)
}
