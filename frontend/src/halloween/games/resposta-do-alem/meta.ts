import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'resposta-do-alem',
  name: 'Resposta do Além',
  icon: '💬',
  tagline: 'Complete a frase. Faça a mesa gargalhar.',
  pitch: 'Respostas anônimas, votos sinceros e muita risada de outro mundo.',
  howTo: [
    'A TV mostra uma frase para completar.',
    'Escreva a resposta mais engraçada no celular.',
    'Vote na melhor — sem saber de quem é.',
    'Cada voto vale ponto. A mais votada leva bônus.',
  ],
  duration: '15-20 min',
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
