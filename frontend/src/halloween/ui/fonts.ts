/**
 * Fontes e cores da Noite do Terror. Importar este módulo carrega as fontes
 * (a camada global já importa; os jogos só precisam das constantes).
 */
import '@fontsource/creepster'
import '@fontsource/nosifer'
import './spooky.css'

/** Letra de filme B de terror — títulos e chamadas. */
export const CREEPY_FONT = "'Creepster', 'Bebas Neue', cursive"

/** Letra "sangrando" — use pouco (só palavras curtas: SUSTO, MORREU). */
export const BLOODY_FONT = "'Nosifer', 'Creepster', cursive"

/** Paleta de Halloween usada pelo kit (funciona sobre fundo escuro). */
export const SPOOKY_COLORS = {
  pumpkin: '#ff7b1c', // = var(--pumpkin)
  pumpkinDeep: '#c2410c',
  candle: '#ffc94a', // = var(--status-waiting)
  blood: '#e0213a', // = var(--blood)
  bone: '#f5f0e1',
  ghost: '#e0f2fe',
  toxic: '#84cc16',
  witch: '#a855f7',
  night: '#0b0614',
  moon: '#fef3c7',
} as const
