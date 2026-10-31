import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../ui/motion'
import { onScare, setScareShowing } from './bus'
import type { ScareRequest } from './bus'
import { playScareSound, scareDurationMs } from './config'
import ScareScene from './scenes'

/**
 * Palco dos sustos: escuta o barramento e mostra um susto por vez, por cima
 * de tudo, sem nunca receber clique. Se outro susto chega no meio, ele
 * espera a vez (só o mais recente) e entra logo depois.
 *
 * Montado uma única vez pela camada global (HalloweenLayer).
 */
export default function ScareOverlay() {
  const [scare, setScare] = useState<ScareRequest | null>(null)
  const pending = useRef<ScareRequest | null>(null)
  const busy = useRef(false)
  const reduced = useReducedMotion()

  useEffect(
    () =>
      onScare((request) => {
        if (busy.current) {
          pending.current = request
          return
        }
        busy.current = true
        setScareShowing(true)
        setScare(request)
      }),
    [],
  )

  useEffect(() => {
    if (!scare) return
    const stopSound = playScareSound(scare.kind, scare.name)
    const timer = window.setTimeout(() => {
      const next = pending.current
      pending.current = null
      if (next) {
        setScare(next)
        return
      }
      busy.current = false
      setScareShowing(false)
      setScare(null)
    }, scareDurationMs(scare.kind))
    return () => {
      window.clearTimeout(timer)
      stopSound()
    }
  }, [scare])

  useEffect(
    () => () => {
      busy.current = false
      setScareShowing(false)
    },
    [],
  )

  if (!scare || typeof document === 'undefined') return null
  return createPortal(
    <div className="hws-root" aria-hidden>
      <ScareScene
        key={scare.id}
        kind={scare.kind}
        name={scare.name}
        reduced={reduced}
        duration={scareDurationMs(scare.kind)}
      />
    </div>,
    document.body,
  )
}
