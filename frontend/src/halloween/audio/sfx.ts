import { freq } from './notes'
import { flicker, screech, shriek } from './scarySfx'
import {
  SILENCE,
  bell as bellNote,
  brass,
  heart,
  holdEnv,
  kick,
  musicBox,
  noiseHit,
  organ as organNote,
  patch,
  pluckEnv,
  snare,
  startNoise,
  tickTock,
  xylo,
} from './synth'
import type { Voice } from './synth'
import type { SfxName } from './types'

/**
 * Os efeitos sonoros, todos sintetizados na hora (nada de arquivo de áudio).
 * Cada um agenda os próprios nós a partir de `t` e devolve a duração em
 * segundos — os sustos usam isso para casar imagem e som.
 */
export type SfxFn = (v: Voice, t: number, vol: number) => number

/** Curva com pontos sorteados (trovão, chiado, estática): cada execução soa um pouco diferente. */
function randomCurve(points: number, fn: (x: number, i: number) => number) {
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i += 1) curve[i] = Math.max(0, fn(i / (points - 1), i))
  return curve
}

// ---------------------------------------------------------------------------

/** Grito: serra com vibrato passando por formantes de voz, com glissando. */
function scream(v: Voice, t: number, vol: number) {
  const dur = 1.45
  const p = patch(v)
  const source = p.osc('sawtooth', 480)
  const pitch = source.frequency
  pitch.setValueAtTime(470, t)
  pitch.exponentialRampToValueAtTime(930, t + 0.16)
  pitch.linearRampToValueAtTime(860, t + 0.75)
  pitch.exponentialRampToValueAtTime(360, t + dur)
  const vibrato = p.osc('sine', 7.5)
  const vibratoDepth = p.gain(24)
  vibrato.connect(vibratoDepth).connect(pitch)

  const breath = p.noise('white')
  const breathGain = p.gain(0.28)
  const mix = p.gain(1)
  source.connect(mix)
  breath.connect(breathGain).connect(mix)
  const drive = p.shaper(3)
  mix.connect(drive)

  // "AAAH" que vira "ÉÉÉ": formantes em paralelo.
  const env = p.gain(0)
  const formants: [number, number, number, number][] = [
    [850, 5, 1, 650],
    [1250, 6, 0.75, 1950],
    [2700, 7, 0.45, 2950],
  ]
  for (const [from, q, level, to] of formants) {
    const band = p.filter('bandpass', from, q)
    const bandGain = p.gain(level)
    drive.connect(band).connect(bandGain).connect(env)
    band.frequency.setValueAtTime(from, t + 0.2)
    band.frequency.linearRampToValueAtTime(to, t + 0.95)
  }
  const peak = 1.6 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.05)
  env.gain.setValueAtTime(peak, t + 0.95)
  env.gain.exponentialRampToValueAtTime(SILENCE, t + dur)
  p.toOut(env, 0.35)

  const end = t + dur + 0.05
  source.start(t)
  source.stop(end)
  vibrato.start(t)
  vibrato.stop(end)
  startNoise(breath, t, end)
  p.finish()
  return dur
}

/** Trovão: estalo agudo e um ronco grave que rola e vai fechando. */
function thunder(v: Voice, t: number, vol: number) {
  const dur = 3.6
  const p = patch(v)
  const crack = p.noise('white')
  const crackFilter = p.filter('highpass', 1600)
  const crackGain = p.gain(0)
  crack.connect(crackFilter).connect(crackGain)
  pluckEnv(crackGain.gain, t, 0.45 * vol, 0.004, 0.35)
  p.toOut(crackGain, 0.4)
  startNoise(crack, t, t + 0.42)

  const rumble = p.noise('brown')
  const lowpass = p.filter('lowpass', 900, 0.6)
  const drive = p.shaper(1.6)
  const rumbleGain = p.gain(0)
  rumble.connect(lowpass).connect(drive).connect(rumbleGain)
  lowpass.frequency.setValueAtTime(900, t)
  lowpass.frequency.exponentialRampToValueAtTime(110, t + 2.6)
  let roll = 1
  const curve = randomCurve(48, (x) => {
    roll = 0.55 * roll + 0.45 * (0.4 + Math.random() * 0.9)
    return vol * 0.95 * Math.min(1, x * 12) * Math.pow(1 - x, 1.6) * roll
  })
  rumbleGain.gain.setValueCurveAtTime(curve, t + 0.03, dur - 0.05)
  p.toOut(rumbleGain, 0.35)
  startNoise(rumble, t, t + dur + 0.05)
  p.finish()
  return dur
}

/**
 * Rangido: atrito "gruda-solta" — uma serra bem grave com frequência
 * irregular, filtrada nas ressonâncias da madeira.
 */
