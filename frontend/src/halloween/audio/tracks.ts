import { freq, transpose } from './notes'
import { LoopScheduler } from './scheduler'
import type { StepEvent } from './scheduler'
import {
  bass,
  bell,
  brass,
  brush,
  clop,
  drone,
  glass,
  hat,
  heart,
  kick,
  lead,
  musicBox,
  organ,
  pluck,
  ride,
  safeDisconnect,
  snare,
  strings,
  tickTock,
  wind,
  xylo,
} from './synth'
import type { StopLayer, Voice } from './synth'
import type { MusicTrack } from './types'

/**
 * As nove trilhas da Noite do Terror, escritas como partitura.
 *
 * Cada trilha é um laço curto (15–60 s) tocado pelo agendador com
 * antecedência. Melodias de domínio público: Dies Irae (canto gregoriano),
 * "Na Gruta do Rei da Montanha" (Grieg) e a abertura da Tocata em Ré menor
 * (Bach). A valsa, o tique-taque, o swing e a perseguição são originais.
 */

// ---------------------------------------------------------------------------
// Notação
// ---------------------------------------------------------------------------

/** [compasso, tempo, nota, duração em tempos, força] — compasso e tempo começam em 1. */
type Row = [bar: number, beat: number, note: string, len: number, vel?: number]
/** [tempo absoluto a partir de 0, nota, duração em tempos, força]. */
type Abs = [at: number, note: string, len: number, vel?: number]

type Ev = { at: number; f: number; len: number; vel: number }

type RowOptions = { barOffset?: number; semitones?: number; vel?: number }

function rows(beatsPerBar: number, list: Row[], options: RowOptions = {}): Ev[] {
  const { barOffset = 0, semitones = 0, vel = 1 } = options
  return list.map(([bar, beat, note, len, force = 1]) => ({
    at: (bar - 1 + barOffset) * beatsPerBar + (beat - 1),
    f: transpose(freq(note), semitones),
    len,
    vel: force * vel,
  }))
}

function abs(list: Abs[], vel = 1): Ev[] {
  return list.map(([at, note, len, force = 1]) => ({ at, f: freq(note), len, vel: force * vel }))
}

type PlayContext = { beatDur: number; cycle: number }
type Part = { events: Ev[]; play: (v: Voice, t: number, ev: Ev, c: PlayContext) => void }
type Compiled = Map<number, { part: Part; ev: Ev; offset: number }[]>

/** Indexa os eventos pelo passo da grade em que caem (fora da grade vira deslocamento). */
function compile(parts: Part[], stepsPerBeat: number): Compiled {
  const map: Compiled = new Map()
  for (const part of parts) {
    for (const ev of part.events) {
      const exact = ev.at * stepsPerBeat
      const step = Math.floor(exact + 1e-6)
      const offset = (exact - step) / stepsPerBeat
      const bucket = map.get(step) ?? []
      bucket.push({ part, ev, offset: Math.abs(offset) < 1e-6 ? 0 : offset })
      map.set(step, bucket)
    }
  }
  return map
}

function playCompiled(map: Compiled, v: Voice, e: TrackStep) {
  const bucket = map.get(e.loopStep)
  if (!bucket) return
  for (const { part, ev, offset } of bucket) {
    part.play(v, e.time + offset * e.beatDur, ev, { beatDur: e.beatDur, cycle: e.cycle })
  }
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** Desafina de leve (em cents) — a caixinha de música "cansada" das voltas ímpares. */
function wobble(f: number, cents: number) {
  return f * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200)
}

// ---------------------------------------------------------------------------
// Definição de trilha
// ---------------------------------------------------------------------------

export type TrackStep = StepEvent & { stepDur: number; beatDur: number }

export type TrackRuntime = {
  step(e: TrackStep): void
  /** Desliga camadas contínuas (vento, zumbido) no horário dado. */
  stop?(at: number): void
  /** Solta nós próprios da trilha (filtros compartilhados). */
  dispose?(): void
}

export type TrackDef = {
  bpm: number
  stepsPerBeat: number
  /** Passos do laço (sem a introdução). */
  loopSteps: number
  /** Passos tocados uma vez antes do laço. */
  introSteps?: number
  /** Ganho da trilha: equilibra uma contra a outra. */
  level: number
  create(v: Voice, t0: number): TrackRuntime
}

// ---------------------------------------------------------------------------
// lobby — valsa de caixinha de música em Ré menor (original)
// ---------------------------------------------------------------------------

