import { describe, expect, it } from 'vitest'
import { FakeAudioContext, FakeCompressor, FakeGain, FakeNode, FakeParam, FakeShaper, FakeSource } from './fakeAudioContext'
import { applyVolumes, buildGraph, hushMusicOn, playSfxOn } from './graph'
import {
  CEILING_KNEE,
  LOUD_SETTINGS,
  LOUD_SFX,
  OUTPUT_CEILING,
  ceilingCurve,
  createMusicHush,
  isLoudSfx,
  scareVolumeGain,
} from './loud'
import { SFX } from './sfx'
import { makeNoiseBuffers } from './synth'
import type { Voice } from './synth'

function voiceOn(fake: FakeAudioContext) {
  const ctx = fake.asContext()
  const { noise, brown } = makeNoiseBuffers(ctx)
  const dry = fake.createGain()
  const wet = fake.createGain()
  const voice: Voice = { ctx, out: { dry: dry as unknown as AudioNode, wet: wet as unknown as AudioNode }, noise, brown }
  return { voice, dry, wet, baseline: fake.created.length }
}

function graphOn(fake: FakeAudioContext) {
  return buildGraph(fake.asContext())
}

/** Os parâmetros do "portão" da música (o que o susto leva a zero). */
function hushParams(fake: FakeAudioContext, g: ReturnType<typeof graphOn>) {
  const musicDry = g.musicDry as unknown as FakeGain
  const musicWet = g.musicWet as unknown as FakeGain
  const gates = [...musicDry.outputs, ...musicWet.outputs] as FakeGain[]
  expect(gates).toHaveLength(2)
  for (const gate of gates) {
    expect(gate).toBeInstanceOf(FakeGain)
    expect(fake.created.includes(gate)).toBe(true)
  }
  return gates.map((gate) => gate.gain)
}

function last(param: FakeParam) {
  return param.automation[param.automation.length - 1]
}

describe('sons dos sustos de verdade', () => {
  const expected: [string, number][] = [
    ['screech', 1.4],
    ['shriek', 1.6],
    ['flicker', 0.16],
  ]
  for (const [name, seconds] of expected) {
    it(`${name}: toca ${seconds} s no contexto falso e limpa tudo`, () => {
      const fake = new FakeAudioContext()
      const { voice, dry, baseline } = voiceOn(fake)
      const duration = SFX[name as keyof typeof SFX](voice, 0.2, 1)
      expect(duration).toBeCloseTo(seconds, 6)
      const created = fake.created.slice(baseline)
      const sources = created.filter((node): node is FakeSource => node instanceof FakeSource)
      expect(sources.length).toBeGreaterThan(0)
      for (const source of sources) expect(source.endTime()).toBeLessThanOrEqual(0.2 + duration + 0.1)
      expect(dry.receivedInput).toBe(true)
      fake.advance(30)
      expect(fake.active.size).toBe(0)
      expect(created.filter((node: FakeNode) => node.outputs.size > 0)).toHaveLength(0)
    })
  }

  it('só os efeitos exclusivos dos sustos vão sempre pelo caminho alto; grito e estática dos jogos não', () => {
    expect([...LOUD_SFX].sort()).toEqual(['jumpscare', 'screech', 'shriek', 'slam'])
    for (const name of ['screech', 'shriek', 'jumpscare'] as const) expect(isLoudSfx(name)).toBe(true)
    // Os jogos tocam 'scream'/'static' a cada rodada: no nível da v1, sem calar a música.
    for (const name of ['scream', 'static', 'boom', 'flicker', 'doot', 'heartbeat', 'whisper'] as const) {
      expect(isLoudSfx(name)).toBe(false)
    }
    for (const name of LOUD_SFX) expect(SFX[name]).toBeTypeOf('function')
  })

  it("'scream' de jogo vai pelo caminho normal; a cena de susto pede o alto com loud = true", () => {
    const fake = new FakeAudioContext()
    const g = graphOn(fake)
    const params = hushParams(fake, g)
    const scareInput = g.scareVoice.out.dry as unknown as FakeGain
    const sfxDry = g.sfxVoice.out.dry as unknown as FakeGain

    playSfxOn(g, 'scream', 1, 1.01, 1)
    playSfxOn(g, 'static', 1, 1.5, 1)
    expect(scareInput.receivedInput).toBe(false)
    expect(sfxDry.receivedInput).toBe(true)
    for (const param of params) expect(param.automation).toHaveLength(0)

    const duration = playSfxOn(g, 'scream', 5, 5.01, 1, true)
    expect(scareInput.receivedInput).toBe(true)
    expect(g.hush.until).toBeCloseTo(5.01 + duration, 6)
    fake.advance(30)
    expect(fake.active.size).toBe(0)
  })
})

