/**
 * PLACEHOLDER — a implementação de verdade (sintetizador Web Audio, trilhas
 * e efeitos) é escrita na Etapa 1 do plano (HALLOWEEN.md). Os nomes e
 * assinaturas abaixo são o contrato: podem ganhar parâmetros opcionais e
 * novos nomes, mas não mudar.
 */

export type MusicTrack =
  | 'lobby'
  | 'tension'
  | 'night'
  | 'day'
  | 'party'
  | 'race'
  | 'quiz'
  | 'chase'
  | 'victory'

export type SfxName =
  | 'scream'
  | 'thunder'
  | 'creak'
  | 'door'
  | 'heartbeat'
  | 'bell'
  | 'ghost'
  | 'doot'
  | 'boom'
  | 'clang'
  | 'tick'
  | 'explosion'
  | 'win'
  | 'fail'
  | 'reveal'
  | 'whoosh'
  | 'pop'
  | 'laugh'
  | 'organ'
  | 'drumroll'
  | 'buzzer'
  | 'ding'
  | 'fuse'
  | 'monster'
  | 'gong'

/** Pede uma trilha enquanto o componente estiver montado (só toca na TV, por padrão). */
export function useMusic(track: MusicTrack | null): void {
  void track
}

/** Toca um efeito. Não faz nada se o som estiver mudo ou ainda bloqueado pelo navegador. */
export function playSfx(name: SfxName, options?: { volume?: number }): void {
  void name
  void options
}

/** Narração com voz grave de filme de terror (Web Speech API). */
export function speakSpooky(text: string, options?: { pitch?: number; rate?: number }): void {
  void text
  void options
}
