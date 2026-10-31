/**
 * Peças do sintetizador: o "construtor de patch" que garante limpeza dos nós e
 * os instrumentos usados pelas trilhas e pelos efeitos.
 *
 * Regra de ouro: toda nota cria seus nós, agenda `start`/`stop` no relógio de
 * áudio e se desliga sozinha quando a última fonte termina. Nada fica ligado
 * no grafo depois de tocar — a festa dura horas e a TV pode ser modesta.
 *
 * Tudo aqui recebe um `BaseAudioContext`, então roda igual num AudioContext de
 * verdade, num OfflineAudioContext (medição de volume) ou no falso dos testes.
 */

/** Para onde uma voz manda o som: seco e o envio para o reverb. */
export type Out = { dry: AudioNode; wet: AudioNode }

export type Voice = {
  ctx: BaseAudioContext
  out: Out
  /** Ruído branco (2 s, mono), compartilhado. */
  noise: AudioBuffer
  /** Ruído marrom (2 s, mono): grave, bom para trovão e vento. */
  brown: AudioBuffer
}

/** Valor mínimo para rampas exponenciais (que não aceitam zero). */
export const SILENCE = 0.0001

// ---------------------------------------------------------------------------
// Buffers e curvas compartilhados
// ---------------------------------------------------------------------------

export function makeNoiseBuffers(ctx: BaseAudioContext): { noise: AudioBuffer; brown: AudioBuffer } {
  const length = Math.floor(ctx.sampleRate * 2)
  const noise = ctx.createBuffer(1, length, ctx.sampleRate)
  const brown = ctx.createBuffer(1, length, ctx.sampleRate)
  const white = noise.getChannelData(0)
  const low = brown.getChannelData(0)
  let last = 0
  let peak = 0
  for (let i = 0; i < length; i += 1) {
    const sample = Math.random() * 2 - 1
    white[i] = sample
    // Integração com vazamento: ruído marrom sem deriva.
    last = (last + 0.02 * sample) / 1.02
    low[i] = last
    peak = Math.max(peak, Math.abs(last))
  }
  const scale = peak > 0 ? 0.95 / peak : 1
  for (let i = 0; i < length; i += 1) low[i] *= scale
  return { noise, brown }
}

/**
 * Resposta de impulso sintética para o reverb: ruído estéreo com decaimento
 * exponencial que vai escurecendo (passa-baixa de um polo cada vez mais
 * fechado) — soa como uma igreja velha, não como um corredor de azulejo.
 */
export function makeImpulse(ctx: BaseAudioContext, seconds = 2.8, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const buffer = ctx.createBuffer(2, length, rate)
  const fadeIn = Math.floor(rate * 0.012)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let filtered = 0
    for (let i = 0; i < length; i += 1) {
      const x = i / length
      const coefficient = 0.65 - 0.5 * x
      filtered += coefficient * (Math.random() * 2 - 1 - filtered)
      const envelope = Math.pow(1 - x, decay) * (i < fadeIn ? i / fadeIn : 1)
      data[i] = filtered * envelope
    }
  }
  return buffer
}

const clipCurves = new Map<number, Float32Array<ArrayBuffer>>()

/** Curva de saturação suave (tanh). Cria harmônicos: o grave aparece até em caixinha de notebook. */
export function softClipCurve(drive: number): Float32Array<ArrayBuffer> {
  const key = Math.round(drive * 100)
  let curve = clipCurves.get(key)
  if (!curve) {
    const size = 1024
    curve = new Float32Array(size)
    const k = Math.max(0.05, drive)
    const norm = Math.tanh(k)
    for (let i = 0; i < size; i += 1) {
      const x = (i / (size - 1)) * 2 - 1
      curve[i] = Math.tanh(k * x) / norm
    }
    clipCurves.set(key, curve)
  }
  return curve
}

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>()

/** Onda periódica a partir das amplitudes dos harmônicos (1º, 2º, 3º...). Cacheada por contexto. */
export function harmonicWave(ctx: BaseAudioContext, key: string, amplitudes: number[]): PeriodicWave {
  let cache = waveCache.get(ctx)
  if (!cache) {
    cache = new Map()
    waveCache.set(ctx, cache)
  }
  let wave = cache.get(key)
  if (!wave) {
    const real = new Float32Array(amplitudes.length + 1)
    const imag = new Float32Array(amplitudes.length + 1)
    amplitudes.forEach((amplitude, index) => {
      imag[index + 1] = amplitude
    })
    wave = ctx.createPeriodicWave(real, imag)
    cache.set(key, wave)
  }
  return wave
}

