import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'portas-do-alem',
  name: 'Portas do Além',
  icon: '🚪',
  tagline: 'Escolha uma porta. Reze.',
  pitch: 'Sobreviva às portas — e, se virar fantasma, vingue-se dos vivos.',
  howTo: [
    'Escolha uma porta no celular, em segredo.',
    'O monstro está atrás de uma delas: quem estiver lá vira fantasma.',
    'Fantasmas votam onde o monstro ataca na rodada seguinte.',
    'Último vivo vence. Fantasma que mais acertar ganha prêmio.',
  ],
  duration: '4-8 min',
  vibe: 'Aposta',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#5b8def',
    light: '#bcd0ff',
    glow: 'rgba(91, 141, 239, 0.45)',
    contrast: '#050d22',
    sigil: '▯',
  },
  options: [],
  music: 'tension',
}
