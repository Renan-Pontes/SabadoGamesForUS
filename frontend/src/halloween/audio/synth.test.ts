import { describe, expect, it } from 'vitest'
import { FakeAudioContext, FakeNode, FakeSource } from './fakeAudioContext'
import { freq, midi } from './notes'
import { SFX } from './sfx'
import { makeImpulse, makeNoiseBuffers } from './synth'
import type { Voice } from './synth'
import { TRACKS, startTrack } from './tracks'
import { MUSIC_TRACKS, SFX_NAMES } from './types'

function setup() {
  const fake = new FakeAudioContext()
  const ctx = fake.asContext()
  const { noise, brown } = makeNoiseBuffers(ctx)
  const dry = fake.createGain()
  const wet = fake.createGain()
  const voice: Voice = {
    ctx,
    out: { dry: dry as unknown as AudioNode, wet: wet as unknown as AudioNode },
    noise,
    brown,
  }
  return { fake, ctx, voice, dry, wet, noise, brown, baseline: fake.created.length }
}

function leftovers(nodes: FakeNode[]) {
  return nodes.filter((node) => node.outputs.size > 0)
}

describe('notas', () => {
  it('converte nomes em frequências', () => {
    expect(midi('A4')).toBe(69)
    expect(midi('C4')).toBe(60)
    expect(midi('C#5')).toBe(73)
    expect(midi('Bb3')).toBe(58)
    expect(freq('A4')).toBeCloseTo(440, 6)
    expect(freq('A3')).toBeCloseTo(220, 6)
    expect(() => midi('H2')).toThrow()
  })
})

describe('buffers do motor', () => {
  it('gera ruído e impulso de reverb sem NaN', () => {
    const { ctx } = setup()
    const { noise, brown } = makeNoiseBuffers(ctx)
    const impulse = makeImpulse(ctx)
    for (const buffer of [noise, brown, impulse]) {
      const data = buffer.getChannelData(0)
      expect(data.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true)
      expect(data.some((sample) => sample !== 0)).toBe(true)
    }
    expect(impulse.numberOfChannels).toBe(2)
  })
})

describe('efeitos sonoros', () => {
  for (const name of SFX_NAMES) {
    it(`${name}: toca, chega na saída e desliga todos os nós`, () => {
      const { fake, voice, dry, wet, baseline } = setup()
      const duration = SFX[name](voice, 0.05, 1)
      expect(Number.isFinite(duration)).toBe(true)
      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThanOrEqual(5)

      const created = fake.created.slice(baseline)
      const sources = created.filter((node): node is FakeSource => node instanceof FakeSource)
      expect(sources.length).toBeGreaterThan(0)
      for (const source of sources) {
        expect(source.startedAt).not.toBeNull()
        // Toda fonte tem fim marcado: nenhum oscilador fica tocando para sempre.
        expect(Number.isFinite(source.endTime())).toBe(true)
        expect(source.endTime()).toBeLessThanOrEqual(0.05 + duration + 0.5)
      }
      expect(dry.receivedInput || wet.receivedInput).toBe(true)

      fake.advance(60)
      expect(leftovers(created)).toHaveLength(0)
      expect(fake.active.size).toBe(0)
    })
  }

  it('volume baixíssimo não quebra as rampas exponenciais', () => {
    for (const name of SFX_NAMES) {
      const { fake, voice, baseline } = setup()
      expect(() => SFX[name](voice, 0.05, 0.01)).not.toThrow()
      fake.advance(60)
      expect(leftovers(fake.created.slice(baseline))).toHaveLength(0)
    }
  })
})

describe('trilhas', () => {
  for (const name of MUSIC_TRACKS) {
    it(`${name}: toca 75 s, faz fade e não deixa nó pendurado`, () => {
      const { fake, ctx, dry, wet, noise, brown, baseline } = setup()
      const player = startTrack(name, {
        ctx,
        dry: dry as unknown as AudioNode,
        wet: wet as unknown as AudioNode,
        noise,
        brown,
        at: 0.1,
        level: 1,
        fadeIn: 1.4,
      })
      let now = 0
      const tickUntil = (end: number) => {
        while (now < end) {
          now += 0.025
          fake.advance(now)
          player.tick(now)
        }
      }

      tickUntil(2)
      const firstSeconds = fake.created.slice(baseline).filter((node) => node instanceof FakeSource)
      // Começa a tocar logo (nada de 10 s de silêncio na troca de trilha).
      expect(firstSeconds.length).toBeGreaterThan(0)

      tickUntil(75)
      const created = fake.created.length - baseline
      // Nem silêncio, nem metralhadora de nós.
      expect(created).toBeGreaterThan(50)
      expect(created / 75).toBeLessThan(400)
      // O que já tocou foi limpo (só sobra o que está soando agora).
      expect(fake.active.size).toBeLessThan(120)

      player.fadeOut(now, 1.4)
      expect(Number.isFinite(player.doneAt)).toBe(true)
      tickUntil(player.doneAt + 0.1)
      player.dispose()
      fake.advance(now + 120)
      expect(fake.active.size).toBe(0)
      expect(leftovers(fake.created.slice(baseline))).toHaveLength(0)
    })
  }

  it('crossfade: trocar a trilha várias vezes não acumula nós', () => {
    const { fake, ctx, dry, wet, noise, brown, baseline } = setup()
    let now = 0
    const players = MUSIC_TRACKS.map((name, index) => {
      const player = startTrack(name, {
        ctx,
        dry: dry as unknown as AudioNode,
        wet: wet as unknown as AudioNode,
        noise,
        brown,
        at: index * 3,
        level: 0.55,
        fadeIn: 1.4,
      })
      return player
    })
    players.forEach((player, index) => {
      while (now < index * 3 + 3) {
        now += 0.025
        fake.advance(now)
        for (const p of players) p.tick(now)
      }
      player.setLevel(1, now, 1)
      player.fadeOut(now, 1.4)
    })
    while (now < 60) {
      now += 0.025
      fake.advance(now)
      for (const p of players) p.tick(now)
    }
    for (const player of players) player.dispose()
    fake.advance(now + 120)
    expect(fake.active.size).toBe(0)
    expect(leftovers(fake.created.slice(baseline))).toHaveLength(0)
  })

  it('todas as trilhas têm andamento e laço válidos', () => {
    for (const name of MUSIC_TRACKS) {
      const def = TRACKS[name]
      expect(def.bpm).toBeGreaterThan(30)
      expect(def.loopSteps).toBeGreaterThan(0)
      const seconds = ((def.loopSteps / def.stepsPerBeat) * 60) / def.bpm
      // Laços entre ~10 s e ~70 s: curtos cansam, longos demais pesam na memória.
      expect(seconds).toBeGreaterThan(10)
      expect(seconds).toBeLessThan(70)
    }
  })
})
