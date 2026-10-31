import type { SfxName } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer } from '../../engine/types'
import {
  FALL_LINES,
  FEW_CURSE_LINES,
  FINISH_LINE,
  LEAD_LINES,
  MIDNIGHT_LINE,
  ROLL_LINES,
  WEAK_CURSE_LINES,
  fillLine,
  witchOf,
} from './content'
import { MIN_CURSES, RACE_TIMING, raceBeats, type CvRace, type RaceBeat } from './engine'

/**
 * Ajudantes das telas (fora dos .tsx por causa da regra do react-refresh:
 * Tv.tsx e Phone.tsx só exportam o componente). Nada aqui decide jogo —
 * só traduz o estado em desenho.
 */

/** O que a TV mostra num instante da corrida. */
export type RaceFrame = {
  /** Onde cada bruxa aparece agora. */
  positions: number[]
  /** Desempate de casa agora (mesma regra do motor: quem chegou por último na frente). */
  arrivals: number[]
  /** O momento atual (último momento quando a animação acabou). */
  beat: RaceBeat | null
  /** Índice do momento: o som toca uma vez por momento. */
  beatIndex: number
  /** ms desde o começo do momento. */
  beatElapsed: number
  /** A bruxa em foco (voando, caindo, liderando ou cruzando a chegada). */
  active: number | null
  /** O dado da vez: girando ou mostrando o número. */
  die: { witch: number; value: number; rolling: boolean } | null
  /** A amaldiçoada está tremendo (antes de cair). */
  shaking: boolean
  /** A amaldiçoada já caiu. */
  fallen: boolean
  /** Fala do narrador. */
  caption: string
  done: boolean
}

/** Fala escolhida pela etapa e posição: sempre a mesma no mesmo momento. */
function line(lines: readonly string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length] ?? lines[0] ?? ''
}

/**
 * Traduz a corrida sorteada pelo motor no quadro do instante `elapsed`
 * (ms desde `race.at`). Função pura: a TV chama a cada ~100 ms.
 */
export function raceFrame(race: CvRace, elapsed: number, round: number): RaceFrame {
  const beats = raceBeats(race)
  const t = Math.max(0, elapsed)
  const last = beats[beats.length - 1]
  const total = last ? last.at + last.ms : 0
  const done = t >= total

  let beatIndex = 0
  for (let index = 0; index < beats.length; index += 1) {
    if (beats[index].at <= t) beatIndex = index
  }
  const beat = beats[beatIndex] ?? null
  const beatElapsed = beat ? t - beat.at : 0

  // Posições: largada da etapa + os voos que já aconteceram + o tombo. A
  // ordem de chegada segue a regra do motor (quem voou por último fica na
  // frente; quem caiu, atrás de todo mundo da casa).
  const positions = [...race.start]
  const arrivals = race.startArrivals ? [...race.startArrivals] : race.start.map((_, witch) => witch)
  const fresh = Math.max(0, ...arrivals.map((value) => Math.abs(value))) + 1
  for (const candidate of beats) {
    if (candidate.kind !== 'step') continue
    const step = race.steps[candidate.index]
    if (step && t >= candidate.at + RACE_TIMING.roll) {
      positions[step.witch] = step.to
      arrivals[step.witch] = fresh + candidate.index
    }
  }
  const fall = beats.find((candidate) => candidate.kind === 'fall')
  const fallen = Boolean(fall) && race.fell !== null && t >= (fall?.at ?? 0) + RACE_TIMING.drop
  if (fallen && race.fell !== null && race.fallTo !== null) {
    positions[race.fell] = race.fallTo
    arrivals[race.fell] = -(fresh + 100)
  }
  const finalPositions = done ? [...race.end] : positions

  let active: number | null = null
  let die: RaceFrame['die'] = null
  let caption = ''
  const leader = race.order[0]
  switch (beat?.kind) {
    case 'intro':
      caption = `Etapa ${round}: valendo!`
      break
    case 'step': {
      const step = race.steps[beat.index]
      if (step) {
        const rolling = beatElapsed < RACE_TIMING.roll
        active = step.witch
        // Enquanto gira, o dado passa pelas faces (a cada ~90 ms).
        die = { witch: step.witch, value: rolling ? 1 + (Math.floor(beatElapsed / 90) % 3) : step.roll, rolling }
        caption = rolling
          ? `🎲 ${witchOf(step.witch).name} rola o dado…`
          : fillLine(line(ROLL_LINES[step.roll as 1 | 2 | 3] ?? ROLL_LINES[1], round + beat.index), witchOf(step.witch).name)
      }
      break
    }
    case 'fall':
      active = race.fell
      caption =
        race.fell === null
          ? ''
          : fallen
            ? fillLine(line(FALL_LINES, round), witchOf(race.fell).name, race.curses[race.fell] ?? 0)
            : `🕯️ A maldição pegou ${witchOf(race.fell).name}…`
      break
    case 'weak':
      // Sem 2 maldições na mesma bruxa, fala da regra; com 2+ empatadas, do empate.
      caption = line(Math.max(0, ...race.curses) < MIN_CURSES ? FEW_CURSE_LINES : WEAK_CURSE_LINES, round)
      break
    case 'lead':
      active = leader
      caption = fillLine(line(LEAD_LINES, round), witchOf(leader).name)
      break
    case 'finish':
      active = race.finished
      caption = fillLine(FINISH_LINE, witchOf(race.finished).name)
      break
    case 'midnight':
      active = race.finished
      caption = fillLine(MIDNIGHT_LINE, witchOf(race.finished).name)
      break
  }

  return {
    positions: finalPositions,
    arrivals,
    beat,
    beatIndex,
    beatElapsed,
    active,
    die,
    shaking: beat?.kind === 'fall' && !fallen,
    fallen,
    caption,
    done,
  }
}

