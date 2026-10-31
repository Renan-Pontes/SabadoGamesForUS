import { softClipCurve } from './synth'
import type { SfxName } from './types'

/**
 * Caminho de SUSTO: o som que tem que fazer a sala pular do sofá.
 *
 *   efeitos de susto ─► pré-ganho ─► saturação ─► limitador ─► volume do susto ─┐
 *   resto do app ────► compressor ─► volume geral ──────────────────────────────┴─► teto ─► caixas
 *
 * O compressor do caminho normal segura os picos — ótimo para a trilha,
 * péssimo para susto. Aqui o som é empurrado para dentro da saturação (fica
 * denso, "cheio", bem mais alto para o ouvido), o limitador segura o pico
 * com ataque de 1 ms, e o teto (uma curva fixa com sobreamostragem 4x, a
 * última coisa antes das caixas) segura o pico de amostra em −3 dBFS e o
 * true-peak abaixo de −0,3 dBTP, nem com o resto do app tocando junto.
 * Enquanto o susto soa, a música vai a zero e depois volta devagar.
 */

/**
 * Efeitos que SEMPRE tocam pelo caminho alto (e calam a música enquanto
 * soam): os que só os sustos usam. 'scream' e 'static' ficam fora — os jogos
 * tocam esses a cada rodada; as cenas de susto pedem `{ loud: true }`.
 */
export const LOUD_SFX: readonly SfxName[] = ['screech', 'shriek', 'jumpscare']

export function isLoudSfx(name: SfxName): boolean {
  return LOUD_SFX.includes(name)
}

export const LOUD_SETTINGS = {
  /** Empurra o som para dentro da saturação. */
  pre: 3.2,
  /** Força da saturação (tanh): mais harmônicos, mais "volume" para o ouvido. */
  drive: 2.8,
  /** Limitador: só pega os picos (threshold alto, ratio alto, ataque de 1 ms). */
  threshold: -2,
  knee: 0,
  ratio: 20,
  attack: 0.001,
  release: 0.12,
  /** Volume mínimo do susto (0–1): com o volume do aparelho baixo, o susto ainda pula. */
  minVolume: 0.9,
  /** Controle do app até aqui = silêncio também para o susto (o slider no zero cala a TV). */
  silentAtOrBelow: 0.02,
  /** Abaixo disto o piso de 0,9 cai junto com o controle, até zero. */
  floorFrom: 0.15,
  /** Música: some em ~50 ms e volta com esta constante de tempo (s) depois do susto. */
  hushFade: 0.012,
  hushRecover: 0.6,
}

/**
 * Pico de amostra máximo na saída: −3 dBFS. A folga de 2,7 dB é para o
 * true-peak (o pico entre amostras, que o conversor da TV reconstrói): com o
 * teto em −0,3 dBFS ele passava de 0 dBTP (+0,5 a +3,5); assim fica abaixo de
 * −0,3 dBTP mesmo com 9 efeitos ×2 no volume máximo. Custa ~0,5–1,3 LU.
 */
export const OUTPUT_CEILING = 10 ** (-3 / 20)
/** Até aqui o teto não encosta no som (linear); acima, dobra suave até o teto. */
export const CEILING_KNEE = 0.55

let ceilingCache: Float32Array<ArrayBuffer> | null = null

/**
 * Curva do teto: idêntica ao sinal até 0,55 e, acima disso, uma dobra suave
 * (tanh) que nunca chega ao teto. Como o WaveShaper prende a entrada em ±1,
 * a saída fica sempre abaixo de −3 dBFS, aconteça o que acontecer antes. Perto
 * de ±1 a curva já é quase plana (inclinação ~0,013), então prender a entrada
 * não vira corte seco.
 */
export function ceilingCurve(): Float32Array<ArrayBuffer> {
  if (ceilingCache) return ceilingCache
  const size = 4097
  const room = OUTPUT_CEILING - CEILING_KNEE
  const curve = new Float32Array(size)
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= CEILING_KNEE ? a : CEILING_KNEE + room * Math.tanh((a - CEILING_KNEE) / room)
    curve[i] = x < 0 ? -y : y
  }
  ceilingCache = curve
  return curve
}

/** O teto da saída inteira. Ligue tudo nele, e ele nas caixas. */
export function buildCeiling(ctx: BaseAudioContext, destination: AudioNode): WaveShaperNode {
  const node = ctx.createWaveShaper()
  node.curve = ceilingCurve()
  // Sobreamostrado: a dobra não cria harmônicos que viram picos entre amostras.
  node.oversample = '4x'
  node.connect(destination)
  return node
}

export type ScareBus = {
  /** Entrada do caminho alto (o "seco" da voz dos efeitos de susto). */
  input: GainNode
  /** Volume do caminho alto: mudo cala, volume baixo vira 0,9 (veja `scareVolumeGain`). */
  volume: GainNode
}

/** Pré-ganho → saturação → limitador → volume → `destination` (o teto). */
export function buildScareBus(ctx: BaseAudioContext, destination: AudioNode): ScareBus {
  const s = LOUD_SETTINGS
  const input = ctx.createGain()
  input.gain.value = s.pre
  const drive = ctx.createWaveShaper()
  drive.curve = softClipCurve(s.drive)
  drive.oversample = '2x'
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = s.threshold
  limiter.knee.value = s.knee
  limiter.ratio.value = s.ratio
  limiter.attack.value = s.attack
  limiter.release.value = s.release
  const volume = ctx.createGain()
  volume.gain.value = 0
  input.connect(drive).connect(limiter).connect(volume).connect(destination)
  return { input, volume }
}

/**
 * Ganho do caminho de susto. Mudo é mudo, e o controle do app no zero
 * (≤ 0,02) também cala o susto. Com o controle a partir de 0,15, o susto sai
 * com no mínimo 0,9 do volume cheio (quem manda no resto é o volume da
 * própria TV); entre 0,02 e 0,15 esse piso cai junto com o controle, até zero.
 * Com o controle acima de 0,9, segue o controle.
 */
export function scareVolumeGain(state: { muted: boolean; volume: number }): number {
  if (state.muted) return 0
  const s = LOUD_SETTINGS
  const volume = Number.isFinite(state.volume) ? Math.min(1, Math.max(0, state.volume)) : 1
  if (volume <= s.silentAtOrBelow) return 0
  const floor = s.minVolume * Math.min(1, volume / s.floorFrom)
  return Math.max(floor, volume)
}

export type MusicHush = {
  /** Cala a música agora (`now`) até `until` (relógio de áudio); depois ela volta devagar. */
  hold(now: number, until: number): void
  /** Até quando a música está calada (relógio de áudio). */
  readonly until: number
}

/**
 * "Portão" da música: ganhos que ficam em 1 e vão a zero durante o susto.
 * Pedidos que se sobrepõem só esticam o silêncio; um pedido que já cabe
 * dentro do silêncio atual não mexe em nada (nada de estalo no meio do susto).
 */
export function createMusicHush(params: AudioParam[]): MusicHush {
  let until = 0
  return {
    hold(now: number, end: number) {
      if (!Number.isFinite(now) || !Number.isFinite(end) || end <= now) return
      if (now < until && end <= until) return
      until = Math.max(until, end)
      for (const param of params) {
        param.cancelScheduledValues(now)
        param.setValueAtTime(param.value, now)
        param.setTargetAtTime(0, now, LOUD_SETTINGS.hushFade)
        param.setTargetAtTime(1, until, LOUD_SETTINGS.hushRecover)
      }
    },
    get until() {
      return until
    },
  }
}
