import { useEffect } from 'react'

/**
 * Mantém a tela do celular acesa enquanto `active` (Screen Wake Lock API).
 * Numa rodada de 3 minutos, quem fica um tempo sem tocar teria o celular
 * bloqueado — e as peças dele sumiriam da esteira. Sem suporte, não faz nada.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof document === 'undefined') return
    if (!('wakeLock' in navigator) || !navigator.wakeLock) return
    const api = navigator.wakeLock
    let sentinel: WakeLockSentinel | null = null
    let stopped = false
    let asking = false

    const acquire = async () => {
      if (stopped || asking || document.hidden || (sentinel && !sentinel.released)) return
      asking = true
      try {
        const lock = await api.request('screen')
        if (stopped) void lock.release().catch(() => undefined)
        else sentinel = lock
      } catch {
        // Sem permissão ou sem suporte: segue sem segurar a tela.
      } finally {
        asking = false
      }
    }

    const onVisible = () => {
      if (!document.hidden) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      const lock = sentinel
      sentinel = null
      if (lock && !lock.released) void lock.release().catch(() => undefined)
    }
  }, [active])
}