function creakSound(v: Voice, t: number, vol: number, dur: number, from: number, to: number) {
  const p = patch(v)
  const source = p.osc('sawtooth', from)
  const curve = randomCurve(24, (x) => {
    const base = from + (to - from) * Math.sin(x * Math.PI * 0.9)
    return Math.max(8, base * (0.75 + Math.random() * 0.5))
  })
  source.frequency.setValueCurveAtTime(curve, t, dur)
  const env = p.gain(0)
  const resonances: [number, number, number][] = [
    [640, 12, 1],
    [1180, 10, 0.8],
    [2250, 9, 0.5],
    [3400, 8, 0.25],
  ]
  for (const [f, q, level] of resonances) {
    const band = p.filter('bandpass', f, q)
    const bandGain = p.gain(level)
    source.connect(band).connect(bandGain).connect(env)
  }
  const peak = 2.4 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.06)
  env.gain.setValueAtTime(peak, t + dur - 0.15)
  env.gain.linearRampToValueAtTime(0, t + dur)
  p.toOut(env, 0.25)
  source.start(t)
  source.stop(t + dur + 0.02)
  p.finish()
  return dur
}

function creak(v: Voice, t: number, vol: number) {
  return creakSound(v, t, vol, 1.1, 34, 72)
}

/** Porta: rangido longo e lento, e a batida no batente. */
function door(v: Voice, t: number, vol: number) {
  creakSound(v, t, vol * 0.9, 1.5, 22, 46)
  const hit = t + 1.45
  const p = patch(v)
  const osc = p.osc('sine', 120)
  const gain = p.gain(0)
  const drive = p.shaper(2)
  const post = p.gain(0.5)
  osc.connect(gain).connect(drive).connect(post)
  osc.frequency.setValueAtTime(120, hit)
  osc.frequency.exponentialRampToValueAtTime(55, hit + 0.15)
  pluckEnv(gain.gain, hit, 0.9 * vol, 0.004, 0.3)
  p.toOut(post, 0.3)
  osc.start(hit)
  osc.stop(hit + 0.4)
  p.finish()
  noiseHit(v, hit, { type: 'lowpass', freq: 500, q: 0.8, peak: 0.5 * vol, decay: 0.12, wet: 0.3 })
  return 1.9
}

function heartbeat(v: Voice, t: number, vol: number) {
  heart(v, t, vol)
  heart(v, t + 0.8, vol * 0.9)
  return 1.4
}

function bell(v: Voice, t: number, vol: number) {
  bellNote(v, t, freq('D3'), vol, 4.5, 0.5)
  return 4.5
}

/** Fantasma: teremim com portamento e vibrato — "uuUUuuu". */
function ghost(v: Voice, t: number, vol: number) {
  const dur = 2.3
  const p = patch(v)
  const osc = p.osc('sine', 392)
  const body = p.osc('triangle', 392)
  const bodyGain = p.gain(0.25)
  const vibrato = p.osc('sine', 5.8)
  const vibratoDepth = p.gain(9)
  vibrato.connect(vibratoDepth)
  vibratoDepth.connect(osc.frequency)
  vibratoDepth.connect(body.frequency)
  const path: [number, number][] = [
    [0.45, 659],
    [0.95, 523],
    [1.45, 784],
    [1.95, 587],
  ]
  for (const node of [osc, body]) {
    node.frequency.setValueAtTime(392, t)
    for (const [offset, hz] of path) node.frequency.setTargetAtTime(hz, t + offset, 0.12)
  }
  const env = p.gain(0)
  osc.connect(env)
  body.connect(bodyGain).connect(env)
  const peak = 0.3 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.3)
  env.gain.setValueAtTime(peak, t + dur - 0.5)
  env.gain.linearRampToValueAtTime(0, t + dur)
  p.toOut(env, 0.55)
  const end = t + dur + 0.05
  for (const source of [osc, body, vibrato]) {
    source.start(t)
    source.stop(end)
  }
  p.finish()
  return dur
}

