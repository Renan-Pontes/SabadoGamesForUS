/**
 * AudioContext de mentira para os testes (Vitest roda em Node, sem Web Audio).
 *
 * Não produz som: registra nós, ligações e automações, e reclama como o
 * navegador reclamaria (rampa exponencial até zero, `start` duas vezes,
 * valor NaN, curva sobreposta...). Com ele dá para provar que cada efeito e
 * cada trilha desliga todos os nós que criou — nada vaza na festa.
 */

/** `value`: o alvo do evento (os testes conferem para onde o ganho vai). */
type Automation = { kind: string; time: number; duration?: number; value?: number }

export class FakeParam {
  value: number
  automation: Automation[] = []

  constructor(value: number) {
    this.value = value
  }

  private check(kind: string, time: number, values: number[]) {
    if (!Number.isFinite(time)) throw new TypeError(`${kind}: tempo inválido (${time})`)
    if (time < 0) throw new RangeError(`${kind}: tempo negativo (${time})`)
    for (const value of values) {
      if (!Number.isFinite(value)) throw new TypeError(`${kind}: valor inválido (${value})`)
    }
    for (const event of this.automation) {
      if (event.kind !== 'curve' || event.duration === undefined) continue
      if (time > event.time && time < event.time + event.duration) {
        throw new Error(`NotSupportedError: ${kind} dentro de uma curva`)
      }
    }
  }

  setValueAtTime(value: number, time: number) {
    this.check('setValueAtTime', time, [value])
    this.automation.push({ kind: 'set', time, value })
    return this
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.check('linearRamp', time, [value])
    this.automation.push({ kind: 'linear', time, value })
    return this
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.check('exponentialRamp', time, [value])
    if (value === 0) throw new RangeError('exponentialRamp até zero')
    this.automation.push({ kind: 'exp', time, value })
    return this
  }

  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.check('setTarget', time, [value, timeConstant])
    if (timeConstant < 0) throw new RangeError('setTarget: constante negativa')
    this.automation.push({ kind: 'target', time, value })
    return this
  }

  setValueCurveAtTime(values: ArrayLike<number>, time: number, duration: number) {
    this.check('setValueCurve', time, [duration, ...Array.from(values)])
    if (values.length < 2) throw new Error('InvalidStateError: curva com menos de 2 pontos')
    if (!(duration > 0)) throw new RangeError('setValueCurve: duração inválida')
    for (const event of this.automation) {
      if (event.time > time && event.time < time + duration) {
        throw new Error('NotSupportedError: curva sobre outro evento')
      }
    }
    this.automation.push({ kind: 'curve', time, duration })
    return this
  }

  cancelScheduledValues(time: number) {
    this.check('cancel', time, [])
    this.automation = this.automation.filter((event) => event.time < time)
    return this
  }
}

export class FakeNode {
  readonly context: FakeAudioContext
  readonly outputs = new Set<FakeNode | FakeParam>()
  /** Já recebeu alguma ligação (o som chegou aqui pelo menos uma vez). */
  receivedInput = false

  constructor(context: FakeAudioContext) {
    this.context = context
    context.created.push(this)
  }

  connect<T extends FakeNode | FakeParam>(destination: T): T {
    if (!destination) throw new TypeError('connect sem destino')
    this.outputs.add(destination)
    if (destination instanceof FakeNode) destination.receivedInput = true
    return destination
  }

  disconnect() {
    this.outputs.clear()
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}

export class FakeBiquad extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam(350)
  Q = new FakeParam(1)
  gain = new FakeParam(0)
  detune = new FakeParam(0)
}

export class FakeShaper extends FakeNode {
  curve: Float32Array | null = null
  oversample = 'none'
}

export class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null
  normalize = true
}

export class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24)
  knee = new FakeParam(30)
  ratio = new FakeParam(12)
  attack = new FakeParam(0.003)
  release = new FakeParam(0.25)
}

export class FakePanner extends FakeNode {
  pan = new FakeParam(0)
}