const LOBBY_MELODY: Row[] = [
  [1, 1, 'A4', 1], [1, 2, 'D5', 1], [1, 3, 'E5', 1],
  [2, 1, 'F5', 2], [2, 3, 'E5', 0.5], [2, 3.5, 'F5', 0.5],
  [3, 1, 'E5', 1], [3, 2, 'D5', 1], [3, 3, 'Bb4', 1],
  [4, 1, 'A4', 2], [4, 3, 'C#5', 0.5], [4, 3.5, 'E5', 0.5],
  [5, 1, 'A4', 1], [5, 2, 'D5', 1], [5, 3, 'E5', 1],
  [6, 1, 'F5', 1], [6, 2, 'G5', 1], [6, 3, 'A5', 1],
  [7, 1, 'Bb5', 1], [7, 2, 'A5', 1], [7, 3, 'E5', 1],
  [8, 1, 'D5', 3],
  [9, 1, 'D6', 1], [9, 2, 'C6', 1], [9, 3, 'Bb5', 1],
  [10, 1, 'A5', 2], [10, 3, 'F5', 1],
  [11, 1, 'G5', 1], [11, 2, 'F5', 1], [11, 3, 'E5', 1],
  [12, 1, 'E5', 2], [12, 3, 'C#5', 1],
  [13, 1, 'D5', 1], [13, 2, 'F5', 1], [13, 3, 'A5', 1],
  [14, 1, 'Bb5', 1], [14, 2, 'A5', 1], [14, 3, 'G5', 1],
  [15, 1, 'F5', 1], [15, 2, 'E5', 1], [15, 3, 'C#5', 1],
  [16, 1, 'D5', 3],
]

/** Um acorde por compasso: [baixo, notas do "pá-pá"]. */
const LOBBY_CHORDS: [string, string[]][] = [
  ['D3', ['F3', 'A3']], ['D3', ['F3', 'A3']], ['G2', ['Bb3', 'D4']], ['A2', ['C#4', 'E4']],
  ['D3', ['F3', 'A3']], ['D3', ['F3', 'A3']], ['A2', ['C#4', 'E4']], ['D3', ['F3', 'A3']],
  ['Bb2', ['D4', 'F4']], ['F2', ['A3', 'C4']], ['G2', ['Bb3', 'D4']], ['A2', ['G3', 'C#4']],
  ['D3', ['F3', 'A3']], ['G2', ['Bb3', 'D4']], ['A2', ['G3', 'C#4']], ['D3', ['F3', 'A3']],
]

const lobby: TrackDef = {
  bpm: 100,
  stepsPerBeat: 2,
  loopSteps: 16 * 3 * 2,
  level: 1,
  create(v) {
    const accompaniment: Row[] = LOBBY_CHORDS.flatMap(([root, upper], index): Row[] => [
      [index + 1, 1, root, 1, 0.5],
      ...upper.flatMap((note): Row[] => [
        [index + 1, 2, note, 1, 0.26],
        [index + 1, 3, note, 1, 0.26],
      ]),
    ])
    const map = compile(
      [
        {
          events: rows(3, LOBBY_MELODY),
          // Nas voltas ímpares a caixinha "cansa" e desafina: arrepia sem ninguém saber por quê.
          play: (voice, t, ev, c) => musicBox(voice, t, c.cycle % 2 === 1 ? wobble(ev.f, 14) : ev.f, 0.9 * ev.vel),
        },
        { events: rows(3, accompaniment), play: (voice, t, ev) => musicBox(voice, t, ev.f, ev.vel, 0.25) },
      ],
      2,
    )
    return { step: (e) => playCompiled(map, v, e) }
  },
}

// ---------------------------------------------------------------------------
// tension — zumbido grave + coração + notas soltas dissonantes
// ---------------------------------------------------------------------------

const TENSION_NOTES = ['D5', 'Eb5', 'G#5', 'A5', 'C#6', 'F5'].map((note) => freq(note))

const tension: TrackDef = {
  bpm: 62,
  stepsPerBeat: 2,
  loopSteps: 8 * 4 * 2,
  level: 0.6,
  create(v, t0) {
    const stopDrone: StopLayer = drone(v, t0, [freq('D2'), freq('A2')], 0.11, 240)
    return {
      step(e) {
        const inBar = e.loopStep % 8
        // Metade do laço o coração bate no 1 e no 3, a outra metade acelera
        // para todo tempo: a fase de conversa dura minutos e coração
        // constante vira metrônomo.
        const racing = e.loopStep >= 32
        if (e.loopStep % 2 === 0 && (racing || inBar === 0 || inBar === 4)) {
          heart(v, e.time, inBar === 0 ? 0.74 : 0.6)
        }
        if (inBar === 3 || inBar === 7) {
          if (Math.random() < 0.38) glass(v, e.time, pick(TENSION_NOTES), 3.6, 0.85)
        }
        // Um sino distante a cada volta, para lembrar que o relógio corre.
        if (e.loopStep === 0) bell(v, e.time, freq('D3'), 0.35, 5, 0.55)
      },
      stop: stopDrone,
    }
  },
}