describe('caminho de susto', () => {
  it('o teto segura o pico de amostra em −3 dBFS (true-peak ≤ −0,3 dBTP) e não mexe no som normal', () => {
    // −3 dBFS de pico de amostra: a folga que o true-peak (entre amostras) precisa.
    expect(20 * Math.log10(OUTPUT_CEILING)).toBeCloseTo(-3, 6)
    expect(CEILING_KNEE).toBeLessThan(OUTPUT_CEILING)
    const curve = ceilingCurve()
    const n = curve.length
    let max = 0
    for (let i = 0; i < n; i += 1) {
      max = Math.max(max, Math.abs(curve[i]))
      if (i > 0) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1])
      expect(curve[i]).toBeCloseTo(-curve[n - 1 - i], 6)
      const x = (i / (n - 1)) * 2 - 1
      if (Math.abs(x) <= CEILING_KNEE) expect(curve[i]).toBeCloseTo(x, 6)
    }
    expect(max).toBeLessThan(OUTPUT_CEILING)
    // Perto de ±1 a curva já é quase plana: prender a entrada em ±1 não vira corte seco.
    expect(curve[n - 1] - curve[n - 2]).toBeLessThan(0.02 * (2 / (n - 1)))
  })

  it('volume do susto: mudo e controle no zero calam; a partir de 0,15 o piso é 0,9; no meio, rampa', () => {
    expect(scareVolumeGain({ muted: true, volume: 1 })).toBe(0)
    expect(scareVolumeGain({ muted: false, volume: 0 })).toBe(0)
    expect(scareVolumeGain({ muted: false, volume: 0.01 })).toBe(0)
    expect(scareVolumeGain({ muted: false, volume: 0.02 })).toBe(0)
    expect(scareVolumeGain({ muted: false, volume: 0.1 })).toBeCloseTo(0.6, 6)
    expect(scareVolumeGain({ muted: false, volume: 0.15 })).toBeCloseTo(0.9, 6)
    expect(scareVolumeGain({ muted: false, volume: 0.3 })).toBeCloseTo(0.9, 6)
    expect(scareVolumeGain({ muted: false, volume: 0.95 })).toBeCloseTo(0.95, 6)
    expect(scareVolumeGain({ muted: false, volume: 1 })).toBeCloseTo(1, 6)
    expect(scareVolumeGain({ muted: false, volume: Number.NaN })).toBeCloseTo(1, 6)
    // Subir o controle nunca abaixa o susto.
    let previous = 0
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const gain = scareVolumeGain({ muted: false, volume: v })
      expect(gain).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = gain
    }
  })

  it('monta saturação → limitador próprio → volume → teto, ao lado do caminho normal', () => {
    const fake = new FakeAudioContext()
    const g = graphOn(fake)
    const master = g.master as unknown as FakeGain
    const scareVolume = g.scareVolume as unknown as FakeGain
    const [ceiling] = [...master.outputs] as FakeShaper[]
    expect(ceiling).toBeInstanceOf(FakeShaper)
    expect(ceiling.oversample).toBe('4x')
    expect(scareVolume.outputs.has(ceiling)).toBe(true)
    expect(ceiling.outputs.has(fake.destination)).toBe(true)
    expect(Math.max(...Array.from(ceiling.curve ?? [1]).map(Math.abs))).toBeLessThan(OUTPUT_CEILING)

    const limiter = fake.created.find(
      (node): node is FakeCompressor => node instanceof FakeCompressor && node.outputs.has(scareVolume),
    )
    expect(limiter).toBeDefined()
    expect(limiter?.threshold.value).toBe(LOUD_SETTINGS.threshold)
    expect(limiter?.ratio.value).toBeGreaterThanOrEqual(20)
    expect(limiter?.attack.value).toBeCloseTo(0.001, 6)
    const drive = fake.created.find(
      (node): node is FakeShaper => node instanceof FakeShaper && node !== ceiling && node.outputs.has(limiter as FakeNode),
    )
    expect(drive?.curve).toBeTruthy()
  })

  it('mudo zera os dois caminhos; volume baixo mantém o susto em 0,9', () => {
    const fake = new FakeAudioContext()
    const g = graphOn(fake)
    const master = (g.master as unknown as FakeGain).gain
    const scare = (g.scareVolume as unknown as FakeGain).gain
    applyVolumes(g, { muted: true, volume: 0.8 }, 1, true)
    expect(last(master)).toMatchObject({ kind: 'set', value: 0 })
    expect(last(scare)).toMatchObject({ kind: 'set', value: 0 })
    applyVolumes(g, { muted: false, volume: 0.3 }, 2)
    expect(last(master).value).toBeCloseTo(0.09, 6)
    expect(last(scare).value).toBeCloseTo(0.9, 6)
    // Slider no zero (sem mudo): a TV cala, inclusive os sustos.
    applyVolumes(g, { muted: false, volume: 0 }, 3)
    expect(last(master).value).toBe(0)
    expect(last(scare).value).toBe(0)
  })

  it('efeito de susto: entra pelo caminho alto e cala a música até ele acabar; depois ela volta', () => {
    const fake = new FakeAudioContext()
    const g = graphOn(fake)
    const params = hushParams(fake, g)
    const scareInput = g.scareVoice.out.dry as unknown as FakeGain
    const sfxDry = g.sfxVoice.out.dry as unknown as FakeGain

    // Efeito comum: música intacta.
    playSfxOn(g, 'boom', 1, 1.01, 1)
    for (const param of params) expect(param.automation).toHaveLength(0)
    expect(scareInput.receivedInput).toBe(false)

    const duration = playSfxOn(g, 'screech', 2, 2.5, 1)
    expect(scareInput.receivedInput).toBe(true)
    expect(sfxDry.receivedInput).toBe(true) // (do boom: o caminho normal segue funcionando)
    for (const param of params) {
      // Liga: vai a zero AGORA (não só quando o guincho começa)...
      expect(param.automation).toContainEqual(expect.objectContaining({ kind: 'target', time: 2, value: 0 }))
      // ...e desliga: volta para 1 quando o guincho termina.
      expect(last(param)).toMatchObject({ kind: 'target', value: 1 })
      expect(last(param).time).toBeCloseTo(2.5 + duration, 6)
    }
    expect(g.hush.until).toBeCloseTo(2.5 + duration, 6)
    fake.advance(30)
    expect(fake.active.size).toBe(0)
  })

  it('sustos encavalados esticam o silêncio; um pedido mais curto não mexe em nada', () => {
    const fake = new FakeAudioContext()
    const g = graphOn(fake)
    const params = hushParams(fake, g)
    hushMusicOn(g, 1, 2.4)
    expect(g.hush.until).toBeCloseTo(3.4, 6)
    const before = params.map((param) => param.automation.length)
    hushMusicOn(g, 2, 0.5)
    expect(params.map((param) => param.automation.length)).toEqual(before)
    playSfxOn(g, 'static', 3, 3.2, 1, true)
    expect(g.hush.until).toBeCloseTo(3.2 + 1.6, 6)
    for (const param of params) expect(last(param)).toMatchObject({ kind: 'target', value: 1, time: g.hush.until })
    // Pedido inválido não faz nada.
    hushMusicOn(g, 4, Number.NaN)
    hushMusicOn(g, 4, -1)
    expect(g.hush.until).toBeCloseTo(4.8, 6)
  })

  it('portão sozinho: vai a zero com rampa curta e volta devagar', () => {
    const param = new FakeParam(1)
    const hush = createMusicHush([param as unknown as AudioParam])
    hush.hold(5, 7)
    expect(param.automation.map((event) => [event.kind, event.time, event.value])).toEqual([
      ['set', 5, 1],
      ['target', 5, 0],
      ['target', 7, 1],
    ])
    hush.hold(6, 6.5)
    expect(param.automation).toHaveLength(3)
  })
})
