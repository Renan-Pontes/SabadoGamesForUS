import { isTvLocation } from '../fx/route'

/**
 * Preferências de som do aparelho.
 *
 * A TV nasce com som (é ela que assusta a sala); o celular nasce mudo — 15
 * celulares tocando a mesma coisa fora de sincronia seria um pesadelo de
 * verdade. Cada papel guarda a própria preferência: o notebook que é TV numa
 * aba e host na outra não mistura as duas.
 */

export type SoundRole = 'tv' | 'phone'

export type SoundSettings = {
  muted: boolean
  /** Volume geral, de 0 a 1. */
  volume: number
  /** Música ligada (o host pode desligar pela sala). */
  music: boolean
  /** Sustos aleatórios de tempos em tempos (só na TV). */
  randomScares: boolean
}

export type SoundState = SoundSettings & {
  role: SoundRole
  /** O navegador já liberou o áudio (AudioContext rodando). */
  unlocked: boolean
  /** Este navegador tem Web Audio. */
  supported: boolean
}

export const SOUND_DEFAULTS: Record<SoundRole, SoundSettings> = {
  tv: { muted: false, volume: 0.8, music: true, randomScares: true },
  phone: { muted: true, volume: 0.8, music: true, randomScares: false },
}

const STORAGE_PREFIX = 'sabado_hw_sound_'

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function loadSettings(role: SoundRole): SoundSettings {
  const base = SOUND_DEFAULTS[role]
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + role)
    if (!raw) return { ...base }
    const parsed = JSON.parse(raw) as Partial<Record<keyof SoundSettings, unknown>>
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : base.muted,
      volume:
        typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
          ? clamp01(parsed.volume)
          : base.volume,
      music: typeof parsed.music === 'boolean' ? parsed.music : base.music,
      randomScares:
        typeof parsed.randomScares === 'boolean' ? parsed.randomScares : base.randomScares,
    }
  } catch {
    // Sem localStorage (modo privado, teste em Node): fica no padrão.
    return { ...base }
  }
}

function saveSettings(state: SoundState) {
  try {
    const { muted, volume, music, randomScares } = state
    window.localStorage.setItem(
      STORAGE_PREFIX + state.role,
      JSON.stringify({ muted, volume, music, randomScares }),
    )
  } catch {
    // Sem onde guardar: a preferência vale só até recarregar.
  }
}

function detectRole(): SoundRole {
  if (typeof window === 'undefined') return 'phone'
  return isTvLocation(window.location.pathname, window.location.search) ? 'tv' : 'phone'
}

function detectSupport(): boolean {
  if (typeof window === 'undefined') return false
  const legacy = (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
  return typeof window.AudioContext === 'function' || typeof legacy === 'function'
}

function initialState(): SoundState {
  const role = detectRole()
  return { ...loadSettings(role), role, unlocked: false, supported: detectSupport() }
}

let state: SoundState = initialState()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of [...listeners]) listener()
}

function update(patch: Partial<SoundState>, persist: boolean) {
  const next = { ...state, ...patch }
  const keys = Object.keys(patch) as (keyof SoundState)[]
  if (keys.every((key) => next[key] === state[key])) return
  state = next
  if (persist) saveSettings(state)
  emit()
}

/** Estado atual (objeto imutável: muda de identidade a cada alteração). */
export function getSoundState(): SoundState {
  return state
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Troca entre TV e celular (a camada global chama a cada navegação). */
export function setSoundRole(role: SoundRole) {
  if (role === state.role) return
  state = { ...state, ...loadSettings(role), role }
  emit()
}

export function setMuted(muted: boolean) {
  update({ muted }, true)
}

export function setVolume(volume: number) {
  if (!Number.isFinite(volume)) return
  update({ volume: clamp01(volume) }, true)
}

export function setMusicEnabled(music: boolean) {
  update({ music }, true)
}

export function setRandomScaresEnabled(randomScares: boolean) {
  update({ randomScares }, true)
}

/** Uso interno do motor de áudio. */
export function setAudioUnlocked(unlocked: boolean) {
  update({ unlocked }, false)
}

/** Uso interno do motor de áudio. */
export function setAudioSupported(supported: boolean) {
  update({ supported }, false)
}