/** "Doot doot": a trombeta do esqueleto (serra + quadrada, filtro abrindo com um "blat"). */
function doot(v: Voice, t: number, vol: number) {
  for (const offset of [0, 0.32]) {
    const start = t + offset
    const f = 466
    const p = patch(v)
    const saw = p.osc('sawtooth', f)
    const square = p.osc('square', f)
    const squareGain = p.gain(0.3)
    for (const node of [saw, square]) {
      node.frequency.setValueAtTime(f * 0.93, start)
      node.frequency.exponentialRampToValueAtTime(f, start + 0.04)
    }
    const lowpass = p.filter('lowpass', 700, 2)
    lowpass.frequency.setValueAtTime(700, start)
    lowpass.frequency.exponentialRampToValueAtTime(3200, start + 0.04)
    lowpass.frequency.exponentialRampToValueAtTime(1700, start + 0.2)
    const gain = p.gain(0)
    saw.connect(lowpass)
    square.connect(squareGain).connect(lowpass)
    lowpass.connect(gain)
    holdEnv(gain.gain, start, 0.38 * vol, 0.015, 0.17, 0.05)
    p.toOut(gain, 0.2)
    for (const node of [saw, square]) {
      node.start(start)
      node.stop(start + 0.26)
    }
    p.finish()
  }
  return 0.6
}

/** "Vine boom": grave que cai de afinação, saturado, com reverb. */
function boom(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const low = p.osc('sine', 115)
  const high = p.osc('sine', 230)
  const highGain = p.gain(0.35)
  low.frequency.setValueAtTime(115, t)
  low.frequency.exponentialRampToValueAtTime(48, t + 0.25)
  high.frequency.setValueAtTime(230, t)
  high.frequency.exponentialRampToValueAtTime(96, t + 0.25)
  const env = p.gain(0)
  const drive = p.shaper(3)
  const lowpass = p.filter('lowpass', 1600)
  const post = p.gain(0.55)
  low.connect(env)
  high.connect(highGain).connect(env)
  env.connect(drive).connect(lowpass).connect(post)
  pluckEnv(env.gain, t, vol, 0.006, 1.4)
  p.toOut(post, 0.3)
  for (const source of [low, high]) {
    source.start(t)
    source.stop(t + 1.5)
  }
  p.finish()
  noiseHit(v, t, { type: 'lowpass', freq: 1400, peak: 0.45 * vol, decay: 0.09 })
  return 1.5
}

/** Cano de metal caindo: FM inarmônico (som de metal) e dois quiques. */
function clang(v: Voice, t: number, vol: number) {
  const hits: [number, number, number][] = [
    [0, 1, 1.9],
    [0.28, 0.45, 0.9],
    [0.45, 0.25, 0.6],
  ]
  for (const [offset, level, ring] of hits) {
    const start = t + offset
    const p = patch(v)
    const env = p.gain(0)
    const pairs: [number, number, number, number][] = [
      [520, 1.41, 4.2, 1],
      [1190, 1.73, 2.6, 0.6],
      [2730, 1.12, 1.4, 0.3],
    ]
    for (const [carrierHz, ratio, index, amplitude] of pairs) {
      const carrier = p.osc('sine', carrierHz * (0.99 + Math.random() * 0.02))
      const modulator = p.osc('sine', carrierHz * ratio)
      const modGain = p.gain(0)
      modulator.connect(modGain).connect(carrier.frequency)
      modGain.gain.setValueAtTime(carrierHz * index, start)
      modGain.gain.exponentialRampToValueAtTime(carrierHz * index * 0.1, start + ring)
      const carrierGain = p.gain(amplitude)
      carrier.connect(carrierGain).connect(env)
      for (const source of [carrier, modulator]) {
        source.start(start)
        source.stop(start + ring + 0.05)
      }
    }
    pluckEnv(env.gain, start, 0.3 * level * vol, 0.002, ring)
    p.toOut(env, 0.3)
    p.finish()
    noiseHit(v, start, { type: 'highpass', freq: 2500, peak: 0.45 * level * vol, decay: 0.05 })
  }
  return 2
}

function tick(v: Voice, t: number, vol: number) {
  tickTock(v, t, vol, true)
  return 0.05
}

/** Explosão: ruído que fecha, um soco grave e um ronco que fica no ar. */
function explosion(v: Voice, t: number, vol: number) {
  const dur = 2.4
  const p = patch(v)
  const blast = p.noise('white')
  const lowpass = p.filter('lowpass', 4500, 0.5)
  const drive = p.shaper(2.5)
  const blastGain = p.gain(0)
  blast.connect(lowpass).connect(drive).connect(blastGain)
  lowpass.frequency.setValueAtTime(4500, t)
  lowpass.frequency.exponentialRampToValueAtTime(160, t + 1.6)
  pluckEnv(blastGain.gain, t, 0.5 * vol, 0.005, dur)
  p.toOut(blastGain, 0.3)
  startNoise(blast, t, t + dur + 0.05)

  const sub = p.osc('sine', 75)
  const subGain = p.gain(0)
  const subDrive = p.shaper(2)
  const subPost = p.gain(0.55)
  sub.frequency.setValueAtTime(75, t)
  sub.frequency.exponentialRampToValueAtTime(30, t + 0.6)
  sub.connect(subGain).connect(subDrive).connect(subPost)
  pluckEnv(subGain.gain, t, vol, 0.004, 0.9)
  p.toOut(subPost, 0.1)
  sub.start(t)
  sub.stop(t + 1)

  const rumble = p.noise('brown')
  const rumbleFilter = p.filter('lowpass', 300)
  const rumbleGain = p.gain(0)
  rumble.connect(rumbleFilter).connect(rumbleGain)
  rumbleGain.gain.setValueAtTime(0, t)
  rumbleGain.gain.linearRampToValueAtTime(0.55 * vol, t + 0.15)
  rumbleGain.gain.exponentialRampToValueAtTime(SILENCE, t + dur)
  p.toOut(rumbleGain, 0.4)
  startNoise(rumble, t, t + dur + 0.05)
  p.finish()
  return dur
}

