import { bell as bellNote, noiseHit, patch, pluckEnv } from './synth'
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
