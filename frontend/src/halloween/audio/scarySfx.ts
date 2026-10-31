import { SILENCE, noiseHit, patch, pluckEnv, startNoise } from './synth'
import type { Voice } from './synth'

/**
 * Os sons dos sustos de verdade (animatrônico e rosto). Sintetizados na hora,
 * como o resto; o volume alto vem do caminho de susto do motor (loud.ts),
 * então aqui o que importa é o timbre: áspero, agudo onde o ouvido é mais
 * sensível (2–4 kHz) e sem aviso.
 */

/** Curva com pontos sorteados: cada execução soa um pouco diferente. */
function randomCurve(points: number, fn: (x: number) => number) {
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i += 1) curve[i] = Math.max(1, fn(i / (points - 1)))
  return curve
}

/**
 * Guincho eletrônico de animatrônico: quatro serras desafinadas (um cacho
 * dissonante) com vibrato rápido e o tom despencando no fim, um zumbido
 * elétrico picotando o volume, rajada de ruído, um baque grave e a
 * mandíbula de metal chacoalhando.
 */
export function screech(v: Voice, t: number, vol: number) {
  const dur = 1.4
  const end = t + dur + 0.05
  const p = patch(v)

  // 1) O guincho.
  const base = 1120 + Math.random() * 140
  const mix = p.gain(0.5)
  const vibrato = p.osc('sine', 17 + Math.random() * 4)
  const vibratoDepth = p.gain(120)
  vibrato.connect(vibratoDepth)
  const saws = [1, 1.061, 1.118, 1.502].map((ratio) => p.osc('sawtooth', base * ratio))
  for (const osc of saws) {
    const f = osc.frequency.value
    osc.frequency.setValueAtTime(f * 0.6, t)
    osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.06)
    osc.frequency.setValueAtTime(f * 1.15, t + 0.55)
    osc.frequency.exponentialRampToValueAtTime(f * 0.3, t + dur)
    vibratoDepth.connect(osc.detune)
    osc.connect(mix)
  }
  // Zumbido elétrico: o volume picota a 55 Hz.
  const amp = p.gain(0.6)
  const buzz = p.osc('square', 55)
  const buzzDepth = p.gain(0.4)
  buzz.connect(buzzDepth).connect(amp.gain)
  mix.connect(amp)
  const drive = p.shaper(5)
  const highpass = p.filter('highpass', 380)
  const presence = p.filter('peaking', 2900, 1.1)
  presence.gain.value = 6
  const env = p.gain(0)
  amp.connect(drive).connect(highpass).connect(presence).connect(env)
  const peak = 0.85 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.004)
  env.gain.setValueAtTime(peak, t + 0.8)
  env.gain.exponentialRampToValueAtTime(SILENCE, t + dur)
  p.toOut(env, 0.15)
  for (const source of [...saws, vibrato, buzz]) {
    source.start(t)
    source.stop(end)
  }

  // 2) Rajada de ruído.
  const burst = p.noise('white')
  const burstBand = p.filter('bandpass', 3200, 0.6)
  const burstGain = p.gain(0)
  burst.connect(burstBand).connect(burstGain)
  pluckEnv(burstGain.gain, t, 0.9 * vol, 0.002, 0.45)
  p.toOut(burstGain, 0.1)
  startNoise(burst, t, t + 0.5)

  // 3) Baque grave (saturado para aparecer até em caixinha de TV).
  const thud = p.osc('sine', 110)
  thud.frequency.setValueAtTime(110, t)
  thud.frequency.exponentialRampToValueAtTime(36, t + 0.3)
  const thudGain = p.gain(0)
  const thudDrive = p.shaper(2.5)
  const thudPost = p.gain(0.7)
  thud.connect(thudGain).connect(thudDrive).connect(thudPost)
  pluckEnv(thudGain.gain, t, vol, 0.003, 0.5)
  p.toOut(thudPost, 0.05)
  thud.start(t)
  thud.stop(t + 0.6)
  p.finish()

  // 4) Mandíbula de metal chacoalhando: estalos FM inarmônicos em rajada.
  const rattle = patch(v)
  const rattleOut = rattle.gain(1)
  let at = t + 0.05
  while (at < t + 0.95) {
    const carrierHz = 700 + Math.random() * 1000
    const carrier = rattle.osc('sine', carrierHz)
    const modulator = rattle.osc('sine', carrierHz * (Math.random() < 0.5 ? 1.41 : 2.76))
    const modGain = rattle.gain(carrierHz * 3)
    modulator.connect(modGain).connect(carrier.frequency)
    const hit = rattle.gain(0)
    carrier.connect(hit).connect(rattleOut)
    const ring = 0.04 + Math.random() * 0.04
    pluckEnv(hit.gain, at, (0.25 + Math.random() * 0.2) * vol, 0.001, ring)
    for (const source of [carrier, modulator]) {
      source.start(at)
      source.stop(at + ring + 0.03)
    }
    at += 0.055 + Math.random() * 0.03
  }
  rattle.toOut(rattleOut, 0.2)
  rattle.finish()
  return dur
}