/** Vitória: arpejo de xilofone subindo, acorde de caixinha e brilhinhos. */
function win(v: Voice, t: number, vol: number) {
  const chord = ['D5', 'F#5', 'A5', 'D6'].map((note) => freq(note))
  chord.forEach((f, index) => xylo(v, t + index * 0.085, f, 0.9 * vol))
  const chordAt = t + 0.36
  for (const f of chord) musicBox(v, chordAt, f, 0.85 * vol, 0.4)
  const sparkle = ['A6', 'F#6', 'D7', 'A6'].map((note) => freq(note))
  sparkle.forEach((f, index) => musicBox(v, chordAt + 0.12 + index * 0.07, f, 0.32 * vol, 0.5))
  return 2
}

/** Trombone triste: "uá uá uá uááá". */
function fail(v: Voice, t: number, vol: number) {
  const notes: [string, number, number][] = [
    ['D4', 0, 0.36],
    ['C#4', 0.42, 0.36],
    ['C4', 0.84, 0.36],
    ['B3', 1.26, 1.15],
  ]
  for (const [name, offset, dur] of notes) {
    const start = t + offset
    const f = freq(name)
    const p = patch(v)
    const osc = p.osc('sawtooth', f)
    const lowpass = p.filter('lowpass', 400, 3)
    const gain = p.gain(0)
    osc.connect(lowpass).connect(gain)
    lowpass.frequency.setValueAtTime(350, start)
    lowpass.frequency.exponentialRampToValueAtTime(1500, start + 0.12)
    lowpass.frequency.exponentialRampToValueAtTime(600, start + dur)
    holdEnv(gain.gain, start, 0.24 * vol, 0.04, dur, 0.12)
    if (dur > 1) {
      // A última nota chora com vibrato.
      const lfo = p.osc('sine', 5.5)
      const depth = p.gain(0)
      lfo.connect(depth).connect(osc.frequency)
      depth.gain.setValueAtTime(0, start)
      depth.gain.linearRampToValueAtTime(f * 0.03, start + 0.4)
      lfo.start(start)
      lfo.stop(start + dur + 0.15)
    }
    p.toOut(gain, 0.2)
    osc.start(start)
    osc.stop(start + dur + 0.15)
    p.finish()
  }
  return 2.6
}

/** Tímpano: seno grave com leve queda e o "tum" do couro. */
function timpani(v: Voice, t: number, f: number, vol: number) {
  const p = patch(v)
  const osc = p.osc('sine', f)
  const gain = p.gain(0)
  const drive = p.shaper(1.8)
  const post = p.gain(0.6)
  osc.connect(gain).connect(drive).connect(post)
  osc.frequency.setValueAtTime(f * 1.05, t)
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.08)
  pluckEnv(gain.gain, t, vol, 0.004, 1.1)
  p.toOut(post, 0.3)
  osc.start(t)
  osc.stop(t + 1.2)
  p.finish()
  noiseHit(v, t, { type: 'lowpass', freq: 700, peak: 0.35 * vol, decay: 0.08 })
}

/** Revelação dramática: "tam, tam, TAAAM". */
function reveal(v: Voice, t: number, vol: number) {
  const hits: [number, string[], number, string][] = [
    [0, ['D3', 'A3', 'D4'], 0.22, 'D2'],
    [0.3, ['D3', 'A3', 'D4'], 0.22, 'D2'],
    [0.68, ['Bb2', 'F3', 'Bb3'], 1.5, 'Bb1'],
  ]
  for (const [offset, chord, dur, low] of hits) {
    const start = t + offset
    for (const note of chord) brass(v, start, freq(note), dur, 1.1 * vol, 0.35)
    timpani(v, start, freq(low) * 2, 0.8 * vol)
  }
  return 2.4
}

