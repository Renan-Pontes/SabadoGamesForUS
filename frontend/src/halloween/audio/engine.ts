import { speak } from '../../lib/narrator'
import { MUSIC_LEVEL, applyVolumes, buildGraph as buildAudioGraph, hushMusicOn, playSfxOn } from './graph'
import { isLoudSfx } from './loud'
import type { AudioGraph } from './graph'
import { createMusicStack } from './musicStack'
import type { StackId } from './musicStack'
import { getSoundState, setAudioSupported, setAudioUnlocked, subscribeSound } from './settings'
import { SFX } from './sfx'
import { startTrack } from './tracks'
import type { TrackPlayer } from './tracks'
import type { MusicTrack, SfxName } from './types'

/**
 * Motor de áudio: um AudioContext só para o app inteiro (o grafo está em
 * graph.ts).
 *
 *   trilhas ─► música ─► portão ─┐
 *   efeitos ─► efeitos ──────────┴─► reverb/compressor ─► volume ─────────┐
 *   sustos ──► saturação ─► limitador ─► volume do susto (mín. 0,9) ──────┴─► teto ─► caixas
 *
 * O compressor segura picos (grito em cima de explosão não estoura a TV); os
 * sustos de verdade vão por fora dele, bem mais altos, e calam a música
 * enquanto tocam. O teto garante pico ≤ −3 dBFS (true-peak ≤ −0,3 dBTP). O
 * mudo corta tudo, e o volume do app no zero também.
 */

type Graph = AudioGraph & { ctx: AudioContext }

/** O lobby que a TV toca sozinha (sem pedido de ninguém) vem mais baixinho. */
const QUIET_LEVEL = 0.55
/** Música abaixa enquanto a voz de terror fala. */
const DUCK_LEVEL = 0.35
const CROSSFADE = 1.4
const MAX_ACTIVE_SFX = 40
const PUMP_MS = 25

let graph: Graph | null = null
let players: TrackPlayer[] = []
let current: { player: TrackPlayer; track: MusicTrack; level: number } | null = null
let pumpTimer: number | null = null
let duckCount = 0
let sfxEnds: number[] = []
const lastSfxAt = new Map<SfxName, number>()

const musicStack = createMusicStack<MusicTrack>()

function audioConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const legacy = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return window.AudioContext ?? legacy ?? null
}

function buildGraph(ctx: AudioContext): Graph {
  return { ...buildAudioGraph(ctx), ctx }
}

function isRunning() {
  return graph?.ctx.state === 'running'
}

function onStateChange() {
  setAudioUnlocked(isRunning())
}

/**
 * Cria (ou acorda) o AudioContext. Precisa rodar dentro de um gesto do
 * usuário — a camada global chama no primeiro toque/tecla em qualquer lugar.
 */
export function unlockAudio(): void {
  const Ctor = audioConstructor()
  if (!Ctor) {
    setAudioSupported(false)
    return
  }
  if (!graph) {
    let ctx: AudioContext
    try {
      ctx = new Ctor()
    } catch {
      setAudioSupported(false)
      return
    }
    graph = buildGraph(ctx)
    ctx.addEventListener('statechange', onStateChange)
    // Celular: misturar com o Spotify de quem está tocando a festa, não interromper.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session && getSoundState().role === 'phone') {
      try {
        session.type = 'ambient'
      } catch {
        // Navegador sem suporte: segue o padrão.
      }
    }
    applyMaster(true)
  }
  const { ctx } = graph
  if (ctx.state !== 'running') {
    ctx.resume().then(onStateChange, () => undefined)
  }
  // iOS antigo: tocar um buffer mudo dentro do gesto destrava de vez.
  try {
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.addEventListener('ended', () => silent.disconnect(), { once: true })
    silent.start(0)
  } catch {
    // Sem problema: o resume acima costuma bastar.
  }
  onStateChange()
}

function applyMaster(immediate = false) {
  const g = graph
  if (!g) return
  applyVolumes(g, getSoundState(), g.ctx.currentTime, immediate)
}