/**
 * Grito humano-monstro rasgado: duas serras quase iguais (aspereza) e uma
 * sub-oitava quadrada (o monstro), o tom tremendo sem controle, o volume
 * "rasgando" a 38 Hz, muito ar, tudo nos formantes de um "AAAH" que vira
 * "ÉÉÉ". Começa com um soco grave — o rosto explodindo na tela.
 */
export function shriek(v: Voice, t: number, vol: number) {
  const dur = 1.6
  const end = t + dur + 0.05
  const p = patch(v)
  const f0 = 520 + Math.random() * 60
  const contour = (x: number) => (x < 0.06 ? 0.8 + 0.8 * (x / 0.06) : x < 0.65 ? 1.6 - 0.15 * x : 1.5 - 0.9 * (x - 0.65))
  const folds = [p.osc('sawtooth', f0), p.osc('sawtooth', f0 * 1.013), p.osc('square', f0 / 2)]
  const foldMix = p.gain(1)
  folds.forEach((osc, index) => {
    const f = osc.frequency.value
    osc.frequency.setValueCurveAtTime(
      randomCurve(64, (x) => f * contour(x) * (0.95 + Math.random() * 0.1)),
      t,
      dur,
    )
    if (index === 2) {
      const subGain = p.gain(0.45)
      osc.connect(subGain).connect(foldMix)
    } else {
      osc.connect(foldMix)
    }
  })
  const vibrato = p.osc('sine', 9)
  const vibratoDepth = p.gain(60)
  vibrato.connect(vibratoDepth)
  for (const osc of folds) vibratoDepth.connect(osc.detune)

  // O "rasgado": o volume treme a 38 Hz.
  const rough = p.gain(0.6)
  const tremor = p.osc('sine', 38)
  const tremorDepth = p.gain(0.4)
  tremor.connect(tremorDepth).connect(rough.gain)
  foldMix.connect(rough)
  const breath = p.noise('white')
  const breathBand = p.filter('bandpass', 1800, 0.8)
  const breathGain = p.gain(0.55)
  breath.connect(breathBand).connect(breathGain).connect(rough)

  const drive = p.shaper(4)
  rough.connect(drive)
  const env = p.gain(0)
  const formants: [number, number, number, number][] = [
    [820, 5, 1, 680],
    [1250, 6, 0.8, 1950],
    [2750, 7, 0.55, 3000],
  ]
  for (const [from, q, level, to] of formants) {
    const band = p.filter('bandpass', from, q)
    const bandGain = p.gain(level)
    drive.connect(band).connect(bandGain).connect(env)
    band.frequency.setValueAtTime(from, t + 0.15)
    band.frequency.linearRampToValueAtTime(to, t + 0.9)
  }
  // Um tanto do sinal cru por cima dos formantes: mais áspero, menos "cantado".
  const raw = p.filter('highpass', 600)
  const rawGain = p.gain(0.25)
  drive.connect(raw).connect(rawGain).connect(env)

  const peak = 1.5 * vol
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(peak, t + 0.008)
  env.gain.setValueAtTime(peak, t + 1.05)
  env.gain.exponentialRampToValueAtTime(SILENCE, t + dur)
  p.toOut(env, 0.3)

  // O soco grave da cara explodindo na tela.
  const punch = p.osc('sine', 85)
  punch.frequency.setValueAtTime(85, t)
  punch.frequency.exponentialRampToValueAtTime(38, t + 0.25)
  const punchGain = p.gain(0)
  const punchDrive = p.shaper(2.2)
  const punchPost = p.gain(0.6)
  punch.connect(punchGain).connect(punchDrive).connect(punchPost)
  pluckEnv(punchGain.gain, t, vol, 0.003, 0.4)
  p.toOut(punchPost, 0.05)

  for (const source of [...folds, vibrato, tremor]) {
    source.start(t)
    source.stop(end)
  }
  punch.start(t)
  punch.stop(t + 0.5)
  startNoise(breath, t, end)
  p.finish()
  noiseHit(v, t, { type: 'lowpass', freq: 2200, peak: 0.6 * vol, decay: 0.12 })
  return dur
}

