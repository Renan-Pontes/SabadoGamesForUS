import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'resposta-do-alem',
  name: 'Resposta do Além',
  icon: '💬',
  tagline: 'Complete a frase. Faça a mesa gargalhar.',
  pitch: 'Todo mundo completa a mesma frase e a mesa vota na mais engraçada — sem saber de quem é.',
  howTo: [
    'A TV mostra uma frase com uma lacuna.',
    'Complete no celular com a resposta mais engraçada.',
    'Vote na melhor — sem saber de quem é. Na sua não vale.',
    'Cada voto vale 1 ponto. A mais votada ganha +2.',
  ],
  duration: '10-15 min',
  vibe: 'Festa',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#f472b6',
    light: '#fbcfe8',
    glow: 'rgba(244, 114, 182, 0.45)',
    contrast: '#22061a',
    sigil: '❝',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Cada rodada é uma frase para completar.',
      choices: [
        { value: 3, label: '3' },
        { value: 5, label: '5' },
        { value: 7, label: '7' },
      ],
      default: 5,
    },
  ],
  music: 'party',
}
