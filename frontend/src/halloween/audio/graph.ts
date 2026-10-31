import { buildCeiling, buildScareBus, createMusicHush, isLoudSfx, scareVolumeGain } from './loud'
import type { MusicHush } from './loud'
import { SFX } from './sfx'
import { makeImpulse, makeNoiseBuffers } from './synth'
import type { Voice } from './synth'
import type { SfxName } from './types'

/**
 * O grafo do motor de áudio, separado do AudioContext de verdade para dar
 * para montar num OfflineAudioContext (medição) ou no falso dos testes.
 *
 *   trilhas ─► música (seco) ──► portão ─┐
 *            ► música (reverb) ► portão ─┼─► reverb ─┐
 *   efeitos ─► efeitos (seco) ───────────┼───────────┴─► compressor ─► volume ──────┐
 *            ► efeitos (reverb) ─────────┘                                            ├─► teto ─► caixas
 *   sustos ──► pré-ganho ─► saturação ─► limitador ─► volume do susto ───────────────┘
 *
 * O "portão" da música vai a zero enquanto um efeito de susto toca. O teto
 * (loud.ts) garante pico ≤ −0,3 dBFS na saída, com tudo somado.
 */

/** Volume da música em relação aos efeitos: trilha é fundo, não protagonista. */
export const MUSIC_LEVEL = 0.42
export const SFX_LEVEL = 0.95

export type AudioGraph = {
  master: GainNode
  /** Volume do caminho de susto (mudo = 0; senão no mínimo 0,9 do volume cheio). */
  scareVolume: GainNode
  musicDry: GainNode
  musicWet: GainNode
  /** Cala a música durante os sustos. */
  hush: MusicHush
  sfxVoice: Voice
  /** Voz dos efeitos de susto: seco no caminho alto, reverb no normal. */
  scareVoice: Voice
  noise: AudioBuffer
  brown: AudioBuffer
}

export function buildGraph(ctx: BaseAudioContext): AudioGraph {
  const ceiling = buildCeiling(ctx, ctx.destination)

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -16
  compressor.knee.value = 10
  compressor.ratio.value = 4
  compressor.attack.value = 0.004
  compressor.release.value = 0.25

  const master = ctx.createGain()
  master.gain.value = 0
  compressor.connect(master)
  master.connect(ceiling)

  const scare = buildScareBus(ctx, ceiling)

  const reverbIn = ctx.createGain()
  const reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx)
  const reverbOut = ctx.createGain()
  reverbOut.gain.value = 0.8
  reverbIn.connect(reverb).connect(reverbOut).connect(compressor)

  const musicGateDry = ctx.createGain()
  musicGateDry.connect(compressor)
  const musicGateWet = ctx.createGain()
  musicGateWet.connect(reverbIn)
  const musicDry = ctx.createGain()
  musicDry.gain.value = MUSIC_LEVEL
  musicDry.connect(musicGateDry)
  const musicWet = ctx.createGain()
  musicWet.gain.value = MUSIC_LEVEL
  musicWet.connect(musicGateWet)

  const sfxDry = ctx.createGain()
  sfxDry.gain.value = SFX_LEVEL
  sfxDry.connect(compressor)
  const sfxWet = ctx.createGain()
  sfxWet.gain.value = SFX_LEVEL
  sfxWet.connect(reverbIn)

  const { noise, brown } = makeNoiseBuffers(ctx)
  return {
    master,
    scareVolume: scare.volume,
    musicDry,
    musicWet,
    hush: createMusicHush([musicGateDry.gain, musicGateWet.gain]),
    noise,
    brown,
    sfxVoice: { ctx, out: { dry: sfxDry, wet: sfxWet }, noise, brown },
    scareVoice: { ctx, out: { dry: scare.input, wet: sfxWet }, noise, brown },
  }
}

/** Volume geral e do caminho de susto (mudo corta os dois). */
export function applyVolumes(
  g: AudioGraph,
  state: { muted: boolean; volume: number },
  now: number,
  immediate = false,
) {
  const targets: [AudioParam, number][] = [
    [g.master.gain, state.muted ? 0 : state.volume * state.volume],
    [g.scareVolume.gain, scareVolumeGain(state)],
  ]
  for (const [param, target] of targets) {
    param.cancelScheduledValues(now)
    if (immediate) param.setValueAtTime(target, now)
    else param.setTargetAtTime(target, now, 0.06)
  }
}

/**
 * Toca um efeito no grafo: os de susto (`loud`; padrão: só os de LOUD_SFX)
 * vão pelo caminho alto e calam a música desde agora até o fim deles.
 * Devolve a duração em segundos.
 */
export function playSfxOn(
  g: AudioGraph,
  name: SfxName,
  now: number,
  at: number,
  volume: number,
  loud: boolean = isLoudSfx(name),
): number {
  const duration = SFX[name](loud ? g.scareVoice : g.sfxVoice, at, volume)
  if (loud) g.hush.hold(now, at + duration)
  return duration
}

/** Cala a música agora por `seconds` (os sustos chamam no começo da cena). */
export function hushMusicOn(g: AudioGraph, now: number, seconds: number) {
  if (Number.isFinite(seconds) && seconds > 0) g.hush.hold(now, now + Math.min(10, seconds))
}