/** Lâmpada falhando: estalo e um "bzzzt" elétrico curto. */
export function flicker(v: Voice, t: number, vol: number) {
  const dur = 0.16
  const p = patch(v)
  const hum = p.osc('square', 100)
  const hum2 = p.osc('sawtooth', 120)
  const band = p.filter('bandpass', 1700, 1.4)
  const gain = p.gain(0)
  hum.connect(band)
  hum2.connect(band)
  band.connect(gain)
  const curve = new Float32Array(24)
  for (let i = 0; i < curve.length; i += 1) {
    const x = i / (curve.length - 1)
    curve[i] = vol * 0.35 * (0.4 + Math.random() * 0.6) * Math.min(1, x * 8) * Math.min(1, (1 - x) * 5)
  }
  gain.gain.setValueCurveAtTime(curve, t, dur)
  p.toOut(gain, 0.15)
  for (const source of [hum, hum2]) {
    source.start(t)
    source.stop(t + dur + 0.02)
  }
  p.finish()
  noiseHit(v, t, { type: 'highpass', freq: 3000, peak: 0.5 * vol, decay: 0.015 })
  return dur
}

/**
 * O impacto que acompanha o bote: um soco sub-grave que despenca (sente no
 * peito, mesmo na caixinha da TV, por causa da saturação), uma rajada de ruído
 * e um estrondo metálico com cauda no reverb. Vai pelo caminho alto.
 */
export function slam(v: Voice, t: number, vol: number) {
  const dur = 1.3
  const p = patch(v)

  // 1) Sub-grave: 72 Hz → 24 Hz, saturado (os harmônicos aparecem em caixa pequena).
  const sub = p.osc('sine', 72)
  sub.frequency.setValueAtTime(72, t)
  sub.frequency.exponentialRampToValueAtTime(24, t + 0.7)
  const subGain = p.gain(0)
  const subDrive = p.shaper(3)
  const subPost = p.gain(0.75)
  sub.connect(subGain).connect(subDrive).connect(subPost)
  pluckEnv(subGain.gain, t, 1.1 * vol, 0.002, 0.85)
  p.toOut(subPost, 0.1)

  // 2) Rajada: ruído grave, curtinho (o "ar" do golpe).
  const burst = p.noise('brown')
  const burstLow = p.filter('lowpass', 1400, 0.7)
  const burstGain = p.gain(0)
  burst.connect(burstLow).connect(burstGain)
  pluckEnv(burstGain.gain, t, 1.2 * vol, 0.001, 0.25)
  p.toOut(burstGain, 0.2)

  // 3) Estrondo metálico: ruído em duas bandas agudas, com cauda longa no reverb.
  const crash = p.noise('white')
  const crashBand = p.filter('bandpass', 3800, 1.6)
  const crashBand2 = p.filter('bandpass', 6200, 2.2)
  const crashGain = p.gain(0)
  crash.connect(crashBand).connect(crashGain)
  crash.connect(crashBand2).connect(crashGain)
  pluckEnv(crashGain.gain, t, 0.55 * vol, 0.002, 0.9)
  p.toOut(crashGain, 0.6)

  sub.start(t)
  sub.stop(t + dur)
  startNoise(burst, t, t + 0.35)
  startNoise(crash, t, t + dur)
  p.finish()
  return dur
}