/** Registros de um órgão de igreja: 8', 4', 2 2/3', 2', 1 3/5' e um pouco de 1'. */
const ORGAN_HARMONICS = [1, 0.62, 0.42, 0.34, 0.08, 0.16, 0, 0.1]

export function organWave(ctx: BaseAudioContext) {
  return harmonicWave(ctx, 'organ', ORGAN_HARMONICS)
}

// ---------------------------------------------------------------------------
// Construtor de patch
// ---------------------------------------------------------------------------

export type Patch = ReturnType<typeof patch>

/**
 * Cria nós lembrando de todos eles; `finish()` liga a limpeza automática:
 * quando a última fonte (oscilador/ruído) terminar, tudo é desligado.
 */
export function patch(v: Voice, onDone?: () => void) {
  const { ctx } = v
  const nodes: AudioNode[] = []
  const sources: AudioScheduledSourceNode[] = []

  const api = {
    ctx,
    gain(value = 1): GainNode {
      const node = ctx.createGain()
      node.gain.value = value
      nodes.push(node)
      return node
    },
    osc(type: Exclude<OscillatorType, 'custom'>, frequency: number): OscillatorNode {
      const node = ctx.createOscillator()
      node.type = type
      node.frequency.value = frequency
      sources.push(node)
      return node
    },
    wave(wave: PeriodicWave, frequency: number): OscillatorNode {
      const node = ctx.createOscillator()
      node.setPeriodicWave(wave)
      node.frequency.value = frequency
      sources.push(node)
      return node
    },
    noise(kind: 'white' | 'brown' = 'white', loop = true): AudioBufferSourceNode {
      const node = ctx.createBufferSource()
      node.buffer = kind === 'white' ? v.noise : v.brown
      node.loop = loop
      sources.push(node)
      return node
    },
    filter(type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
      const node = ctx.createBiquadFilter()
      node.type = type
      node.frequency.value = frequency
      node.Q.value = q
      nodes.push(node)
      return node
    },
    shaper(drive: number): WaveShaperNode {
      const node = ctx.createWaveShaper()
      node.curve = softClipCurve(drive)
      nodes.push(node)
      return node
    },
    /** Panorâmico estéreo (cai para um ganho neutro em navegador sem StereoPanner). */
    pan(value: number): AudioNode & { pan?: AudioParam } {
      const maker = (ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode })
        .createStereoPanner
      if (typeof maker === 'function') {
        const node = maker.call(ctx)
        node.pan.value = Math.max(-1, Math.min(1, value))
        nodes.push(node)
        return node
      }
      return api.gain(1)
    },
    /** Liga na saída da voz, com um tanto indo para o reverb. */
    toOut(node: AudioNode, wet = 0) {
      node.connect(v.out.dry)
      if (wet > 0) {
        const send = api.gain(wet)
        node.connect(send)
        send.connect(v.out.wet)
      }
    },
    /** Liga a limpeza automática. Chame depois de agendar todos os start/stop. */
    finish() {
      let pending = sources.length
      if (pending === 0) {
        for (const node of nodes) safeDisconnect(node)
        onDone?.()
        return
      }
      const done = () => {
        pending -= 1
        if (pending > 0) return
        for (const source of sources) safeDisconnect(source)
        for (const node of nodes) safeDisconnect(node)
        onDone?.()
      }
      for (const source of sources) source.addEventListener('ended', done, { once: true })
    },
  }
  return api
}

