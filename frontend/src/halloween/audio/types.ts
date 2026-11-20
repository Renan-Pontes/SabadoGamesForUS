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
  // Natal (domínio público): Noite Feliz, Jingle Bells e We Wish You a Merry Christmas.
  'natal',
  'jingle',
  'wish',
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
  // Natal: guizo de trenó, brilho mágico e o "boing" cômico (festiveSfx.ts).
  'sleigh',
  'chime',
  'boing',
  // Efeitos de Natal da TV: o coral de duendes (Jingle Bells) e a rena a galope.
  'elfsong',
  'gallop',
  // Risadas de Natal (síntese de formantes): Papai Noel e duende.
  'hohoho',
  'giggle',
] as const

export type SfxName = (typeof SFX_NAMES)[number]

export function isMusicTrack(value: unknown): value is MusicTrack {
  return typeof value === 'string' && (MUSIC_TRACKS as readonly string[]).includes(value)
}

export function isSfxName(value: unknown): value is SfxName {
  return typeof value === 'string' && (SFX_NAMES as readonly string[]).includes(value)
}