function applyDuck() {
  const g = graph
  if (!g) return
  const now = g.ctx.currentTime
  const target = MUSIC_LEVEL * (duckCount > 0 ? DUCK_LEVEL : 1)
  for (const bus of [g.musicDry, g.musicWet]) {
    bus.gain.cancelScheduledValues(now)
    bus.gain.setTargetAtTime(target, now, duckCount > 0 ? 0.12 : 0.5)
  }
}

// ---------------------------------------------------------------------------
// Música
// ---------------------------------------------------------------------------

function desiredMusic(): { track: MusicTrack; level: number } | null {
  const s = getSoundState()
  // Música é coisa da TV: 15 celulares fora de sincronia seria o verdadeiro terror.
  if (s.role !== 'tv' || s.muted || !s.music || !s.unlocked) return null
  if (typeof document !== 'undefined' && document.hidden) return null
  const top = musicStack.top()
  if (top.requested) return top.track ? { track: top.track, level: 1 } : null
  return { track: 'lobby', level: QUIET_LEVEL }
}

function pump() {
  const g = graph
  if (!g) return
  const now = g.ctx.currentTime
  players = players.filter((player) => {
    if (now >= player.doneAt) {
      player.dispose()
      return false
    }
    player.tick(now)
    return true
  })
  if (players.length === 0 && pumpTimer !== null) {
    window.clearInterval(pumpTimer)
    pumpTimer = null
  }
}

function syncMusic() {
  const g = graph
  if (!g || !isRunning()) return
  const want = desiredMusic()
  const now = g.ctx.currentTime

  if (current && want && current.track === want.track) {
    if (current.level !== want.level) {
      current.player.setLevel(want.level, now, 1.2)
      current.level = want.level
    }
    return
  }

  if (current) {
    current.player.fadeOut(now, want ? CROSSFADE : 0.6)
    current = null
  }
  if (want) {
    // Troca rápida demais (A→B→C→D): solta as que ainda estão sumindo.
    while (players.length >= 3) players.shift()?.dispose()
    const player = startTrack(want.track, {
      ctx: g.ctx,
      dry: g.musicDry,
      wet: g.musicWet,
      noise: g.noise,
      brown: g.brown,
      at: now + 0.05,
      level: want.level,
      fadeIn: CROSSFADE,
    })
    players.push(player)
    current = { player, track: want.track, level: want.level }
  }
  if (players.length && pumpTimer === null) pumpTimer = window.setInterval(pump, PUMP_MS)
  pump()
}

/** Pedido de trilha (usado pelo hook `useMusic`). */
export function requestMusic(id: StackId, track: MusicTrack | null) {
  musicStack.set(id, track)
}

export function releaseMusic(id: StackId) {
  musicStack.remove(id)
}

/** Trilha tocando agora (null = silêncio). */
export function currentTrack(): MusicTrack | null {
  return current?.track ?? null
}

// ---------------------------------------------------------------------------
// Efeitos e voz
// ---------------------------------------------------------------------------

export type SfxOptions = {
  /** Multiplicador de volume (1 = normal, até 2). */
  volume?: number
  /** Atraso em segundos, agendado no relógio de áudio (preciso, ao contrário do setTimeout). */
  delay?: number
  /**
   * Força o caminho alto dos sustos (bem mais alto, cala a música enquanto
   * soa). Sem isso, só 'screech', 'shriek' e 'jumpscare' vão por ele. Só as
   * cenas de susto usam; nos jogos, deixe sem.
   */
  loud?: boolean
}

/**
 * Toca um efeito. Devolve a duração em segundos, ou 0 se não tocou (mudo,
 * áudio ainda bloqueado ou rajada repetida do mesmo efeito).
 */