export function safeDisconnect(node: AudioNode) {
  try {
    node.disconnect()
  } catch {
    // Já desligado.
  }
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** Percussivo: sobe rápido e cai exponencialmente até o silêncio. */
export function pluckEnv(param: AudioParam, t: number, peak: number, attack: number, decay: number) {
  param.setValueAtTime(SILENCE, t)
  param.exponentialRampToValueAtTime(Math.max(peak, SILENCE * 2), t + Math.max(0.001, attack))
  param.exponentialRampToValueAtTime(SILENCE, t + Math.max(0.001, attack) + Math.max(0.01, decay))
}

/** Sustentado: sobe, segura até `t + dur`, solta em `release`. */
export function holdEnv(
  param: AudioParam,
  t: number,
  peak: number,
  attack: number,
  dur: number,
  release: number,
) {
  const top = Math.max(attack, dur)
  param.setValueAtTime(0, t)
  param.linearRampToValueAtTime(peak, t + attack)
  param.setValueAtTime(peak, t + top)
  param.linearRampToValueAtTime(0, t + top + Math.max(0.01, release))
}

/** Começa um ruído num ponto aleatório do buffer, para dois golpes seguidos não soarem iguais. */
export function startNoise(source: AudioBufferSourceNode, t: number, end: number) {
  const length = source.buffer?.duration ?? 2
  source.start(t, Math.random() * Math.max(0, length - 0.1))
  source.stop(end)
}

// ---------------------------------------------------------------------------
// Instrumentos melódicos
// ---------------------------------------------------------------------------

/** Caixinha de música: dente de metal (seno + oitava) e um "tim" agudo no ataque. */
export function musicBox(v: Voice, t: number, f: number, vel = 0.8, wet = 0.35) {
  const p = patch(v)
  const out = p.gain(0)
  const body = p.osc('sine', f)
  const octave = p.osc('sine', f * 2)
  const octaveGain = p.gain(0.2)
  const tink = p.osc('sine', f * 5.03)
  const tinkGain = p.gain(0)
  body.connect(out)
  octave.connect(octaveGain).connect(out)
  tink.connect(tinkGain).connect(out)
  pluckEnv(out.gain, t, 0.2 * vel, 0.004, 1.6)
  pluckEnv(tinkGain.gain, t, 0.45, 0.002, 0.06)
  p.toOut(out, wet)
  const end = t + 1.7
  for (const source of [body, octave, tink]) {
    source.start(t)
    source.stop(end)
  }
  p.finish()
}

/** Órgão de tubos: onda com harmônicos e ataque macio. */
export function organ(v: Voice, t: number, f: number, dur: number, vel = 0.8, wet = 0.45) {
  const p = patch(v)
  const osc = p.wave(organWave(v.ctx), f)
  const gain = p.gain(0)
  osc.connect(gain)
  holdEnv(gain.gain, t, 0.085 * vel, 0.04, dur, 0.22)
  p.toOut(gain, wet)
  osc.start(t)
  osc.stop(t + Math.max(0.04, dur) + 0.26)
  p.finish()
}

/** Pizzicato: dente de serra com filtro que fecha rápido — a corda beliscada. */
export function pluck(v: Voice, t: number, f: number, vel = 0.8, decay = 0.35, wet = 0.2) {
  const p = patch(v)
  const osc = p.osc('sawtooth', f)
  const top = Math.min(f * 8, 7000)
  const lp = p.filter('lowpass', top, 1.4)
  const gain = p.gain(0)
  osc.connect(lp).connect(gain)
  lp.frequency.setValueAtTime(top, t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 120), t + decay * 0.6)
  pluckEnv(gain.gain, t, 0.19 * vel, 0.003, decay)
  p.toOut(gain, wet)
  osc.start(t)
  osc.stop(t + decay + 0.06)
  p.finish()
}

/** Baixo: serra filtrada (o triângulo puro some nas caixinhas de TV). */
export function bass(v: Voice, t: number, f: number, dur: number, vel = 0.8) {
  const p = patch(v)
  const osc = p.osc('sawtooth', f)
  const lp = p.filter('lowpass', Math.min(f * 5, 900), 0.8)
  const gain = p.gain(0)
  osc.connect(lp).connect(gain)
  const peak = Math.max(0.001, 0.26 * vel)
  const hold = Math.max(0.05, dur)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(peak * 0.45, t + hold)
  gain.gain.linearRampToValueAtTime(0, t + hold + 0.06)
  p.toOut(gain, 0.06)
  osc.start(t)
  osc.stop(t + hold + 0.08)
  p.finish()
}

