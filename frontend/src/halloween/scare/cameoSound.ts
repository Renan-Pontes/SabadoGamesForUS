import { playSfx } from '../audio'
import { CAMEO_INFO } from './cameos'
import type { Cameo } from './cameos'

/** Toca o som baixinho da visita (o plano, com volume ≤ 0,5, está em CAMEO_INFO). */
export function playCameoSound(kind: Cameo) {
  for (const sound of CAMEO_INFO[kind].sounds) playSfx(sound.sfx, { delay: sound.delay, volume: sound.volume })
}