// ---------------------------------------------------------------------------
// night — vento + sino lento + órgão com o Dies Irae
// ---------------------------------------------------------------------------

const DIES_IRAE: Row[] = [
  // "Dies irae, dies illa": F E F D E C D D
  [1, 1, 'F4', 1], [1, 2, 'E4', 1], [1, 3, 'F4', 1], [1, 4, 'D4', 1],
  [2, 1, 'E4', 1], [2, 2, 'C4', 1], [2, 3, 'D4', 1], [2, 4, 'D4', 3],
  // A mesma frase, uma oitava abaixo
  [5, 1, 'F3', 1], [5, 2, 'E3', 1], [5, 3, 'F3', 1], [5, 4, 'D3', 1],
  [6, 1, 'E3', 1], [6, 2, 'C3', 1], [6, 3, 'D3', 1], [6, 4, 'D3', 3],
  // Resposta (original), no mesmo modo
  [9, 1, 'A4', 1], [9, 2, 'G4', 1], [9, 3, 'A4', 1], [9, 4, 'F4', 1],
  [10, 1, 'G4', 1], [10, 2, 'E4', 1], [10, 3, 'F4', 1], [10, 4, 'D4', 1],
  [11, 1, 'E4', 2], [11, 3, 'C#4', 2],
  [12, 1, 'D4', 4],
]

const NIGHT_CHORDS: Row[] = [
  [1, 1, 'D3', 11], [1, 1, 'A3', 11],
  [5, 1, 'D2', 11], [5, 1, 'A2', 11],
  [9, 1, 'D3', 4], [9, 1, 'F3', 4], [9, 1, 'A3', 4],
  [10, 1, 'C3', 2], [10, 1, 'E3', 2], [10, 1, 'G3', 2],
  [10, 3, 'D3', 2], [10, 3, 'F3', 2], [10, 3, 'A3', 2],
  [11, 1, 'A2', 4], [11, 1, 'C#3', 4], [11, 1, 'E3', 4],
  [12, 1, 'D2', 4], [12, 1, 'D3', 4], [12, 1, 'F3', 4], [12, 1, 'A3', 4],
]

const NIGHT_BELLS: Row[] = [1, 3, 5, 7, 9, 11, 13, 15].map(
  (bar, index): Row => [bar, 1, index % 2 === 0 ? 'D3' : 'A2', 1],
)

const night: TrackDef = {
  bpm: 60,
  stepsPerBeat: 2,
  loopSteps: 16 * 4 * 2,
  level: 1.25,
  create(v, t0) {
    const stopWind = wind(v, t0, 0.09)
    const map = compile(
      [
        { events: rows(4, DIES_IRAE), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur * 0.94, 0.9, 0.5) },
        { events: rows(4, NIGHT_CHORDS), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur * 0.98, 0.5, 0.5) },
        { events: rows(4, NIGHT_BELLS), play: (voice, t, ev) => bell(voice, t, ev.f, 0.5, 5.5, 0.55) },
      ],
      2,
    )
    return { step: (e) => playCompiled(map, v, e), stop: stopWind }
  },
}

// ---------------------------------------------------------------------------
// day — relógio tiquetaqueando + pizzicato "na ponta dos pés" (original)
// ---------------------------------------------------------------------------

const DAY_MELODY: Row[] = [
  [1, 1, 'A3', 0.5], [1, 2, 'C4', 0.5], [1, 3, 'E4', 0.5], [1, 4, 'D#4', 0.5], [1, 4.5, 'E4', 0.5],
  [2, 1, 'C4', 0.5], [2, 2, 'A3', 0.5], [2, 3, 'B3', 0.5], [2, 3.5, 'C4', 0.5], [2, 4, 'B3', 0.5],
  [3, 1, 'A3', 0.5], [3, 2, 'C4', 0.5], [3, 3, 'E4', 0.5], [3, 4, 'A4', 0.5],
  [4, 1, 'G#4', 0.5], [4, 2, 'E4', 0.5], [4, 3, 'B3', 0.5], [4, 4, 'E4', 0.5],
  [5, 1, 'F4', 0.5], [5, 2, 'A4', 0.5], [5, 3, 'C5', 0.5], [5, 4, 'B4', 0.5], [5, 4.5, 'A4', 0.5],
  [6, 1, 'G#4', 0.5], [6, 2, 'E4', 0.5], [6, 3, 'F4', 0.5], [6, 3.5, 'E4', 0.5], [6, 4, 'D4', 0.5],
  [7, 1, 'C4', 0.5], [7, 2, 'E4', 0.5], [7, 3, 'A4', 0.5], [7, 4, 'G#4', 0.5],
  [8, 1, 'A4', 0.5], [8, 2, 'E4', 0.5], [8, 3, 'A3', 0.5],
]

