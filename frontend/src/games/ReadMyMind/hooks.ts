import { useEffect, useRef, useState } from 'react'
import { playSfx, speakFestive } from '../../halloween/audio'
import { triggerScare } from '../../halloween/scare'
import { paceDelay } from '../../lib/spokenLines'
import { haptic } from '../utils'
import type { GameState } from './types'
import { eventsBetween, mistakeOf, snapOf, speechForEvents, type TableSnap } from './view'

/**
 * `true` durante `ms` depois que `key` muda para um valor não nulo. Guarda o
 * instante em que viu a chave nova (padrão "ajustar estado quando a prop
 * muda", sem efeito) e usa o `now` do relógio da tela — o render fica puro.
 */
export function useFreshFor(key: string | null, ms: number, now: number): boolean {
  const [seen, setSeen] = useState<{ key: string | null; at: number }>({ key, at: now })
  if (seen.key !== key) {
    setSeen({ key, at: now })
    return key !== null
  }
  return key !== null && now - seen.at < ms
}

/**
 * Som e voz da TV: compara o retrato da mesa com o do poll anterior e toca
 * uma vez por momento (carta na mesa, erro, nível vencido, fim). Ao abrir a
 * TV no meio da partida não toca nada — só a partir da primeira mudança.
 * A voz fala pouco: a carta jogada é só efeito sonoro.
 */
export function useTableSounds(state: GameState) {
  const key = JSON.stringify({ ...snapOf(state), maxRounds: state.maxRounds })
  const previous = useRef<TableSnap | null>(null)
  /** A fala sobrevive aos polls (a próxima carta não corta o aviso do erro). */
  const voice = useRef<{ timer: number | null; stop: (() => void) | null; lastAt: number | null }>({ timer: null, stop: null, lastAt: null })

  // Sai da TV: cala a voz e o que estava para ser dito.
  useEffect(() => {
    const current = voice.current
    return () => {
      if (current.timer !== null) window.clearTimeout(current.timer)
      current.stop?.()
    }
  }, [])

  useEffect(() => {
    const after = JSON.parse(key) as TableSnap & { maxRounds: number }
    const before = previous.current
    previous.current = after
    if (!before) return

    const events = eventsBetween(before, after)
    if (!events.length) return

    const timers: number[] = []
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))

    for (const event of events) {
      if (event === 'start') {
        playSfx('sleigh', { volume: 0.8 })
      } else if (event === 'card') {
        playSfx('whoosh', { volume: 0.45 })
        playSfx('pop', { volume: 0.9, delay: 0.32 })
      } else if (event === 'cut') {
        playSfx('pop', { volume: 0.7 })
        playSfx('boing', { volume: 1, delay: 0.25 })
        playSfx('buzzer', { volume: 0.6, delay: 0.75 })
      } else if (event === 'timeout') {
        playSfx('buzzer', { volume: 0.7 })
        playSfx('boing', { delay: 0.45 })
      } else if (event === 'levelDone') {
        playSfx('chime')
        playSfx('ding', { delay: 0.3 })
        playSfx('sleigh', { volume: 0.7, delay: 0.8 })
      } else if (event === 'newLevel') {
        playSfx('drumroll', { volume: 0.6 })
        playSfx('sleigh', { volume: 0.6, delay: 1.2 })
      } else if (event === 'win') {
        playSfx('win')
        playSfx('chime', { delay: 0.6 })
        // Visita de Natal: um presente desce de paraquedas no canto da TV.
        later(2600, () => triggerScare('parachuteGift'))
      } else if (event === 'lose') {
        playSfx('fail', { delay: 0.4 })
      }
    }

    const speech = speechForEvents(events, after)
    if (speech) {
      const v = voice.current
      const wait = paceDelay(speech.ms, v.lastAt, Date.now())
      // Aviso de erro atrasado já perdeu a hora: melhor ficar quieta.
      if (!(speech.minor && wait > speech.ms + 1500)) {
        // Uma fala nova substitui a que ainda não tinha começado.
        if (v.timer !== null) window.clearTimeout(v.timer)
        v.timer = window.setTimeout(() => {
          v.timer = null
          v.lastAt = Date.now()
          v.stop?.()
          v.stop = speakFestive(speech.text)
        }, wait)
      }
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [key])
}

/**
 * Vibração do celular nos momentos que importam: mão nova, erro (mais
 * forte se a culpa ou a carta escondida era sua), vida perdida, nível
 * vencido e fim de jogo. Silencioso no primeiro desenho.
 */
export function usePhoneBuzz(state: GameState, playerId: string) {
  const m = mistakeOf(state)
  const involved = Boolean(
    m && (m.cutterId === playerId || m.victimId === playerId || m.hidden.some((card) => card.playerId === playerId)),
  )
  const won = state.winner === 'team' || (state.winner !== null && state.winner === playerId)
  const key = JSON.stringify({
    mistake: m?.key ?? null,
    involved,
    phase: state.phase,
    round: state.round,
    lives: state.lives,
    out: state.players.find((p) => p.id === playerId)?.isEliminated ?? false,
    won,
  })
  const previous = useRef<string | null>(null)

  useEffect(() => {
    const before = previous.current ? (JSON.parse(previous.current) as Record<string, unknown>) : null
    previous.current = key
    if (!before) return
    const after = JSON.parse(key) as Record<string, unknown>

    if (after.phase === 'gameOver' && before.phase !== 'gameOver') {
      haptic(after.won ? [40, 40, 40, 40, 220] : [320])
    } else if (after.mistake && after.mistake !== before.mistake) {
      haptic(after.involved ? [90, 50, 90, 50, 180] : [60, 40, 60])
    } else if (after.out && !before.out) {
      haptic([300])
    } else if ((after.lives as number) < (before.lives as number)) {
      haptic([200])
    } else if (after.phase === 'roundBreak' && before.phase !== 'roundBreak') {
      haptic([30, 30, 70])
    } else if (after.phase === 'playing' && (before.phase !== 'playing' || after.round !== before.round)) {
      haptic([20, 40, 20, 40, 20])
    }
  }, [key])
}
