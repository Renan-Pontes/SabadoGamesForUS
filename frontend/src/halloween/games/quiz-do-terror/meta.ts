import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'quiz-do-terror',
  name: 'Quiz do Terror',
  icon: '🧠',
  tagline: 'Quanto você sabe de terror?',
  pitch: 'Filmes, monstros, folclore e Halloween: acerte rápido e suba no pódio.',
  howTo: [
    'A TV faz uma pergunta de terror com quatro alternativas.',
    'Responda no celular: cada cor é uma alternativa.',
    'Acertou rápido, mais pontos. Acertos seguidos dão bônus.',
    'No fim, pódio de quem mais sabe de terror.',
  ],
  duration: '8-12 min',
  vibe: 'Festa',
  minPlayers: 1,
  maxPlayers: 15,
  accent: {
    main: '#22d3ee',
    light: '#a5f3fc',
    glow: 'rgba(34, 211, 238, 0.42)',
    contrast: '#04141a',
    sigil: '?',
  },
  options: [
    {
      key: 'questions',
      label: 'Perguntas',
      choices: [
        { value: 8, label: '8' },
        { value: 10, label: '10' },
        { value: 15, label: '15' },
      ],
      default: 10,
    },
    {
      key: 'seconds',
      label: 'Tempo por pergunta',
      choices: [
        { value: 15, label: '15 s' },
        { value: 20, label: '20 s' },
      ],
      default: 20,
    },
  ],
  music: 'quiz',
}
