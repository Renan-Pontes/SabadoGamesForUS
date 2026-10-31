import { useEffect, useId, useSyncExternalStore } from 'react'
import { releaseMusic, requestMusic } from './engine'
import { getSoundState, setMuted, subscribeSound } from './settings'
import type { SoundState } from './settings'
import type { MusicTrack } from './types'

/**
 * Som da Noite do Terror — a API que os jogos usam.
 *
 *   useMusic('tension')                 // trilha enquanto o componente estiver montado
 *   playSfx('scream')                   // efeito na hora (devolve a duração em s)
 *   playSfx('clang', { delay: 0.4 })    // agendado no relógio de áudio
 *   speakSpooky('Alguém morreu esta noite...')
 *
 * Tudo é sintetizado na hora (Web Audio). Na TV o som nasce ligado; nos
 * celulares, mudo (dá para ligar no botão flutuante). Música só toca na TV.
 */

export type { MusicTrack, SfxName } from './types'
export { MUSIC_TRACKS, SFX_NAMES, isMusicTrack, isSfxName } from './types'
export { playSfx, speakSpooky, unlockAudio, initAudio, currentTrack } from './engine'
export type { SfxOptions, SpookyVoiceOptions } from './engine'
export {
  SOUND_DEFAULTS,
  getSoundState,
  setMuted,
  setMusicEnabled,
  setRandomScaresEnabled,
  setSoundRole,
  setVolume,
  subscribeSound,
} from './settings'
export type { SoundRole, SoundSettings, SoundState } from './settings'

/**
 * Pede uma trilha enquanto o componente estiver montado (só toca na TV).
 *
 * Vale o pedido mais recente; ao desmontar, volta o anterior. `null` pede
 * silêncio. Se a moldura e o jogo pedem juntos, vence o jogo (o filho).
 * Sem pedido nenhum, a TV toca o 'lobby' baixinho.
 */
export function useMusic(track: MusicTrack | null): void {
  const id = useId()
  useEffect(() => {
    requestMusic(id, track)
  }, [id, track])
  useEffect(() => () => releaseMusic(id), [id])
}

/** Estado do som (mudo, volume, destravado...) que re-renderiza quando muda. */
export function useSoundState(): SoundState {
  return useSyncExternalStore(subscribeSound, getSoundState, getSoundState)
}

/** Liga/desliga o som deste aparelho. Chame dentro de um clique (destrava o áudio). */
export function toggleMuted() {
  setMuted(!getSoundState().muted)
}