export function playSfx(name: SfxName, options: SfxOptions = {}): number {
  const s = getSoundState()
  const g = graph
  if (s.muted || !g || !isRunning()) return 0
  const fn = SFX[name]
  if (!fn) return 0
  const volume = Math.min(2, Math.max(0, options.volume ?? 1))
  if (volume <= 0) return 0
  const now = g.ctx.currentTime
  const at = now + 0.012 + Math.min(10, Math.max(0, options.delay ?? 0))

  // Mesmo efeito disparado em rajada (re-render, dois cliques): toca uma vez só.
  const last = lastSfxAt.get(name)
  if (last !== undefined && Math.abs(at - last) < 0.035) return 0
  sfxEnds = sfxEnds.filter((end) => end > now)
  if (sfxEnds.length >= MAX_ACTIVE_SFX) return 0
  lastSfxAt.set(name, at)

  try {
    // Os de susto ('screech', 'shriek', 'jumpscare', ou qualquer um com `loud: true`) vão pelo caminho alto.
    const duration = playSfxOn(g, name, now, at, volume, options.loud ?? isLoudSfx(name))
    sfxEnds.push(at + duration)
    return duration
  } catch (error) {
    console.warn(`[halloween] efeito ${name} falhou`, error)
    return 0
  }
}

/**
 * Cala a música agora, por `seconds` (até 10 s), e depois ela volta devagar.
 * Os sustos chamam no começo da cena: o silêncio antes do grito assusta junto.
 */
export function hushMusic(seconds: number): void {
  const g = graph
  if (!g || !isRunning()) return
  hushMusicOn(g, g.ctx.currentTime, seconds)
}

export type SpookyVoiceOptions = { pitch?: number; rate?: number }

/**
 * Narração com voz grave e lenta (Web Speech API). A música abaixa enquanto
 * fala. Devolve a função que cancela.
 */
export function speakSpooky(text: string, options: SpookyVoiceOptions = {}): () => void {
  const s = getSoundState()
  if (s.muted || !text.trim()) return () => undefined
  // Chrome só deixa falar depois de algum gesto na página.
  if (!s.unlocked && !hasUserActivation()) return () => undefined

  let released = false
  const release = () => {
    if (released) return
    released = true
    window.clearTimeout(safety)
    duckCount = Math.max(0, duckCount - 1)
    applyDuck()
  }
  duckCount += 1
  applyDuck()
  // Se a voz nunca avisar que terminou, a música volta sozinha.
  const safety = window.setTimeout(release, Math.min(20000, 3000 + text.length * 120))
  const cancel = speak(text, {
    pitch: options.pitch ?? 0.45,
    rate: options.rate ?? 0.8,
    onEnd: release,
    onStop: release,
    onError: release,
  })
  return () => {
    cancel()
    release()
  }
}

// ---------------------------------------------------------------------------
// Ligação com o resto do app
// ---------------------------------------------------------------------------

let initialized = false

function hasUserActivation() {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation
  // Navegador sem a API: tenta mesmo assim (no pior caso o contexto nasce suspenso).
  return activation ? activation.hasBeenActive : true
}

function onSoundChange() {
  const s = getSoundState()
  // Ligou o som (botão de som, TV que acabou de abrir): destrava se já houve gesto.
  if (!s.muted && s.supported && !isRunning() && hasUserActivation()) unlockAudio()
  applyMaster()
  syncMusic()
}

function onGesture() {
  // Celular mudo nem cria AudioContext (no iPhone isso poderia pausar a música de outro app).
  if (getSoundState().muted || isRunning()) return
  unlockAudio()
}

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const

function onVisibility() {
  syncMusic()
}

/**
 * Liga o áudio ao app: destrava no primeiro gesto, reage a mudo/volume/papel
 * e à aba escondida. Idempotente; devolve a função que desliga.
 */
export function initAudio(): () => void {
  if (initialized || typeof window === 'undefined') return () => undefined
  initialized = true
  for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  const unsubscribeSound = subscribeSound(onSoundChange)
  const unsubscribeStack = musicStack.subscribe(syncMusic)

  // TV: tenta tocar sem clique (o Chrome deixa em sites que a pessoa já usa com som).
  const s = getSoundState()
  if (s.role === 'tv' && !s.muted && s.supported) unlockAudio()
  else if (!s.muted && hasUserActivation()) unlockAudio()

  return () => {
    initialized = false
    for (const type of GESTURES) window.removeEventListener(type, onGesture, { capture: true })
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribeSound()
    unsubscribeStack()
  }
}
