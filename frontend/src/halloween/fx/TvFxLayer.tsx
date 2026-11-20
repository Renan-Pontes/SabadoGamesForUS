import { useEffect } from 'react'
import { getSoundState, setMusicEnabled, setRandomScaresEnabled } from '../audio'
import {
  CAMEO_INFO,
  RARE_SCARE,
  SCARES_WITH_NAME,
  isCameoRequest,
  isCameoShowing,
  isScareShowing,
  isScareSuppressed,
  pickAutoScare,
  pickCameo,
  resolveCameo,
  resolveScareKind,
  scareNames,
  triggerScare,
} from '../scare'
import type { Cameo, ConcreteScare } from '../scare'
import { loadCustomJumpscare } from '../scare/customJumpscare'
import { ambientCameoDecision, startAmbientCameos } from './ambientCameos'
import type { AmbientCameoState } from './ambientCameos'
import { getRoomFx } from './api'
import type { RoomFx } from './api'
import { canRollRareScare, isNarrating, randomScareDecision } from './autoScare'
import type { AutoScareState } from './autoScare'
import { decideFx, seasonFxKind } from './decide'
import type { FxAction } from './decide'
import { loadSeenFx, saveSeenFx } from './memory'
import { roomPlayerNames } from './names'
import { startRandomScares } from './randomScares'
import { startRareScare } from './rareScare'
import TvControl from './TvControl'
import { AMBIENT_CAMEOS, AUTO_SCARES } from '../../season'

/** Consulta leve do `fx` da sala (o host manda susto / liga a música). */
const POLL_MS = 1500

/**
 * Efeito com nome: usa os nomes que o jogo informou ou busca os da sala. No
 * Natal (AUTO_SCARES desligado), o host só manda visitas de Natal.
 */
async function scareWithName(code: string, requested: string, name?: string) {
  const safe = seasonFxKind(requested, AUTO_SCARES)
  const cameo = isCameoRequest(safe)
  const kind = cameo ? resolveCameo(safe) : resolveScareKind(safe)
  const wantsName = cameo ? Boolean(CAMEO_INFO[kind as Cameo].named) : SCARES_WITH_NAME.includes(kind as ConcreteScare)
  let chosen = name
  if (!chosen && wantsName && scareNames().length === 0) {
    const names = await roomPlayerNames(code)
    if (names.length) chosen = names[Math.floor(Math.random() * names.length)]
  }
  triggerScare(kind, chosen ? { name: chosen } : undefined)
}

/** O estado do app que decide se uma visita de Natal automática pode sair agora. */
function ambientCameoState(): AmbientCameoState {
  return {
    enabled: AMBIENT_CAMEOS && getSoundState().cameos,
    hidden: document.hidden,
    suppressed: isScareSuppressed(),
    scareShowing: isScareShowing(),
    cameoShowing: isCameoShowing(),
    narrating: isNarrating(),
  }
}

/** O estado do app que decide se um susto automático pode sair agora. */
function autoScareState(): AutoScareState {
  return {
    enabled: AUTO_SCARES && getSoundState().randomScares,
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
 * Efeitos da sala na TV: executa o que o host manda (visita, música),
 * solta visitas de Natal (e, no Halloween, sustos) de tempos em tempos e
 * mostra o controle discreto do canto. Montado pela camada global só nas
 * rotas de TV.
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
        // Assustador só de 15 em 15 min; no meio, meme (pickAutoScare).
        fire: () => void scareWithName(code, pickAutoScare()),
      }),
    [code],
  )

  // Visitas de Natal: uma a cada 60–150 s, esperando revelação, narração e outra visita.
  useEffect(
    () =>
      startAmbientCameos({
        check: () => ambientCameoDecision(ambientCameoState()),
        fire: () => triggerScare(pickCameo()),
      }),
    [],
  )

  // O susto raro: 1 chance em 5000 a cada segundo, por fora dos sustos de 4–9 min.
  // Já deixa carregado o jumpscare próprio de public/jumpscare/, se houver.
  useEffect(() => {
    void loadCustomJumpscare()
  }, [])

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