const DAY_BASS: Row[] = (
  [
    ['A2', 'E2'], ['A2', 'E2'], ['A2', 'C3'], ['E2', 'B2'],
    ['D2', 'A2'], ['E2', 'B2'], ['A2', 'E2'], ['A2', 'E2'],
  ] as [string, string][]
).flatMap(([first, third], index): Row[] => [
  [index + 1, 1, first, 0.5],
  [index + 1, 3, third, 0.5],
])

const day: TrackDef = {
  bpm: 120,
  stepsPerBeat: 2,
  loopSteps: 8 * 4 * 2,
  level: 2.5,
  create(v) {
    const map = compile(
      [
        { events: rows(4, DAY_MELODY), play: (voice, t, ev) => pluck(voice, t, ev.f, 0.8, 0.28) },
        { events: rows(4, DAY_BASS), play: (voice, t, ev) => pluck(voice, t, ev.f, 0.85, 0.32, 0.1) },
      ],
      2,
    )
    return {
      step(e) {
        playCompiled(map, v, e)
        if (e.loopStep % 2 === 0) tickTock(v, e.time, 0.26, (e.loopStep / 2) % 2 === 0)
      },
    }
  },
}

// ---------------------------------------------------------------------------
// party — swing assombrado (melodia original), em Sol menor
// ---------------------------------------------------------------------------

/** Colcheia "swingada": cai a 2/3 do tempo. */
const S = 2 / 3

const PARTY_TUNE: Row[] = [
  [1, 1, 'D5', 0.6], [1, 2, 'D5', 0.5], [1, 2 + S, 'C#5', 0.3], [1, 3, 'D5', 0.9], [1, 4, 'Bb4', 0.9],
  [2, 1, 'G4', 0.6], [2, 2, 'A4', 0.5], [2, 2 + S, 'Bb4', 0.3], [2, 3, 'A4', 0.9], [2, 4, 'G4', 0.9],
  [3, 1, 'F#4', 0.9], [3, 2, 'A4', 0.9], [3, 3, 'C5', 0.9], [3, 4, 'Eb5', 0.9],
  [4, 1, 'D5', 1.8], [4, 4, 'D4', 0.5], [4, 4 + S, 'G4', 0.3],
  [5, 1, 'Bb4', 0.6], [5, 2, 'Bb4', 0.5], [5, 2 + S, 'A4', 0.3], [5, 3, 'Bb4', 0.9], [5, 4, 'G4', 0.9],
  [6, 1, 'Eb5', 0.9], [6, 2, 'D5', 0.9], [6, 3, 'C5', 0.9], [6, 4, 'Bb4', 0.9],
  [7, 1, 'A4', 0.9], [7, 2, 'C5', 0.9], [7, 3, 'F#4', 0.9], [7, 4, 'A4', 0.9],
  [8, 1, 'G4', 2],
]

const PARTY_BASS: string[][] = [
  ['G2', 'Bb2', 'D3', 'Bb2'], ['G2', 'A2', 'Bb2', 'B2'], ['D3', 'F#2', 'A2', 'C3'], ['D3', 'C3', 'Bb2', 'A2'],
  ['G2', 'Bb2', 'D3', 'F3'], ['C3', 'Eb3', 'G2', 'C3'], ['D2', 'F#2', 'A2', 'C3'], ['G2', 'D3', 'G2', 'F#2'],
]

const GM = ['Bb3', 'D4', 'G4']
const CM = ['C4', 'Eb4', 'G4']
const D7 = ['A3', 'C4', 'F#4']
const PARTY_STABS: string[][] = [GM, GM, D7, D7, GM, CM, D7, GM]

