import { useEffect } from 'react'

/**
 * Mantém a tela acesa enquanto `active` (Screen Wake Lock API).
 *
 * Celular bloqueado para de fazer poll: a pessoa vira "offline" no meio da
 * partida e perde a vez. Notebook ligado na TV apaga a tela no descanso. Onde
 * não há suporte (iPhone antigo, página sem https, bateria fraca), não faz
 * nada — o jogo segue igual. (Veio do Abóbora-Bomba, que tem a sua cópia.)
 *
 *   useWakeLock(status === 'live')
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

    // O navegador solta a trava quando a aba some; ao voltar, pega de novo.
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
