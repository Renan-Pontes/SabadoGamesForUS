import { useEffect } from 'react'

/**
 * Mantém a tela do celular acesa enquanto `active` (Screen Wake Lock API).
 *
 * Com 15 pessoas a abóbora leva quase um minuto para dar a volta na mesa, e
 * o celular bloqueia sozinho em ~30 s. Bloqueado, ele para de fazer poll: a
 * pessoa nem vê a abóbora chegar e o pavio dela queima. Onde não há suporte
 * (iPhone antigo, página sem https, bateria fraca), não faz nada — o jogo
 * segue igual.
 *
 *   useWakeLock(!state.over)
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