/** TV de tubo desligando: um apito que despenca e um "toc" seco. */
export function powerdown(v: Voice, t: number, vol: number) {
  const dur = 0.55
  const p = patch(v)
  const whine = p.osc('sine', 7800)
  whine.frequency.setValueAtTime(7800, t)
  whine.frequency.exponentialRampToValueAtTime(160, t + 0.45)
  const whineGain = p.gain(0)
  whine.connect(whineGain)
  pluckEnv(whineGain.gain, t, 0.22 * vol, 0.004, 0.45)
  p.toOut(whineGain, 0.15)
  whine.start(t)
  whine.stop(t + dur)
  p.finish()
  noiseHit(v, t, { type: 'lowpass', freq: 900, peak: 0.7 * vol, decay: 0.07 })
  noiseHit(v, t + 0.42, { type: 'bandpass', freq: 2400, q: 2, peak: 0.25 * vol, decay: 0.03 })
  return dur
}

/**
 * Respiração rouca colada no ouvido direito: puxa, solta, puxa, solta. Ar
 * filtrado com um chiado de garganta por cima; o filtro sobe na puxada e
 * desce na soltada.
 */
export function breath(v: Voice, t: number, vol: number) {
  const dur = 2.4
  const p = patch(v)
  const air = p.noise('white')
  const body = p.filter('bandpass', 700, 1.2)
  const throat = p.filter('bandpass', 1900, 4)
  const throatGain = p.gain(0.45)
  const gain = p.gain(0)
  const pan = p.pan(0.45)
  air.connect(body).connect(gain)
  air.connect(throat).connect(throatGain).connect(gain)
  gain.connect(pan)

  // [início, fim, pico, puxada?] em segundos.
  const phases: [number, number, number, boolean][] = [
    [0.0, 0.6, 0.8, true],
    [0.7, 1.15, 1.0, false],
    [1.3, 1.85, 0.85, true],
    [1.95, 2.4, 1.1, false],
  ]
  const points = 120
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i += 1) {
    const s = (i / (points - 1)) * dur
    let level = 0
    for (const [from, to, peak] of phases) {
      if (s < from || s > to) continue
      const x = (s - from) / (to - from)
      level = peak * Math.sin(Math.PI * x) ** 1.5 * (0.85 + Math.random() * 0.3)
    }
    curve[i] = vol * 0.9 * level
  }
  gain.gain.setValueCurveAtTime(curve, t, dur)
  for (const [from, to, , inhale] of phases) {
    body.frequency.setValueAtTime(inhale ? 600 : 900, t + from)
    body.frequency.linearRampToValueAtTime(inhale ? 1100 : 500, t + to)
  }
  p.toOut(pan, 0.25)
  startNoise(air, t, t + dur + 0.02)
  p.finish()
  return dur
}

/**
 * Pavor crescendo (~2,9 s): um cacho de serras desafinadas a meio-tom umas
 * das outras subindo devagar, um sub-grave pulsando e o filtro abrindo. Corta
 * SECO no fim: o instante de silêncio logo antes do bote é o que pega.
 */