/** Um efeito sonoro: nome, atraso (s) e volume. */
export type SoundCue = { name: SfxName; delay?: number; volume?: number }

/** O que a TV toca num momento da corrida (uma vez por momento). */
export type RaceCue = { sfx: SoundCue[]; scare: 'pipe' | null; speak: string | null }

/**
 * Os sons de cada momento da corrida. Nada do caminho alto (grito,
 * guincho...): com 15 pessoas alguém cai em ~3 de cada 4 etapas, e o grito
 * toca muito mais alto e cala a música. O susto de meme é o cano de metal
 * caindo (a vassoura quebrando), só na 1ª queda da partida.
 */
export function raceCue(
  kind: RaceBeat['kind'],
  { roll, firstFall, witch }: { roll: number; firstFall: boolean; witch: string },
): RaceCue {
  const landed = RACE_TIMING.roll / 1000
  const dropped = RACE_TIMING.drop / 1000
  const cue = (sfx: SoundCue[], scare: RaceCue['scare'] = null, speak: string | null = null): RaceCue => ({ sfx, scare, speak })
  switch (kind) {
    case 'intro':
      return cue([{ name: 'gong', volume: 0.7 }])
    case 'step': {
      // Dado chacoalhando, a bruxa sai voando e, se tirou 3, gargalha.
      const sfx: SoundCue[] = [
        { name: 'bones', volume: 0.8 },
        { name: 'pop', delay: landed },
        { name: 'whoosh', delay: landed + 0.05 },
      ]
      if (roll === 3) sfx.push({ name: 'laugh', delay: landed + 0.3, volume: 0.7 })
      return cue(sfx)
    }
    case 'fall':
      // Na 1ª queda, o susto já traz o cano batendo; nas outras, a vassoura quebra com um "clang".
      return firstFall
        ? cue([{ name: 'thunder' }, { name: 'boom', delay: dropped + 0.15 }], 'pipe')
        : cue([{ name: 'thunder' }, { name: 'clang', delay: dropped }, { name: 'boom', delay: dropped + 0.15 }])
    case 'weak':
      return cue([{ name: 'fail' }])
    case 'lead':
      return cue([{ name: 'ding' }])
    case 'finish':
      return cue([{ name: 'win', delay: 1.2 }], null, `${witch} venceu a corrida!`)
    case 'midnight':
      return cue([{ name: 'bell', delay: 0.6 }, { name: 'bell', delay: 1.4 }], null, `Meia-noite! ${witch} venceu a corrida.`)
  }
}

/**
 * Sustos aleatórios da festa (a cada 4–9 min): seguros nas apostas, na
 * corrida e no placar da chegada (o momento da campeã); liberados no placar
 * entre etapas e no fim — com 2 ou 3 pessoas quase ninguém cai da vassoura,
 * e sem isso a partida inteira passava sem susto nenhum.
 */
export function randomScaresAllowed(state: { over: boolean; phase: string; winner: number | null }): boolean {
  return state.over || (state.phase === 'payout' && state.winner === null)
}

/** Primeira queda da partida? (o susto de meme só vem nessa). */
export function isFirstFall(history: readonly { round: number; fell: number | null }[], round: number): boolean {
  return !history.some((entry) => entry.round < round && entry.fell !== null)
}

/** "1º", "2º"... */
export function ordinal(place: number): string {
  return `${place}º`
}

/** Nomes dos jogadores em português ("Ana, Bia e Caio"), ou o texto de "ninguém". */
export function namesOrNobody(ids: readonly number[], players: readonly HPlayer[], nobody = 'ninguém'): string {
  return ids.length ? listNames(ids.map((id) => nameOf(players, id))) : nobody
}

/** Como `namesOrNobody`, mas cabe na TV: "Ana, Bia, Caio e mais 4". */
export function shortNames(ids: readonly number[], players: readonly HPlayer[], nobody = 'ninguém', max = 6): string {
  if (ids.length <= max) return namesOrNobody(ids, players, nobody)
  return `${ids.slice(0, max).map((id) => nameOf(players, id)).join(', ')} e mais ${ids.length - max}`
}

/** "1 doce" / "3 doces". */
export function candies(count: number): string {
  return `${count} ${count === 1 ? 'doce' : 'doces'}`
}

/** Vibração mais forte ao fechar a aposta (protegida: desktop e iPhone não vibram). */
export function buzz(pattern: number | number[] = [30, 40, 30]): void {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern)
  } catch {
    // Sem vibração: tudo bem.
  }
}