/** Xilofone (os ossos do esqueleto): seno com parcial inarmônico curtinho. */
export function xylo(v: Voice, t: number, f: number, vel = 0.8, wet = 0.25) {
  const p = patch(v)
  const gain = p.gain(0)
  const body = p.osc('sine', f)
  const knock = p.osc('sine', f * 3.93)
  const knockGain = p.gain(0)
  body.connect(gain)
  knock.connect(knockGain).connect(gain)
  pluckEnv(gain.gain, t, 0.28 * vel, 0.002, 0.42)
  pluckEnv(knockGain.gain, t, 0.6, 0.001, 0.05)
  p.toOut(gain, wet)
  for (const source of [body, knock]) {
    source.start(t)
    source.stop(t + 0.48)
  }
  p.finish()
}

/** Clarinete assombrado: quadrada filtrada com vibrato — a melodia do swing. */
export function lead(v: Voice, t: number, f: number, dur: number, vel = 0.8, wet = 0.3) {
  const p = patch(v)
  const osc = p.osc('square', f)
  const lfo = p.osc('sine', 5.2)
  const depth = p.gain(f * 0.008)
  lfo.connect(depth).connect(osc.frequency)
  const lp = p.filter('lowpass', Math.min(f * 3.2, 3200), 0.9)
  const gain = p.gain(0)
  osc.connect(lp).connect(gain)
  holdEnv(gain.gain, t, 0.1 * vel, 0.025, dur, 0.07)
  p.toOut(gain, wet)
  const end = t + Math.max(0.025, dur) + 0.1
  for (const source of [osc, lfo]) {
    source.start(t)
    source.stop(end)
  }
  p.finish()
}

/** Metais em golpe curto (acordes do swing, pancadas da perseguição). */
export function brass(v: Voice, t: number, f: number, dur: number, vel = 0.8, wet = 0.25) {
  const p = patch(v)
  const osc = p.osc('sawtooth', f)
  const lp = p.filter('lowpass', 350, 1.2)
  const gain = p.gain(0)
  osc.connect(lp).connect(gain)
  const hold = Math.max(0.05, dur)
  lp.frequency.setValueAtTime(350, t)
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 7, 4200), t + 0.05)
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 3, 2000), t + 0.05 + hold)
  holdEnv(gain.gain, t, 0.13 * vel, 0.02, hold, 0.09)
  p.toOut(gain, wet)
  osc.start(t)
  osc.stop(t + hold + 0.12)
  p.finish()
}

/** Cordas em staccato: duas serras desafinadas de leve (o filtro fica por conta da trilha). */
export function strings(v: Voice, t: number, f: number, dur: number, vel = 0.8) {
  const p = patch(v)
  const gain = p.gain(0)
  const a = p.osc('sawtooth', f)
  const b = p.osc('sawtooth', f)
  a.detune.value = -7
  b.detune.value = 7
  a.connect(gain)
  b.connect(gain)
  const hold = Math.max(0.03, dur)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.075 * vel, t + 0.008)
  gain.gain.linearRampToValueAtTime(0.05 * vel, t + hold)
  gain.gain.linearRampToValueAtTime(0, t + hold + 0.04)
  p.toOut(gain, 0)
  for (const source of [a, b]) {
    source.start(t)
    source.stop(t + hold + 0.06)
  }
  p.finish()
}

/** Parciais de sino de igreja: [razão, amplitude, fator de duração]. */
const BELL_PARTIALS: [number, number, number][] = [
  [0.5, 0.32, 1],
  [1, 0.5, 0.8],
  [1.183, 0.38, 0.62],
  [1.506, 0.2, 0.5],
  [2, 0.42, 0.52],
  [2.514, 0.15, 0.34],
  [2.662, 0.13, 0.3],
  [3.011, 0.11, 0.24],
  [4.166, 0.06, 0.16],
]

/** Sino de igreja: parciais inarmônicos, cada um morrendo no seu tempo. */
export function bell(v: Voice, t: number, f: number, vel = 0.8, decay = 4, wet = 0.45) {
  const p = patch(v)
  const sum = p.gain(0.17 * vel)
  for (const [ratio, amplitude, factor] of BELL_PARTIALS) {
    const osc = p.osc('sine', f * ratio)
    const gain = p.gain(0)
    osc.connect(gain).connect(sum)
    const life = Math.max(0.1, decay * factor)
    pluckEnv(gain.gain, t, amplitude, 0.004, life)
    osc.start(t)
    osc.stop(t + life + 0.05)
  }
  p.toOut(sum, wet)
  p.finish()
}