export function dread(v: Voice, t: number, vol: number) {
  const dur = 2.9
  const p = patch(v)
  const cluster = [110, 116.5, 123.5, 164.8, 174.6].map((hz) => p.osc('sawtooth', hz))
  const mix = p.gain(0.22)
  for (const osc of cluster) {
    const f = osc.frequency.value
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur)
    osc.detune.value = (Math.random() - 0.5) * 18
    osc.connect(mix)
  }
  const lowpass = p.filter('lowpass', 260, 2)
  lowpass.frequency.setValueAtTime(260, t)
  lowpass.frequency.exponentialRampToValueAtTime(3600, t + dur)
  const env = p.gain(0)
  mix.connect(lowpass).connect(env)
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.05 * vol, t + 0.4)
  env.gain.exponentialRampToValueAtTime(0.75 * vol, t + dur - 0.02)
  env.gain.linearRampToValueAtTime(0, t + dur)
  p.toOut(env, 0.35)

  // Sub-grave pulsando cada vez mais rápido (um coração que não é seu).
  const sub = p.osc('sine', 46)
  const subGain = p.gain(0)
  const pulse = p.osc('sine', 1.4)
  const pulseDepth = p.gain(0.25 * vol)
  pulse.frequency.setValueAtTime(1.4, t)
  pulse.frequency.linearRampToValueAtTime(5, t + dur)
  pulse.connect(pulseDepth).connect(subGain.gain)
  subGain.gain.setValueAtTime(0.3 * vol, t)
  subGain.gain.setValueAtTime(0.3 * vol, t + dur - 0.02)
  subGain.gain.linearRampToValueAtTime(0, t + dur)
  sub.connect(subGain)
  p.toOut(subGain, 0)

  for (const source of [...cluster, sub, pulse]) {
    source.start(t)
    source.stop(t + dur + 0.02)
  }
  p.finish()
  return dur
}

/** Um "passo" da rastejante: osso estalando e a mão batendo no chão. */
export function crawl(v: Voice, t: number, vol: number) {
  const dur = 0.35
  noiseHit(v, t, { type: 'highpass', freq: 2600, peak: 0.55 * vol, decay: 0.018 })
  noiseHit(v, t + 0.028, { type: 'highpass', freq: 3400, peak: 0.4 * vol, decay: 0.012 })
  noiseHit(v, t + 0.05, { type: 'bandpass', freq: 1800, q: 3, peak: 0.3 * vol, decay: 0.02 })
  const p = patch(v)
  const thud = p.osc('sine', 90)
  thud.frequency.setValueAtTime(90, t + 0.06)
  thud.frequency.exponentialRampToValueAtTime(38, t + 0.3)
  const thudGain = p.gain(0)
  thud.connect(thudGain)
  pluckEnv(thudGain.gain, t + 0.06, 0.9 * vol, 0.003, 0.25)
  p.toOut(thudGain, 0.2)
  thud.start(t + 0.06)
  thud.stop(t + dur)
  p.finish()
  return dur
}

/**
 * Vidro trincando (a pegadinha da tela quebrada): o estalo do impacto, um
 * baque abafado, estalinhos da rachadura correndo e cacos tilintando.
 */
export function shatter(v: Voice, t: number, vol: number) {
  const dur = 1.2
  noiseHit(v, t, { type: 'highpass', freq: 1800, peak: 0.9 * vol, decay: 0.09, wet: 0.2 })
  noiseHit(v, t, { type: 'lowpass', freq: 500, peak: 0.6 * vol, decay: 0.12 })
  for (let i = 0; i < 8; i += 1) {
    noiseHit(v, t + 0.03 + Math.random() * 0.4, { type: 'highpass', freq: 4000, peak: 0.3 * vol, decay: 0.01 })
  }
  const p = patch(v)
  const out = p.gain(1)
  for (let i = 0; i < 16; i += 1) {
    const at = t + 0.02 + Math.random() ** 1.6 * 0.9
    const ping = p.osc('sine', 2200 + Math.random() * 5000)
    const gain = p.gain(0)
    ping.connect(gain).connect(out)
    const fade = Math.max(0.15, 1 - (at - t) / dur)
    pluckEnv(gain.gain, at, (0.12 + Math.random() * 0.18) * vol * fade, 0.001, 0.05 + Math.random() * 0.15)
    ping.start(at)
    ping.stop(at + 0.25)
  }
  p.toOut(out, 0.35)
  p.finish()
  return dur
}