/** Vulto passando: ruído num passa-faixa que sobe e desce, da esquerda para a direita. */
function whoosh(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const noise = p.noise('white')
  const band = p.filter('bandpass', 300, 1.4)
  const gain = p.gain(0)
  const pan = p.pan(-0.8)
  noise.connect(band).connect(gain).connect(pan)
  band.frequency.setValueAtTime(300, t)
  band.frequency.exponentialRampToValueAtTime(2800, t + 0.35)
  band.frequency.exponentialRampToValueAtTime(450, t + 0.7)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.75 * vol, t + 0.3)
  gain.gain.linearRampToValueAtTime(0, t + 0.72)
  if (pan.pan) {
    pan.pan.setValueAtTime(-0.8, t)
    pan.pan.linearRampToValueAtTime(0.8, t + 0.7)
  }
  p.toOut(pan, 0.2)
  startNoise(noise, t, t + 0.75)
  p.finish()
  return 0.75
}

function pop(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const osc = p.osc('sine', 380)
  const gain = p.gain(0)
  osc.connect(gain)
  osc.frequency.setValueAtTime(380, t)
  osc.frequency.exponentialRampToValueAtTime(1250, t + 0.06)
  pluckEnv(gain.gain, t, 0.5 * vol, 0.004, 0.09)
  p.toOut(gain, 0.1)
  osc.start(t)
  osc.stop(t + 0.12)
  p.finish()
  return 0.12
}

/**
 * Risada maligna "MUÁ-RÁ-RÁ-RÁ": síntese de formantes. Cada sílaba é uma
 * serra (as cordas vocais) com sub-oitava (voz de vilão), um sopro de ar no
 * começo, tudo passando pelos formantes do "a".
 */
function laugh(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const throat = p.gain(1)
  const drive = p.shaper(1.8)
  const out = p.gain(1.5 * vol)
  throat.connect(drive)
  const formants: [number, number, number][] = [
    [650, 5, 1],
    [1080, 6, 0.6],
    [2450, 8, 0.25],
  ]
  for (const [f, q, level] of formants) {
    const band = p.filter('bandpass', f, q)
    const bandGain = p.gain(level)
    drive.connect(band).connect(bandGain).connect(out)
  }
  const vibrato = p.osc('sine', 6)
  const vibratoDepth = p.gain(4)
  vibrato.connect(vibratoDepth)

  // [início, duração, tom inicial, tom final, força]
  const syllables: [number, number, number, number, number][] = [
    [0, 0.42, 160, 125, 1],
    [0.52, 0.14, 150, 138, 0.9],
    [0.7, 0.14, 140, 128, 0.85],
    [0.88, 0.14, 132, 120, 0.8],
    [1.06, 0.14, 124, 112, 0.75],
    [1.24, 0.14, 116, 104, 0.7],
    [1.44, 0.55, 112, 80, 0.85],
  ]
  syllables.forEach(([offset, dur, from, to, strength], index) => {
    const start = t + offset
    const vowel = start + (index === 0 ? 0 : 0.03)
    const glottis = p.osc('sawtooth', from)
    const sub = p.osc('sawtooth', from / 2)
    const subGain = p.gain(0.4)
    vibratoDepth.connect(glottis.frequency)
    glottis.frequency.setValueAtTime(from, vowel)
    glottis.frequency.exponentialRampToValueAtTime(to, vowel + dur)
    sub.frequency.setValueAtTime(from / 2, vowel)
    sub.frequency.exponentialRampToValueAtTime(to / 2, vowel + dur)
    const gain = p.gain(0)
    glottis.connect(gain)
    sub.connect(subGain).connect(gain)
    gain.connect(throat)
    const level = 0.5 * strength
    gain.gain.setValueAtTime(0, vowel)
    gain.gain.linearRampToValueAtTime(level, vowel + 0.03)
    gain.gain.setValueAtTime(level, vowel + dur * 0.6)
    gain.gain.linearRampToValueAtTime(0, vowel + dur)
    for (const source of [glottis, sub]) {
      source.start(vowel)
      source.stop(vowel + dur + 0.02)
    }
    if (index > 0) {
      // O "h" aspirado do "rá".
      const air = p.noise('white')
      const airGain = p.gain(0)
      air.connect(airGain).connect(throat)
      pluckEnv(airGain.gain, start, 0.35 * strength, 0.008, 0.06)
      startNoise(air, start, start + 0.09)
    }
  })
  vibrato.start(t)
  vibrato.stop(t + 2.1)
  p.toOut(out, 0.35)
  p.finish()
  return 2.1
}

/** Acordão de órgão de filme de terror (Ré menor, do pedal ao agudo). */
function organSfx(v: Voice, t: number, vol: number) {
  for (const note of ['D2', 'A2', 'D3', 'F3', 'A3', 'D4', 'F4', 'A4']) {
    organNote(v, t, freq(note), 1.6, 1.1 * vol, 0.5)
  }
  return 2
}

