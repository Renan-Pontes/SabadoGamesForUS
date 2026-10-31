import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'portas-do-alem',
  name: 'Portas do Além',
  icon: '🚪',
  tagline: 'Escolha uma porta. Reze.',
  pitch: 'Sobreviva às portas — e, se virar fantasma, vingue-se dos vivos.',
  howTo: [
    'Escolha uma porta em segredo.',
    'O monstro está atrás de uma delas.',
    'Quem escolheu a porta do monstro vira fantasma.',
    'Fantasmas decidem onde o monstro ataca. Último vivo vence.',
  ],
  duration: '5-10 min',
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