const party: TrackDef = {
  bpm: 150,
  stepsPerBeat: 3,
  loopSteps: 16 * 4 * 3,
  level: 0.8,
  create(v) {
    const bassRows: Row[] = []
    const stabRows: Row[] = []
    for (const pass of [0, 8]) {
      PARTY_BASS.forEach((bar, index) => {
        bar.forEach((note, beat) => bassRows.push([pass + index + 1, beat + 1, note, 0.85]))
      })
      PARTY_STABS.forEach((chord, index) => {
        for (const note of chord) {
          stabRows.push([pass + index + 1, 2, note, 0.2], [pass + index + 1, 4, note, 0.2])
        }
      })
    }
    const map = compile(
      [
        // 1ª volta: clarinete assombrado; 2ª volta: os ossos (xilofone) puxam a melodia.
        { events: rows(4, PARTY_TUNE), play: (voice, t, ev, c) => lead(voice, t, ev.f, ev.len * c.beatDur, 0.85) },
        { events: rows(4, PARTY_TUNE, { barOffset: 8 }), play: (voice, t, ev) => xylo(voice, t, ev.f, 0.85) },
        { events: rows(4, bassRows), play: (voice, t, ev, c) => bass(voice, t, ev.f, ev.len * c.beatDur, 0.75) },
        { events: rows(4, stabRows), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur, 0.45, 0.3) },
      ],
      3,
    )
    return {
      step(e) {
        playCompiled(map, v, e)
        const pos = e.loopStep % 12
        const beat = Math.floor(pos / 3)
        const sub = pos % 3
        const backbeat = beat === 1 || beat === 3
        if (sub === 0) ride(v, e.time, 0.45)
        if (sub === 2 && backbeat) ride(v, e.time, 0.3)
        if (sub === 0 && backbeat) {
          hat(v, e.time, 0.45)
          brush(v, e.time, 0.5)
        }
        if (sub === 0 && !backbeat) kick(v, e.time, 0.28)
      },
    }
  },
}

// ---------------------------------------------------------------------------
// race — galope + "Na Gruta do Rei da Montanha" (Grieg, domínio público)
// ---------------------------------------------------------------------------

const MOUNTAIN_KING: Row[] = [
  [1, 1, 'A3', 0.5], [1, 1.5, 'B3', 0.5], [1, 2, 'C4', 0.5], [1, 2.5, 'D4', 0.5], [1, 3, 'E4', 0.5], [1, 3.5, 'C4', 0.5], [1, 4, 'E4', 1],
  [2, 1, 'D#4', 0.5], [2, 1.5, 'B3', 0.5], [2, 2, 'D#4', 1], [2, 3, 'D4', 0.5], [2, 3.5, 'Bb3', 0.5], [2, 4, 'D4', 1],
  [3, 1, 'A3', 0.5], [3, 1.5, 'B3', 0.5], [3, 2, 'C4', 0.5], [3, 2.5, 'D4', 0.5], [3, 3, 'E4', 0.5], [3, 3.5, 'C4', 0.5], [3, 4, 'E4', 0.5], [3, 4.5, 'A4', 0.5],
  [4, 1, 'G4', 0.5], [4, 1.5, 'E4', 0.5], [4, 2, 'C4', 0.5], [4, 2.5, 'E4', 0.5], [4, 3, 'G4', 2],
]

const race: TrackDef = {
  bpm: 138,
  stepsPerBeat: 4,
  loopSteps: 8 * 4 * 4,
  level: 1.25,
  create(v) {
    // Tema em Lá menor e depois na dominante (Mi menor), como no original.
    const theme = [...rows(4, MOUNTAIN_KING), ...rows(4, MOUNTAIN_KING, { barOffset: 4, semitones: 7 })]
    const bassRows: Row[] = []
    for (let bar = 1; bar <= 8; bar += 1) {
      const [root, fifth] = bar <= 4 ? ['A2', 'E2'] : ['E2', 'B2']
      bassRows.push([bar, 1, root, 0.5], [bar, 3, fifth, 0.5])
    }
    const map = compile(
      [
        { events: theme, play: (voice, t, ev) => pluck(voice, t, ev.f, 0.9, 0.24) },
        // Fagote uma oitava abaixo, curtinho.
        { events: theme, play: (voice, t, ev, c) => lead(voice, t, ev.f / 2, Math.min(ev.len, 0.45) * c.beatDur, 0.5, 0.15) },
        { events: rows(4, bassRows), play: (voice, t, ev) => pluck(voice, t, ev.f, 0.75, 0.3, 0.05) },
      ],
      4,
    )
    return {
      step(e) {
        playCompiled(map, v, e)
        // Galope "pa-ta-TUM" em cada tempo.
        const sub = e.loopStep % 4
        if (sub === 0) clop(v, e.time, 760, 0.4)
        else if (sub === 1) clop(v, e.time, 940, 0.3)
        else if (sub === 2) clop(v, e.time, 700, 0.62)
        if (e.loopStep % 8 === 0) kick(v, e.time, 0.32)
      },
    }
  },
}

