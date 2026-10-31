import { useEffect, useSyncExternalStore } from 'react'

/**
 * Quantos botões de som "embutidos" (SoundToggle) estão na tela. Se a tela do
 * jogo já tem o seu, o botão flutuante da camada global some — dois botões de
 * som seriam um a mais, e o flutuante poderia cobrir algo.
 */

let count = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot() {
  return count
}

/** Registra um botão embutido enquanto o componente estiver montado. */
export function useRegisterInlineSoundToggle(active = true) {
  useEffect(() => {
    if (!active) return
    count += 1
    emit()
    return () => {
      count = Math.max(0, count - 1)
      emit()
    }
  }, [active])
}

/** Esconde o botão flutuante de som (ex.: uma tela que tem botões no canto). */
export function useHideFloatingSoundButton(active = true) {
  useRegisterInlineSoundToggle(active)
}

export function useInlineSoundToggleCount(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