/** Rufar de tambor em crescendo, com pancada e prato no fim. */
function drumroll(v: Voice, t: number, vol: number) {
  const roll = 1.7
  const p = patch(v)
  const noise = p.noise('white')
  const highpass = p.filter('highpass', 600)
  const band = p.filter('bandpass', 2100, 0.7)
  const gain = p.gain(0)
  noise.connect(highpass).connect(band).connect(gain)
  // ~24 toques por segundo: cada toque é um pico que decai.
  const perStroke = 6
  const points = Math.ceil(roll * 24 * perStroke)
  const curve = randomCurve(points, (x, i) => {
    const phase = (i % perStroke) / perStroke
    return vol * (0.12 + 0.5 * x * x) * (0.35 + 0.65 * Math.exp(-phase * 4))
  })
  gain.gain.setValueCurveAtTime(curve, t, roll)
  p.toOut(gain, 0.15)
  startNoise(noise, t, t + roll + 0.02)
  p.finish()
  const hit = t + roll
  snare(v, hit, 1.2 * vol)
  kick(v, hit, vol)
  noiseHit(v, hit, { type: 'highpass', freq: 4500, q: 0.5, peak: 0.4 * vol, decay: 1.1, wet: 0.3 })
  return roll + 1.1
}

/** Campainha de "errou!" de programa de auditório. */
function buzzer(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const a = p.osc('square', 140)
  const b = p.osc('sawtooth', 147)
  const lowpass = p.filter('lowpass', 1600, 0.8)
  const gain = p.gain(0)
  a.connect(lowpass)
  b.connect(lowpass)
  lowpass.connect(gain)
  holdEnv(gain.gain, t, 0.16 * vol, 0.01, 0.6, 0.05)
  p.toOut(gain, 0.05)
  for (const source of [a, b]) {
    source.start(t)
    source.stop(t + 0.7)
  }
  p.finish()
  return 0.7
}

/** "Ding" de resposta certa. */
function ding(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const sum = p.gain(0.3 * vol)
  const partials: [number, number, number][] = [
    [1318.5, 1, 1.1],
    [2637, 0.3, 0.6],
    [3955, 0.12, 0.35],
  ]
  for (const [f, amplitude, decay] of partials) {
    const osc = p.osc('sine', f)
    const gain = p.gain(0)
    osc.connect(gain).connect(sum)
    pluckEnv(gain.gain, t, amplitude, 0.003, decay)
    osc.start(t)
    osc.stop(t + decay + 0.05)
  }
  p.toOut(sum, 0.25)
  p.finish()
  return 1.2
}

/** Pavio aceso: chiado agudo com estalinhos. */
function fuse(v: Voice, t: number, vol: number) {
  const dur = 1.6
  const p = patch(v)
  const noise = p.noise('white')
  const highpass = p.filter('highpass', 2800)
  const gain = p.gain(0)
  noise.connect(highpass).connect(gain)
  const curve = randomCurve(160, (x) => {
    const crackle = Math.random() < 0.07 ? 1 : 0.25 + Math.random() * 0.2
    return vol * 0.4 * crackle * Math.min(1, x * 10) * Math.min(1, (1 - x) * 6)
  })
  gain.gain.setValueCurveAtTime(curve, t, dur)
  p.toOut(gain, 0.1)
  startNoise(noise, t, t + dur + 0.02)
  p.finish()
  return dur
}

/** Rugido de monstro: serras graves, rosnado a ~27 Hz, distorção e um filtro que abre. */
function monster(v: Voice, t: number, vol: number) {
  const dur = 1.9
  const p = patch(v)
  const amp = p.gain(0.55)
  const voices = [p.osc('sawtooth', 62), p.osc('sawtooth', 93)]
  for (const osc of voices) {
    const f = osc.frequency.value
    osc.frequency.setValueAtTime(f * 0.9, t)
    osc.frequency.linearRampToValueAtTime(f * 1.35, t + 0.5)
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, t + dur)
    osc.connect(amp)
  }
  const growl = p.osc('square', 27)
  const growlDepth = p.gain(0.45)
  growl.connect(growlDepth).connect(amp.gain)
  const breath = p.noise('brown')
  const breathGain = p.gain(0.5)
  breath.connect(breathGain).connect(amp)
  const drive = p.shaper(4)
  const lowpass = p.filter('lowpass', 400, 1.5)
  const env = p.gain(0)
  amp.connect(drive).connect(lowpass).connect(env)
  lowpass.frequency.setValueAtTime(400, t)
  lowpass.frequency.linearRampToValueAtTime(1300, t + 0.45)
  lowpass.frequency.exponentialRampToValueAtTime(350, t + dur)
  const peak = 0.5 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.18)
  env.gain.setValueAtTime(peak, t + dur - 0.6)
  env.gain.linearRampToValueAtTime(0, t + dur)
  p.toOut(env, 0.3)
  const end = t + dur + 0.05
  for (const source of [...voices, growl]) {
    source.start(t)
    source.stop(end)
  }
  startNoise(breath, t, end)
  p.finish()
  return dur
}