// ---------------------------------------------------------------------------
// quiz — tique-taque saltitante (original), em Mi menor
// ---------------------------------------------------------------------------

const QUIZ_MELODY: Row[] = [
  [1, 1, 'E5', 0.5], [1, 2, 'G5', 0.5], [1, 2.5, 'F#5', 0.5], [1, 3, 'G5', 0.5], [1, 4, 'B5', 0.5],
  [2, 1, 'A5', 0.5], [2, 2, 'G5', 0.5], [2, 3, 'F#5', 0.5], [2, 3.5, 'G5', 0.5], [2, 4, 'E5', 0.5],
  [3, 1, 'E5', 0.5], [3, 2, 'G5', 0.5], [3, 2.5, 'A5', 0.5], [3, 3, 'C6', 0.5], [3, 4, 'B5', 0.5],
  [4, 1, 'A5', 0.5], [4, 2, 'F#5', 0.5], [4, 3, 'D#5', 0.5], [4, 3.5, 'E5', 0.5], [4, 4, 'F#5', 0.5],
  [5, 1, 'G5', 0.5], [5, 2, 'B5', 0.5], [5, 2.5, 'A5', 0.5], [5, 3, 'G5', 0.5], [5, 4, 'E5', 0.5],
  [6, 1, 'C6', 0.5], [6, 2, 'B5', 0.5], [6, 3, 'A5', 0.5], [6, 3.5, 'G5', 0.5], [6, 4, 'E5', 0.5],
  [7, 1, 'F#5', 0.5], [7, 2, 'A5', 0.5], [7, 3, 'D#5', 0.5], [7, 4, 'F#5', 0.5],
  [8, 1, 'E5', 0.5], [8, 2, 'B4', 0.5], [8, 3, 'E5', 0.5],
]

const QUIZ_BASS: [string, string][] = [
  ['E2', 'B2'], ['E2', 'B2'], ['C3', 'G2'], ['B2', 'F#2'],
  ['E2', 'B2'], ['A2', 'E2'], ['B2', 'F#2'], ['E2', 'B2'],
]

const quiz: TrackDef = {
  bpm: 112,
  stepsPerBeat: 2,
  loopSteps: 8 * 4 * 2,
  level: 1.6,
  create(v) {
    const bassRows: Row[] = QUIZ_BASS.flatMap(([root, fifth], index): Row[] => [
      [index + 1, 1, root, 0.4],
      [index + 1, 2, fifth, 0.4],
      [index + 1, 3, root, 0.4],
      ...(index === 7 ? [] : ([[index + 1, 4, fifth, 0.4]] as Row[])),
    ])
    const map = compile(
      [
        { events: rows(4, QUIZ_MELODY), play: (voice, t, ev) => xylo(voice, t, ev.f, 0.72) },
        { events: rows(4, bassRows), play: (voice, t, ev) => pluck(voice, t, ev.f, 0.7, 0.18, 0.05) },
      ],
      2,
    )
    return {
      step(e) {
        playCompiled(map, v, e)
        if (e.loopStep % 2 === 0) tickTock(v, e.time, 0.28, (e.loopStep / 2) % 2 === 0)
      },
    }
  },
}

// ---------------------------------------------------------------------------
// chase — ostinato tenso e rápido (original)
// ---------------------------------------------------------------------------

const CHASE_ROOTS = ['D3', 'D3', 'Eb3', 'D3', 'C3', 'D3', 'Bb2', 'A2'].map((note) => freq(note))
/** Semitons sobre a fundamental, uma semicolcheia por casa. */
const CHASE_PATTERN = [0, 0, 12, 0, 1, 0, 12, 0, 0, 0, 12, 0, 1, 0, 7, 0]

const chase: TrackDef = {
  bpm: 168,
  stepsPerBeat: 4,
  loopSteps: 8 * 4 * 4,
  level: 1.1,
  create(v) {
    // Um filtro só para todas as notas do ostinato (em vez de um por nota).
    const lp = v.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1700
    lp.Q.value = 0.9
    lp.connect(v.out.dry)
    const stringsVoice: Voice = { ...v, out: { dry: lp, wet: v.out.wet } }
    return {
      step(e) {
        const bar = Math.floor(e.loopStep / 16) % 8
        const pos = e.loopStep % 16
        const root = CHASE_ROOTS[bar]
        const accent = pos % 4 === 0
        strings(stringsVoice, e.time, transpose(root, CHASE_PATTERN[pos]), e.stepDur * 0.8, accent ? 1 : 0.62)
        if (accent) bass(v, e.time, root / 2, e.beatDur * 0.45, 0.6)
        if (pos === 0 || pos === 8) kick(v, e.time, 0.45)
        if (pos % 2 === 0) hat(v, e.time, 0.22)
        if (pos === 0 && bar % 2 === 0) {
          for (const semitones of [-12, -5, 0]) brass(v, e.time, transpose(root, semitones), e.beatDur * 0.5, 0.6)
        }
        // Virada de caixa no fim do laço.
        if (bar === 7 && pos >= 12) snare(v, e.time, 0.3 + (pos - 12) * 0.1)
      },
      dispose() {
        safeDisconnect(lp)
      },
    }
  },
}

