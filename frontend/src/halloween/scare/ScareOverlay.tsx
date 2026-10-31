import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../ui/motion'
import { onScare, setScareShowing, shouldDoubleTap } from './bus'
import type { ScareRequest } from './bus'
import { playScareSound, scareDurationMs } from './config'
import { NIGHTMARE, hasScareConsent } from './level'
import ScareScene from './scenes'

let followUpId = -1

/**
 * Palco dos sustos: escuta o barramento e mostra um susto por vez, por cima
 * de tudo, sem nunca receber clique. Se outro susto chega no meio, ele
 * espera a vez (só o mais recente) e entra logo depois.
 *
 * Nada aparece antes de alguém responder o aviso de entrada (ui/ScareWarning).
 *
 * Montado uma única vez pela camada global (HalloweenLayer).
 */
export default function ScareOverlay() {
  const [scare, setScare] = useState<ScareRequest | null>(null)
  const pending = useRef<ScareRequest | null>(null)
  const busy = useRef(false)
  const followUp = useRef<number | undefined>(undefined)
  const reduced = useReducedMotion()

  useEffect(
    () =>
      onScare((request) => {
        // Ninguém leu o aviso para cardíacos ainda: susto nenhum.
        if (!hasScareConsent()) return
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
      if (shouldDoubleTap(scare)) {
        // Some, deixa a sala respirar... e volta. Continua "ocupado" no meio.
        setScare(null)
        followUp.current = window.setTimeout(() => {
          followUp.current = undefined
          const queued = pending.current
          pending.current = null
          setScare(queued ?? { id: (followUpId -= 1), kind: 'face' })
        }, NIGHTMARE.doubleTapGapMs)
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
      window.clearTimeout(followUp.current)
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
