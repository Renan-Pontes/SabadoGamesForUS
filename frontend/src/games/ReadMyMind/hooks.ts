import { useEffect, useRef, useState } from 'react'
import { playSfx, speakFestive } from '../../halloween/audio'
import { triggerScare } from '../../halloween/scare'
import { haptic } from '../utils'
import type { GameState } from './types'
import {
  TIMEOUT_LINE,
  eventsBetween,
  finalLine,
  levelDoneLine,
  mistakeOf,
  newLevelLine,
  snapOf,
  type TableSnap,
} from './view'

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
 */
export function useTableSounds(state: GameState) {
  const key = JSON.stringify({ ...snapOf(state), maxRounds: state.maxRounds })
  const previous = useRef<TableSnap | null>(null)

  useEffect(() => {
    const after = JSON.parse(key) as TableSnap & { maxRounds: number }
    const before = previous.current
    previous.current = after
    if (!before) return

    const events = eventsBetween(before, after)
    if (!events.length) return

    const timers: number[] = []
    let stopVoice: (() => void) | null = null
    let voiceFree = 0
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
    // Falas em fila: uma não corta a outra quando dois momentos chegam juntos.
    const say = (ms: number, text: string) => {
      const at = Math.max(ms, voiceFree)
      voiceFree = at + 3400
      later(at, () => {
        stopVoice?.()
        stopVoice = speakFestive(text)
      })
    }

    for (const event of events) {
      if (event === 'start') {
        playSfx('sleigh', { volume: 0.8 })
        say(800, newLevelLine(after.round))
      } else if (event === 'card') {
        playSfx('whoosh', { volume: 0.45 })
        playSfx('pop', { volume: 0.9, delay: 0.32 })
        if (after.top !== null) say(650, String(after.top))
      } else if (event === 'cut') {
        playSfx('pop', { volume: 0.7 })
        playSfx('boing', { volume: 1, delay: 0.25 })
        playSfx('buzzer', { volume: 0.6, delay: 0.75 })
        say(1500, after.mistakeLine)
      } else if (event === 'timeout') {
        playSfx('buzzer', { volume: 0.7 })
        playSfx('boing', { delay: 0.45 })
        say(1000, after.mode === 'coop' ? TIMEOUT_LINE : 'O tempo acabou! Alguém virou boneco de neve.')
      } else if (event === 'levelDone') {
        playSfx('chime')
        playSfx('ding', { delay: 0.3 })
        playSfx('sleigh', { volume: 0.7, delay: 0.8 })
        say(1300, levelDoneLine(after.round, after.maxRounds))
      } else if (event === 'newLevel') {
        playSfx('drumroll', { volume: 0.6 })
        playSfx('sleigh', { volume: 0.6, delay: 1.2 })
        say(1500, newLevelLine(after.round))
      } else if (event === 'win') {
        playSfx('win')
        playSfx('chime', { delay: 0.6 })
        later(2600, () => triggerScare('giftRain'))
        say(1800, finalLine(after))
      } else if (event === 'lose') {
        playSfx('fail', { delay: 0.4 })
        say(1800, finalLine(after))
      }
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      stopVoice?.()
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