// ---------------------------------------------------------------------------
// victory — abertura da Tocata em Ré menor (Bach) resolvendo em Ré MAIOR
// ---------------------------------------------------------------------------

const TOCCATA: Abs[] = [
  // O "mordente" famoso...
  [0, 'A5', 0.25], [0.25, 'G5', 0.25], [0.5, 'A5', 1.5],
  // ...e a descida.
  [2.5, 'G5', 0.25], [2.75, 'F5', 0.25], [3, 'E5', 0.25], [3.25, 'D5', 0.25], [3.5, 'C#5', 0.5], [4, 'D5', 2],
]

/** Arpejo de sétima diminuta subindo, cada nota segurando até o acorde final. */
const DIMINISHED: Abs[] = ['C#3', 'E3', 'G3', 'Bb3', 'C#4', 'E4', 'G4', 'Bb4'].map(
  (note, index): Abs => [6.5 + index * 0.25, note, 8.75 - (6.5 + index * 0.25), 0.6],
)

/** O final feliz: Ré maior (a "terça de Picardia" da vitória). */
const FINAL_CHORD: Abs[] = ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5'].map(
  (note): Abs => [9, note, 5, 0.62],
)

const VICTORY_LOOP_CHORDS: [number, string[], number][] = [
  // [compasso (dentro do laço), notas, compassos de duração]
  [1, ['D3', 'F#3', 'A3', 'D4'], 2],
  [3, ['D3', 'G3', 'B3', 'D4'], 1],
  [4, ['E3', 'A3', 'C#4', 'E4'], 1],
  [5, ['D3', 'F#3', 'A3', 'D4'], 2],
  [7, ['D3', 'G3', 'B3', 'D4'], 0.5],
  [7.5, ['E3', 'A3', 'C#4', 'E4'], 0.5],
  [8, ['D3', 'F#3', 'A3', 'D4'], 1],
]

const VICTORY_SPARKLE: string[][] = [
  ['D5', 'F#5', 'A5', 'F#5'], ['D5', 'F#5', 'A5', 'D6'], ['D5', 'G5', 'B5', 'G5'], ['C#5', 'E5', 'A5', 'E5'],
  ['D5', 'F#5', 'A5', 'F#5'], ['D5', 'F#5', 'A5', 'D6'], ['B4', 'D5', 'C#5', 'E5'], ['D5', 'A4', 'D5', 'D6'],
]

const VICTORY_BASS = ['D2', 'D2', 'G2', 'A2', 'D2', 'D2', 'G2', 'D2']

const INTRO_BEATS = 16

const victory: TrackDef = {
  bpm: 120,
  stepsPerBeat: 4,
  introSteps: INTRO_BEATS * 4,
  loopSteps: 8 * 4 * 4,
  level: 1,
  create(v) {
    const loopChords: Abs[] = VICTORY_LOOP_CHORDS.flatMap(([bar, notes, bars]) =>
      notes.map((note): Abs => [INTRO_BEATS + (bar - 1) * 4, note, bars * 4 - 0.15, 0.42]),
    )
    const sparkle: Abs[] = VICTORY_SPARKLE.flatMap((bar, barIndex) =>
      bar.map((note, beat): Abs => [INTRO_BEATS + barIndex * 4 + beat, note, 1, 0.45]),
    )
    const bassLine: Abs[] = VICTORY_BASS.map((note, barIndex): Abs => [INTRO_BEATS + barIndex * 4, note, 1, 0.7])
    const map = compile(
      [
        {
          // Órgão com oitavas dobradas, como no original.
          events: [...abs(TOCCATA), ...abs(TOCCATA).map((ev) => ({ ...ev, f: ev.f / 2 }))],
          play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur, 1, 0.5),
        },
        { events: abs([[4, 'D2', 2, 1]]), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur, 1, 0.5) },
        { events: abs([...DIMINISHED, ...FINAL_CHORD]), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur, ev.vel, 0.5) },
        { events: abs([[9, 'D6', 1, 0.5], [9.25, 'F#6', 1, 0.45], [9.5, 'A6', 1, 0.4]]), play: (voice, t, ev) => musicBox(voice, t, ev.f, ev.vel, 0.5) },
        { events: abs(loopChords), play: (voice, t, ev, c) => organ(voice, t, ev.f, ev.len * c.beatDur, ev.vel, 0.45) },
        { events: abs(sparkle), play: (voice, t, ev) => musicBox(voice, t, ev.f, ev.vel, 0.35) },
        { events: abs(bassLine), play: (voice, t, ev) => pluck(voice, t, ev.f, ev.vel, 0.5, 0.1) },
      ],
      4,
    )
    return { step: (e) => playCompiled(map, v, e) }
  },
}