/** Nota de vidro: dois senos quase iguais (batimento lento), ataque lento, muito reverb. */
export function glass(v: Voice, t: number, f: number, dur = 3, vel = 0.6, wet = 0.6) {
  const p = patch(v)
  const gain = p.gain(0)
  const a = p.osc('sine', f)
  const b = p.osc('sine', f * 1.006)
  a.connect(gain)
  b.connect(gain)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.06 * vel, t + dur * 0.3)
  gain.gain.linearRampToValueAtTime(0, t + dur)
  p.toOut(gain, wet)
  for (const source of [a, b]) {
    source.start(t)
    source.stop(t + dur + 0.02)
  }
  p.finish()
}

// ---------------------------------------------------------------------------
// Percussão
// ---------------------------------------------------------------------------

/** Bumbo: seno com queda de afinação, saturado para aparecer em caixa pequena. */
export function kick(v: Voice, t: number, vel = 0.8) {
  const p = patch(v)
  const osc = p.osc('sine', 150)
  const gain = p.gain(0)
  const drive = p.shaper(2)
  const post = p.gain(0.32)
  osc.connect(gain).connect(drive).connect(post)
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.13)
  pluckEnv(gain.gain, t, 0.9 * vel, 0.003, 0.3)
  p.toOut(post, 0)
  osc.start(t)
  osc.stop(t + 0.36)
  p.finish()
}

/** Coração: "tum-tum" grave (o segundo mais fraco). */
export function heart(v: Voice, t: number, vel = 0.8) {
  const p = patch(v)
  const drive = p.shaper(2.4)
  const lp = p.filter('lowpass', 320, 0.7)
  const post = p.gain(0.5)
  drive.connect(lp).connect(post)
  const beats: [number, number, number, number][] = [
    [0, 1, 88, 46],
    [0.22, 0.7, 98, 52],
  ]
  for (const [offset, peak, from, to] of beats) {
    const start = t + offset
    const osc = p.osc('sine', from)
    const gain = p.gain(0)
    osc.connect(gain).connect(drive)
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(to, start + 0.12)
    pluckEnv(gain.gain, start, peak * vel, 0.008, 0.2)
    osc.start(start)
    osc.stop(start + 0.25)
  }
  p.toOut(post, 0.05)
  p.finish()
}

type NoiseHit = {
  type: BiquadFilterType
  freq: number
  q?: number
  peak: number
  decay: number
  attack?: number
  kind?: 'white' | 'brown'
  wet?: number
}

/** Golpe de ruído filtrado — base de caixa, chimbal, tique de relógio. */
export function noiseHit(v: Voice, t: number, hit: NoiseHit) {
  const p = patch(v)
  const source = p.noise(hit.kind ?? 'white')
  const filter = p.filter(hit.type, hit.freq, hit.q ?? 0.7)
  const gain = p.gain(0)
  source.connect(filter).connect(gain)
  pluckEnv(gain.gain, t, hit.peak, hit.attack ?? 0.002, hit.decay)
  p.toOut(gain, hit.wet ?? 0)
  startNoise(source, t, t + (hit.attack ?? 0.002) + hit.decay + 0.03)
  p.finish()
}

export function snare(v: Voice, t: number, vel = 0.8) {
  noiseHit(v, t, { type: 'bandpass', freq: 1900, q: 0.8, peak: 0.42 * vel, decay: 0.16, wet: 0.12 })
  const p = patch(v)
  const osc = p.osc('triangle', 190)
  const gain = p.gain(0)
  osc.connect(gain)
  pluckEnv(gain.gain, t, 0.16 * vel, 0.002, 0.08)
  p.toOut(gain, 0)
  osc.start(t)
  osc.stop(t + 0.12)
  p.finish()
}

/** Vassourinha na caixa (swing): ruído macio e curto. */
export function brush(v: Voice, t: number, vel = 0.8) {
  noiseHit(v, t, { type: 'bandpass', freq: 3200, q: 0.6, peak: 0.16 * vel, attack: 0.01, decay: 0.14 })
}

export function hat(v: Voice, t: number, vel = 0.8, open = false) {
  noiseHit(v, t, { type: 'highpass', freq: 7000, q: 0.7, peak: 0.16 * vel, decay: open ? 0.22 : 0.045 })
}