/** Gongo: parciais inarmônicos que "florescem" depois da pancada. */
function gong(v: Voice, t: number, vol: number) {
  const dur = 4.5
  const f0 = 88
  const p = patch(v)
  const sum = p.gain(0.16 * vol)
  const partials: [number, number, number, number][] = [
    [1, 1, 0.02, 1],
    [1.52, 0.7, 0.15, 0.9],
    [2.17, 0.55, 0.3, 0.8],
    [2.79, 0.45, 0.4, 0.7],
    [3.43, 0.35, 0.5, 0.6],
    [4.21, 0.25, 0.6, 0.5],
    [5.11, 0.2, 0.7, 0.4],
  ]
  for (const [ratio, amplitude, bloom, life] of partials) {
    const osc = p.osc('sine', f0 * ratio * (0.995 + Math.random() * 0.01))
    const gain = p.gain(0)
    osc.connect(gain).connect(sum)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(amplitude * 0.6, t + 0.01)
    gain.gain.linearRampToValueAtTime(amplitude, t + 0.01 + bloom)
    gain.gain.exponentialRampToValueAtTime(SILENCE, t + dur * life)
    osc.start(t)
    osc.stop(t + dur * life + 0.05)
  }
  const drive = p.shaper(1.5)
  sum.connect(drive)
  p.toOut(drive, 0.45)
  p.finish()
  noiseHit(v, t, { type: 'lowpass', freq: 1200, peak: 0.4 * vol, decay: 0.25, wet: 0.3 })
  return dur
}

/** Ossos chacoalhando: xilofone em notas soltas, rapidinho. */
function bones(v: Voice, t: number, vol: number) {
  const scale = ['E5', 'G5', 'A5', 'B5', 'D6', 'E6'].map((note) => freq(note))
  for (let i = 0; i < 14; i += 1) {
    const f = scale[Math.floor(Math.random() * scale.length)] * (0.98 + Math.random() * 0.04)
    xylo(v, t + i * 0.065, f, (0.55 + 0.45 * Math.random()) * vol, 0.2)
  }
  return 1.4
}

/** Chiado de aranha. */
function hiss(v: Voice, t: number, vol: number) {
  const p = patch(v)
  const noise = p.noise('white')
  const highpass = p.filter('highpass', 3800)
  const band = p.filter('bandpass', 6200, 1.2)
  const gain = p.gain(0)
  noise.connect(highpass).connect(band).connect(gain)
  const peak = 0.75 * vol
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.06)
  gain.gain.setValueAtTime(peak, t + 0.55)
  gain.gain.linearRampToValueAtTime(0, t + 0.9)
  p.toOut(gain, 0.15)
  startNoise(noise, t, t + 0.92)
  p.finish()
  return 0.9
}

/** Estática de TV velha, com o zumbido da rede elétrica. */
function staticNoise(v: Voice, t: number, vol: number) {
  const dur = 1.6
  const p = patch(v)
  const noise = p.noise('white')
  const band = p.filter('bandpass', 3200, 0.35)
  const gain = p.gain(0)
  noise.connect(band).connect(gain)
  const curve = randomCurve(64, (x) => {
    const flutter = 0.6 + Math.random() * 0.4
    return vol * 0.32 * flutter * Math.min(1, x * 15) * Math.min(1, (1 - x) * 8)
  })
  gain.gain.setValueCurveAtTime(curve, t, dur)
  const hum = p.osc('sawtooth', 60)
  const humFilter = p.filter('lowpass', 400)
  const humGain = p.gain(0)
  hum.connect(humFilter).connect(humGain)
  holdEnv(humGain.gain, t, 0.05 * vol, 0.05, dur - 0.1, 0.1)
  p.toOut(gain, 0.05)
  p.toOut(humGain, 0)
  startNoise(noise, t, t + dur + 0.02)
  hum.start(t)
  hum.stop(t + dur + 0.05)
  p.finish()
  return dur
}

