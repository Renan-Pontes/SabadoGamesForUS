import type { GameAccent } from '../theme'
import { CREEPY_FONT, FESTIVE_ROUND_FONT, XMAS_COLORS } from '../../halloween/ui/fonts'

/**
 * Visual de Natal do Read My Mind ("Mente Natalina"): mesa de feltro verde
 * com borda de madeira nevada, cartas de cartão de Natal e vidas que são
 * bolas da árvore. Só constantes — os componentes ficam nos .tsx.
 */

/** Nome que aparece nas telas (o do catálogo vem do backend). */
export const GAME_TITLE = 'Mente Natalina'

/** Fonte dos números das cartas: redonda, grossa, lê bem a 3 m. */
export const NUMBER_FONT = FESTIVE_ROUND_FONT

/** Fonte de cartão de Natal para títulos curtos. */
export const TITLE_FONT = CREEPY_FONT

export const XMAS = {
  ...XMAS_COLORS,
  cream: '#fffaf0',
  creamShade: '#f3e7cf',
  ink: '#9e1424',
  inkGreen: '#0f5c33',
  holly: '#1f8a4c',
  berry: '#d6202f',
  wood: '#6b3f22',
  woodDark: '#3f2312',
  woodLight: '#8a5530',
  felt: '#17834a',
  feltDark: '#0a4a28',
  goldLight: '#ffd975',
} as const

/** Acento para o GameShell (host/celular): dourado de estrela com vermelho-bala. */
export const XMAS_ACCENT: GameAccent = {
  main: XMAS.gold,
  light: XMAS.candy,
  glow: 'rgba(245, 194, 66, 0.42)',
  contrast: '#1a1204',
  sigil: '🎄',
}

/** Cores das bolas de vida, na ordem em que aparecem. */
export const ORNAMENT_COLORS = [XMAS.red, XMAS.gold, XMAS.pine, XMAS.ice, XMAS.candy] as const

/** O que tem atrás de cada porta do calendário do Advento (níveis 1–10). */
export const ADVENT_TREATS = ['🍪', '🧦', '🔔', '🦌', '⛄', '🍭', '🕯️', '🎁', '⭐', '🎄'] as const