export class FakeSource extends FakeNode {
  startedAt: number | null = null
  stoppedAt: number | null = null
  ended = false
  onended: (() => void) | null = null
  private listeners: (() => void)[] = []

  start(when = 0) {
    if (this.startedAt !== null) throw new Error('InvalidStateError: start duas vezes')
    if (!Number.isFinite(when) || when < 0) throw new RangeError(`start inválido (${when})`)
    this.startedAt = when
    this.context.active.add(this)
  }

  stop(when = 0) {
    if (this.startedAt === null) throw new Error('InvalidStateError: stop antes do start')
    if (!Number.isFinite(when) || when < 0) throw new RangeError(`stop inválido (${when})`)
    this.stoppedAt = when
  }

  addEventListener(type: string, listener: () => void) {
    if (type === 'ended') this.listeners.push(listener)
  }

  removeEventListener(type: string, listener: () => void) {
    if (type === 'ended') this.listeners = this.listeners.filter((item) => item !== listener)
  }

  /** Quando termina sozinho (buffer sem laço); Infinity para osciladores. */
  naturalEnd(): number {
    return Infinity
  }

  endTime(): number {
    if (this.startedAt === null) return Infinity
    return Math.max(this.startedAt, Math.min(this.stoppedAt ?? Infinity, this.naturalEnd()))
  }

  fireIfDue(now: number) {
    if (this.ended || this.startedAt === null || this.endTime() > now) return
    this.ended = true
    this.context.active.delete(this)
    for (const listener of [...this.listeners]) listener()
    this.onended?.()
  }
}

export class FakeOscillator extends FakeSource {
  type = 'sine'
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  periodicWave: unknown = null

  setPeriodicWave(wave: unknown) {
    this.periodicWave = wave
    this.type = 'custom'
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null
  loop = false
  playbackRate = new FakeParam(1)
  detune = new FakeParam(0)
  private offset = 0

  start(when = 0, offset = 0) {
    if (!Number.isFinite(offset) || offset < 0) throw new RangeError(`offset inválido (${offset})`)
    this.offset = offset
    super.start(when)
  }

  naturalEnd(): number {
    if (this.loop || !this.buffer || this.startedAt === null) return Infinity
    return this.startedAt + Math.max(0, this.buffer.duration - this.offset)
  }
}

export class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  readonly duration: number
  private readonly channels: Float32Array[]

  constructor(channels: number, length: number, sampleRate: number) {
    if (!(length > 0)) throw new Error('NotSupportedError: buffer vazio')
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this.channels = Array.from({ length: channels }, () => new Float32Array(length))
  }

  getChannelData(channel: number) {
    return this.channels[channel]
  }
}

export class FakeAudioContext {
  currentTime = 0
  sampleRate = 8000
  state = 'running'
  readonly created: FakeNode[] = []
  readonly active = new Set<FakeSource>()
  readonly destination: FakeNode

  constructor() {
    this.destination = new FakeNode(this)
  }

  createGain() {
    return new FakeGain(this)
  }
  createBiquadFilter() {
    return new FakeBiquad(this)
  }
  createWaveShaper() {
    return new FakeShaper(this)
  }
  createConvolver() {
    return new FakeConvolver(this)
  }
  createDynamicsCompressor() {
    return new FakeCompressor(this)
  }
  createStereoPanner() {
    return new FakePanner(this)
  }
  createOscillator() {
    return new FakeOscillator(this)
  }
  createBufferSource() {
    return new FakeBufferSource(this)
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new FakeBuffer(channels, length, sampleRate)
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    if (real.length !== imag.length || real.length < 2) throw new Error('IndexSizeError: onda')
    return { real, imag }
  }

  /** Avança o relógio e dispara o `ended` de quem terminou. */
  advance(to: number) {
    this.currentTime = to
    for (const source of [...this.active]) source.fireIfDue(to)
  }

  /** Para usar onde o código espera um BaseAudioContext de verdade. */
  asContext(): BaseAudioContext {
    return this as unknown as BaseAudioContext
  }
}