/** Sussurro: ar soprado nos formantes, passeando de um ouvido ao outro. */
function whisper(v: Voice, t: number, vol: number) {
  const dur = 1.6
  const p = patch(v)
  const noise = p.noise('white')
  const low = p.filter('bandpass', 1300, 4)
  const high = p.filter('bandpass', 2400, 5)
  const gain = p.gain(0)
  const pan = p.pan(-0.6)
  noise.connect(low).connect(gain)
  noise.connect(high).connect(gain)
  gain.connect(pan)
  low.frequency.setValueAtTime(1300, t)
  low.frequency.linearRampToValueAtTime(900, t + dur)
  high.frequency.setValueAtTime(2400, t)
  high.frequency.linearRampToValueAtTime(3100, t + dur * 0.6)
  const curve = randomCurve(48, (x) => {
    const syllable = Math.pow(Math.sin(x * Math.PI * 3), 2)
    return vol * 1.1 * (0.2 + 0.8 * syllable) * Math.min(1, x * 6) * Math.min(1, (1 - x) * 4)
  })
  gain.gain.setValueCurveAtTime(curve, t, dur)
  if (pan.pan) {
    pan.pan.setValueAtTime(-0.6, t)
    pan.pan.linearRampToValueAtTime(0.6, t + dur)
  }
  p.toOut(pan, 0.5)
  startNoise(noise, t, t + dur + 0.02)
  p.finish()
  return dur
}

/**
 * Guincho de jumpscare: serras desafinadas com o tom tremendo (sorteado a
 * cada execução), rasgado por um zumbido de 31 Hz e muita distorção. Entra
 * de uma vez e para seco — o silêncio logo depois assusta junto.
 */
function jumpscare(v: Voice, t: number, vol: number) {
  const dur = 1.15
  const p = patch(v)
  const mix = p.gain(1)
  const voices = [p.osc('sawtooth', 610), p.osc('sawtooth', 647), p.osc('square', 1230)]
  for (const osc of voices) {
    const f = osc.frequency.value
    const shape = (x: number) => (x < 0.08 ? 0.55 + 0.65 * (x / 0.08) : 1.2 - 0.3 * x)
    osc.frequency.setValueCurveAtTime(
      randomCurve(48, (x) => f * shape(x) * (0.86 + Math.random() * 0.28)),
      t,
      dur,
    )
    osc.connect(mix)
  }
  const rasp = p.noise('white')
  const raspFilter = p.filter('highpass', 2200)
  const raspGain = p.gain(0.6)
  rasp.connect(raspFilter).connect(raspGain).connect(mix)

  const buzz = p.osc('square', 31)
  const buzzDepth = p.gain(0.5)
  const amp = p.gain(0.55)
  buzz.connect(buzzDepth).connect(amp.gain)
  mix.connect(amp)

  const drive = p.shaper(6)
  const highpass = p.filter('highpass', 350)
  const env = p.gain(0)
  amp.connect(drive).connect(highpass).connect(env)
  holdEnv(env.gain, t, 0.6 * vol, 0.012, dur - 0.04, 0.028)
  p.toOut(env, 0.2)

  const end = t + dur + 0.05
  for (const source of [...voices, buzz]) {
    source.start(t)
    source.stop(end)
  }
  startNoise(rasp, t, end)
  p.finish()
  return dur
}

/**
 * Ajuste fino de volume por efeito, medido no Chrome (OfflineAudioContext,
 * pico de RMS em janelas de 50 ms): os sustos ficam perto de −12 dBFS na
 * saída da TV, os de interface (tique, pop, ding) um pouco abaixo. O ganho
 * entra depois de qualquer saturação, então não muda o timbre.
 */
const TRIM: Partial<Record<SfxName, number>> = {
  scream: 0.85,
  creak: 1.6,
  bell: 1.8,
  clang: 1.6,
  tick: 5,
  fail: 1.25,
  whoosh: 1.5,
  pop: 1.4,
  laugh: 1.4,
  ding: 1.25,
  bones: 1.25,
  static: 1.25,
}

const RAW: Record<SfxName, SfxFn> = {
  scream,
  thunder,
  creak,
  door,
  heartbeat,
  bell,
  ghost,
  doot,
  boom,
  clang,
  tick,
  explosion,
  win,
  fail,
  reveal,
  whoosh,
  pop,
  laugh,
  organ: organSfx,
  drumroll,
  buzzer,
  ding,
  fuse,
  monster,
  gong,
  bones,
  hiss,
  static: staticNoise,
  whisper,
  jumpscare,
  screech,
  shriek,
  flicker,
}

export const SFX = Object.fromEntries(
  Object.entries(RAW).map(([name, fn]) => {
    const trim = TRIM[name as SfxName] ?? 1
    const play: SfxFn = (v, t, vol) => fn(v, t, vol * trim)
    return [name, play]
  }),
) as Record<SfxName, SfxFn>
