/**
 * Nomes do contrato de som (HALLOWEEN.md). Podem ganhar nomes novos, mas os
 * que já existem não mudam: os jogos dependem deles.
 */

export const MUSIC_TRACKS = [
  'lobby',
  'tension',
  'night',
  'day',
  'party',
  'race',
  'quiz',
  'chase',
  'victory',
] as const

export type MusicTrack = (typeof MUSIC_TRACKS)[number]

export const SFX_NAMES = [
  'scream',
  'thunder',
  'creak',
  'door',
  'heartbeat',
  'bell',
  'ghost',
  'doot',
  'boom',
  'clang',
  'tick',
  'explosion',
  'win',
  'fail',
  'reveal',
  'whoosh',
  'pop',
  'laugh',
  'organ',
  'drumroll',
  'buzzer',
  'ding',
  'fuse',
  'monster',
  'gong',
  // Extras (usados pelos sustos, liberados para os jogos também)
  'bones',
  'hiss',
  'static',
  'whisper',
  'jumpscare',
  // Sustos de verdade: tocam pelo caminho alto do motor (loud.ts), como 'jumpscare'.
  'screech',
  'shriek',
  'flicker',
] as const

export type SfxName = (typeof SFX_NAMES)[number]

export function isMusicTrack(value: unknown): value is MusicTrack {
  return typeof value === 'string' && (MUSIC_TRACKS as readonly string[]).includes(value)
}

export function isSfxName(value: unknown): value is SfxName {
  return typeof value === 'string' && (SFX_NAMES as readonly string[]).includes(value)
}
