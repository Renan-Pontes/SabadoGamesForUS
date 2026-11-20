import { freq } from './notes'
import { bell as bellNote, clop, holdEnv, noiseHit, patch, pluckEnv, xylo } from './synth'
import type { Voice } from './synth'

/**
 * Efeitos do Natal: o guizo do trenó, o brilho mágico das revelações e o
 * "boing" de desenho animado para os momentos de 🤨. Mesmo contrato dos
 * outros (sfx.ts): agendam a partir de `t` e devolvem a duração.
 */

/** Guizos de trenó sacudidos: chiado agudo picotado + sininhos soltos. */
export function sleigh(v: Voice, t: number, vol: number): number {
  const shakes = 12
  for (let i = 0; i < shakes; i += 1) {
    // Pares rápidos ("chi-chi"), como quem sacode o guizo no ritmo.
    const at = t + Math.floor(i / 2) * 0.16 + (i % 2) * 0.055 + Math.random() * 0.012
    const accent = i % 4 === 0 ? 1 : 0.7
    noiseHit(v, at, { type: 'highpass', freq: 6500, q: 0.6, peak: 0.22 * vol * accent, decay: 0.09, wet: 0.2 })
    if (i % 2 === 0) bellNote(v, at, 2400 + Math.random() * 1600, 0.06 * vol, 0.35, 0.3)
  }
  return 1.1
}

/** Brilho mágico: arpejo de sininhos subindo (dó maior) com cauda. */
export function chime(v: Voice, t: number, vol: number): number {
  const notes = [1046.5, 1318.5, 1568, 2093, 2637, 3136]
  notes.forEach((f, index) => bellNote(v, t + index * 0.07, f, (0.28 - index * 0.02) * vol, 2.2, 0.55))
  return 2.6
}

/** "Boing" de mola de desenho animado: sobe e sacode, cada vez mais devagar. */
export function boing(v: Voice, t: number, vol: number): number {
  const dur = 0.75
  const p = patch(v)
  const osc = p.osc('triangle', 180)
  const gain = p.gain(0)
  osc.connect(gain)
  // Frequência: sobe rápido e oscila (a mola), perdendo força.
  const points = 64
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * dur
    const rise = 1 - Math.exp(-x * 30)
    const wobble = Math.sin(2 * Math.PI * 11 * x) * Math.exp(-x * 4.5)
    curve[i] = 170 + 260 * rise + 140 * wobble
  }
  osc.frequency.setValueCurveAtTime(curve, t, dur)
  pluckEnv(gain.gain, t, 0.32 * vol, 0.005, dur * 0.9)
  p.toOut(gain, 0.1)
  osc.start(t)
  osc.stop(t + dur + 0.05)
  p.finish()
  return dur
}

/**
 * Coral de duendes: o refrão de Jingle Bells (domínio público) num glockenspiel
 * agudinho, com sininho na oitava de cima e um guizo em cada tempo forte.
 * [nota, duração em tempos]; um tempo = 0,24 s.
 */
const ELF_SONG: [string, number][] = [
  ['E5', 1],
  ['E5', 1],
  ['E5', 2],
  ['E5', 1],
  ['E5', 1],
  ['E5', 2],
  ['E5', 1],
  ['G5', 1],
  ['C5', 1.5],
  ['D5', 0.5],
  ['E5', 3],
]
const ELF_BEAT = 0.24

export function elfsong(v: Voice, t: number, vol: number): number {
  let at = t
  ELF_SONG.forEach(([note, beats], index) => {
    const f = freq(note)
    xylo(v, at, f, 0.9 * vol, 0.3)
    bellNote(v, at, f * 2, 0.22 * vol, 0.9, 0.4)
    if (index % 2 === 0) {
      noiseHit(v, at, { type: 'highpass', freq: 7000, q: 0.6, peak: 0.12 * vol, decay: 0.07, wet: 0.2 })
    }
    at += beats * ELF_BEAT
  })
  return at - t + 0.6
}

/** Rena a galope: cascos em trios ("pa-ca-tum"), chegando e indo embora. */
export function gallop(v: Voice, t: number, vol: number): number {
  const strides = 6
  for (let i = 0; i < strides; i += 1) {
    const start = t + i * 0.27
    // Mais forte no meio (a rena passando na frente da TV).
    const near = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / strides)
    clop(v, start, 760, 0.8 * vol * near)
    clop(v, start + 0.07, 880, 0.7 * vol * near)
    clop(v, start + 0.14, 640, 1 * vol * near)
  }
  return strides * 0.27 + 0.1
}

/**
 * Uma sílaba cantada por síntese de formantes: serra na altura `f0`
 * passando por dois filtros de banda (as "vogais"), com um sopro de ruído
 * no começo (o "h"). Base do "Ho ho ho" e da risadinha de duende.
 */
function syllable(
  v: Voice,
  t: number,
  vol: number,
  shape: { f0: number; f0End: number; formants: [number, number]; dur: number; breath: number; vibrato?: number },
) {
  const p = patch(v)
  const source = p.osc('sawtooth', shape.f0)
  source.frequency.setValueAtTime(shape.f0, t)
  source.frequency.exponentialRampToValueAtTime(shape.f0End, t + shape.dur)
  if (shape.vibrato) {
    const lfo = p.osc('sine', 7)
    const depth = p.gain(shape.f0 * shape.vibrato)
    lfo.connect(depth).connect(source.frequency)
    lfo.start(t)
    lfo.stop(t + shape.dur + 0.15)
  }
  const out = p.gain(0)
  for (const [index, formant] of shape.formants.entries()) {
    const band = p.filter('bandpass', formant, index === 0 ? 5 : 7)
    const level = p.gain(index === 0 ? 1 : 0.55)
    source.connect(band).connect(level).connect(out)
  }
  holdEnv(out.gain, t, 0.9 * vol, 0.035, shape.dur * 0.75, shape.dur * 0.3)
  p.toOut(out, 0.25)
  source.start(t)
  source.stop(t + shape.dur + 0.15)
  p.finish()
  if (shape.breath > 0) {
    noiseHit(v, t - 0.02, { type: 'bandpass', freq: 1600, q: 0.8, peak: shape.breath * vol, decay: 0.07, wet: 0.1 })
  }
}

/** "Ho! Ho! Ho!" do Papai Noel: três "rô" graves, cada um um tiquinho mais baixo. */
export function hohoho(v: Voice, t: number, vol: number): number {
  const pitches = [128, 118, 104]
  pitches.forEach((f0, index) => {
    syllable(v, t + index * 0.36, vol * (index === 2 ? 1.1 : 1), {
      f0,
      f0End: f0 * 0.82,
      formants: [470, 820],
      dur: index === 2 ? 0.42 : 0.26,
      breath: 0.18,
    })
  })
  return 1.25
}

/** Risadinha de duende ("hi-hi-hi-hi!"): agudinha, rápida e marota. */
export function giggle(v: Voice, t: number, vol: number): number {
  const pitches = [620, 700, 660, 760, 820]
  pitches.forEach((f0, index) => {
    syllable(v, t + index * 0.115, vol * 0.75, {
      f0,
      f0End: f0 * (index === pitches.length - 1 ? 1.25 : 0.9),
      formants: [330, 2300],
      dur: index === pitches.length - 1 ? 0.2 : 0.085,
      breath: 0.12,
      vibrato: 0.03,
    })
  })
  return 0.8
}
