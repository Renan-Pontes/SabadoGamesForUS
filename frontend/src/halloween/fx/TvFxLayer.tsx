import { useEffect } from 'react'
import { getSoundState, setMusicEnabled, setRandomScaresEnabled } from '../audio'
import {
  RARE_SCARE,
  SCARES_WITH_NAME,
  isScareShowing,
  isScareSuppressed,
  pickAutoScare,
  resolveScareKind,
  scareNames,
  triggerScare,
  NIGHTMARE,
} from '../scare'
import { getRoomFx } from './api'
import type { RoomFx } from './api'
import { canRollRareScare, isNarrating, randomScareDecision } from './autoScare'
import type { AutoScareState } from './autoScare'
import { decideFx } from './decide'
import type { FxAction } from './decide'
import { loadSeenFx, saveSeenFx } from './memory'
import { roomPlayerNames } from './names'
import { startRandomScares } from './randomScares'
import { startRareScare } from './rareScare'
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

/** O estado do app que decide se um susto automático pode sair agora. */
function autoScareState(): AutoScareState {
  return {
    enabled: getSoundState().randomScares,
    hidden: document.hidden,
    suppressed: isScareSuppressed(),
    showing: isScareShowing(),
    narrating: isNarrating(),
  }
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
        // Espera também a narração do jogo acabar (o susto alto engoliria a frase).
        check: () => randomScareDecision(autoScareState()),
        // Assustador no máximo de 6 em 6 min; no meio, meme (pickAutoScare).
        fire: () => void scareWithName(code, pickAutoScare()),
        // Pesadelo: um susto a cada 3–6 min.
        minDelayMs: NIGHTMARE.randomMinMs,
        maxDelayMs: NIGHTMARE.randomMaxMs,
      }),
    [code],
  )

  // O susto raro: 1 chance em 5000 a cada segundo, por fora dos sustos de 3–6 min.
  useEffect(
    () =>
      startRareScare({
        canRoll: () => canRollRareScare(autoScareState()),
        fire: () => triggerScare(RARE_SCARE),
      }),
    [],
  )

  return <TvControl />
}
