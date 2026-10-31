import { useEffect } from 'react'
import { getSoundState, setMusicEnabled, setRandomScaresEnabled } from '../audio'
import {
  SCARES_WITH_NAME,
  isScareShowing,
  isScareSuppressed,
  resolveScareKind,
  scareNames,
  triggerScare,
} from '../scare'
import { getRoomFx } from './api'
import type { RoomFx } from './api'
import { decideFx } from './decide'
import type { FxAction } from './decide'
import { loadSeenFx, saveSeenFx } from './memory'
import { roomPlayerNames } from './names'
import { startRandomScares } from './randomScares'
import TvControl from './TvControl'

/** Consulta leve do `fx` da sala (o host manda susto / liga a música). */
const POLL_MS = 1500

/** Susto com nome: usa os nomes que o jogo informou ou busca os da sala. */
async function scareWithName(code: string, requested: string, name?: string) {
  const kind = resolveScareKind(requested)
  let chosen = name
  if (!chosen && SCARES_WITH_NAME.includes(kind) && scareNames().length === 0) {
    const names = await roomPlayerNames(code)
    if (names.length) chosen = names[Math.floor(Math.random() * names.length)]
  }
  triggerScare(kind, chosen ? { name: chosen } : undefined)
}

function runAction(action: FxAction, code: string) {
  switch (action.type) {
    case 'music':
      setMusicEnabled(action.on)
      break
    case 'randomScares':
      setRandomScaresEnabled(action.on)
      break
    case 'scare':
      void scareWithName(code, action.kind, action.name)
      break
  }
}

/**
 * Efeitos da sala na TV: executa o que o host manda (susto, música),
 * solta sustos aleatórios de tempos em tempos e mostra o controle discreto
 * do canto. Montado pela camada global só nas rotas de TV.
 */
export default function TvFxLayer({ code }: { code: string }) {
  useEffect(() => {
    let active = true
    let busy = false
    let lastSeen = loadSeenFx(code)

    const poll = async () => {
      if (!active || busy || document.hidden) return
      busy = true
      try {
        const data = await getRoomFx(code)
        if (!active) return
        const decision = decideFx(data?.fx as Partial<RoomFx> | undefined, data?.t, lastSeen)
        if (decision.lastSeen !== lastSeen) {
          lastSeen = decision.lastSeen
          saveSeenFx(code, lastSeen)
        }
        for (const action of decision.actions) runAction(action, code)
      } catch {
        // Backend cochilando: tenta de novo no próximo ciclo.
      } finally {
        busy = false
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [code])

  useEffect(
    () =>
      startRandomScares({
        check: () => {
          if (!getSoundState().randomScares) return 'skip'
          if (document.hidden || isScareSuppressed() || isScareShowing()) return 'wait'
          return 'fire'
        },
        fire: () => void scareWithName(code, 'random'),
      }),
    [code],
  )

  return <TvControl />
}