export const TRACKS: Record<MusicTrack, TrackDef> = {
  lobby,
  tension,
  night,
  day,
  party,
  race,
  quiz,
  chase,
  victory,
}

// ---------------------------------------------------------------------------
// Tocador: uma instância de trilha com o próprio ganho (para o crossfade)
// ---------------------------------------------------------------------------

/** Cauda depois do fade: o tempo do sino mais longo terminar de soar. */
const TAIL = 6

export type TrackPlayer = {
  readonly name: MusicTrack
  tick(now: number): void
  /** Muda o volume da trilha (ex.: o lobby "baixinho" da TV sem pedido). */
  setLevel(level: number, at: number, ramp?: number): void
  fadeOut(at: number, dur: number): void
  /** A partir de quando pode ser descartada (Infinity enquanto toca). */
  readonly doneAt: number
  dispose(): void
}

export type StartTrackOptions = {
  ctx: BaseAudioContext
  dry: AudioNode
  wet: AudioNode
  noise: AudioBuffer
  brown: AudioBuffer
  at: number
  level: number
  fadeIn: number
}

export function startTrack(name: MusicTrack, options: StartTrackOptions): TrackPlayer {
  const { ctx, at } = options
  const def = TRACKS[name]
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  dry.connect(options.dry)
  wet.connect(options.wet)

  // Guarda a rampa atual para poder recomeçar dela sem pulo (Firefox não tem cancelAndHoldAtTime).
  let ramp = { v0: 0, t0: at, v1: def.level * options.level, t1: at + Math.max(0.01, options.fadeIn) }
  const valueAt = (time: number) => {
    if (time <= ramp.t0) return ramp.v0
    if (time >= ramp.t1) return ramp.v1
    return ramp.v0 + ((ramp.v1 - ramp.v0) * (time - ramp.t0)) / (ramp.t1 - ramp.t0)
  }
  const rampTo = (value: number, when: number, dur: number) => {
    const from = valueAt(when)
    ramp = { v0: from, t0: when, v1: value, t1: when + Math.max(0.01, dur) }
    for (const node of [dry, wet]) {
      node.gain.cancelScheduledValues(when)
      node.gain.setValueAtTime(from, when)
      node.gain.linearRampToValueAtTime(value, ramp.t1)
    }
  }
  for (const node of [dry, wet]) {
    node.gain.setValueAtTime(0, at)
    node.gain.linearRampToValueAtTime(ramp.v1, ramp.t1)
  }

  const voice: Voice = { ctx, out: { dry, wet }, noise: options.noise, brown: options.brown }
  const beatDur = 60 / def.bpm
  const stepDur = beatDur / def.stepsPerBeat
  const runtime = def.create(voice, at)
  const scheduler = new LoopScheduler({
    startTime: at + 0.05,
    stepDur,
    loopSteps: def.loopSteps,
    introSteps: def.introSteps,
    onStep: (e) => runtime.step({ ...e, stepDur, beatDur }),
  })

  let doneAt = Infinity
  let disposed = false

  return {
    name,
    tick(now) {
      if (!disposed) scheduler.tick(now)
    },
    setLevel(level, when, dur = 1) {
      if (disposed || doneAt !== Infinity) return
      rampTo(def.level * level, when, dur)
    },
    fadeOut(when, dur) {
      if (disposed || doneAt !== Infinity) return
      rampTo(0, when, dur)
      scheduler.stopFrom(when + dur)
      runtime.stop?.(when + dur + 0.05)
      doneAt = when + dur + TAIL
    },
    get doneAt() {
      return doneAt
    },
    dispose() {
      if (disposed) return
      disposed = true
      scheduler.stop()
      runtime.stop?.(ctx.currentTime)
      runtime.dispose?.()
      safeDisconnect(dry)
      safeDisconnect(wet)
    },
  }
}