/** Prato de condução: chiado metálico com um "ding" no ataque. */
export function ride(v: Voice, t: number, vel = 0.8) {
  noiseHit(v, t, { type: 'bandpass', freq: 7600, q: 1.1, peak: 0.12 * vel, decay: 0.3 })
  const p = patch(v)
  const osc = p.osc('sine', 3150)
  const gain = p.gain(0)
  osc.connect(gain)
  pluckEnv(gain.gain, t, 0.03 * vel, 0.002, 0.25)
  p.toOut(gain, 0.1)
  osc.start(t)
  osc.stop(t + 0.3)
  p.finish()
}

/** Casco de cavalo / bloco de madeira. */
export function clop(v: Voice, t: number, f = 900, vel = 0.8) {
  const p = patch(v)
  const osc = p.osc('sine', f * 1.6)
  const gain = p.gain(0)
  osc.connect(gain)
  osc.frequency.setValueAtTime(f * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.012)
  pluckEnv(gain.gain, t, 0.3 * vel, 0.001, 0.06)
  p.toOut(gain, 0.08)
  osc.start(t)
  osc.stop(t + 0.09)
  p.finish()
}

/** Tique-taque de relógio: estalo de ruído num filtro estreito. */
export function tickTock(v: Voice, t: number, vel = 0.8, high = true) {
  noiseHit(v, t, {
    type: 'bandpass',
    freq: high ? 3400 : 2300,
    q: 7,
    peak: 0.95 * vel,
    attack: 0.001,
    decay: 0.03,
    wet: 0.1,
  })
}

// ---------------------------------------------------------------------------
// Camadas contínuas (devolvem a função que desliga num horário)
// ---------------------------------------------------------------------------

export type StopLayer = (at: number) => void

/** Zumbido grave contínuo, com o filtro respirando devagar. */
export function drone(v: Voice, t: number, freqs: number[], level = 0.1, cutoff = 260): StopLayer {
  const p = patch(v)
  const lp = p.filter('lowpass', cutoff, 2.2)
  const gain = p.gain(0)
  lp.connect(gain)
  const lfo = p.osc('sine', 0.05)
  const lfoDepth = p.gain(cutoff * 0.35)
  lfo.connect(lfoDepth).connect(lp.frequency)
  const sources: OscillatorNode[] = [lfo]
  for (const f of freqs) {
    for (const detune of [-6, 6]) {
      const osc = p.osc('sawtooth', f)
      osc.detune.value = detune
      osc.connect(lp)
      sources.push(osc)
    }
  }
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(level, t + 3)
  p.toOut(gain, 0.25)
  for (const source of sources) source.start(t)
  p.finish()
  let stopped = false
  return (at) => {
    if (stopped) return
    stopped = true
    for (const source of sources) source.stop(Math.max(at, t))
  }
}

/** Vento: ruído num passa-faixa que passeia, com rajadas lentas. */
export function wind(v: Voice, t: number, level = 0.1): StopLayer {
  const p = patch(v)
  const source = p.noise('white', true)
  const body = p.filter('bandpass', 480, 0.9)
  const whistle = p.filter('bandpass', 1300, 6)
  const whistleGain = p.gain(0.35)
  const amp = p.gain(level * 0.6)
  const master = p.gain(0)
  source.connect(body).connect(amp)
  source.connect(whistle).connect(whistleGain).connect(amp)
  amp.connect(master)

  // LFOs: a frequência passeia e o volume vem em rajadas.
  const sweep = p.osc('sine', 0.071)
  const sweepDepth = p.gain(260)
  sweep.connect(sweepDepth).connect(body.frequency)
  const whistleSweep = p.osc('sine', 0.043)
  const whistleDepth = p.gain(420)
  whistleSweep.connect(whistleDepth).connect(whistle.frequency)
  const gust = p.osc('sine', 0.113)
  const gustDepth = p.gain(level * 0.4)
  gust.connect(gustDepth).connect(amp.gain)

  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(1, t + 4)
  p.toOut(master, 0.3)

  source.start(t, Math.random())
  const lfos = [sweep, whistleSweep, gust]
  for (const lfo of lfos) lfo.start(t)
  p.finish()
  let stopped = false
  return (at) => {
    if (stopped) return
    stopped = true
    const when = Math.max(at, t)
    source.stop(when)
    for (const lfo of lfos) lfo.stop(when)
  }
}
