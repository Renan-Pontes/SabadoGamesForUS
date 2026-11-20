import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'duas-verdades',
  name: 'Duas Verdades, Uma Mentira',
  icon: '🤞',
  tagline: 'Histórias de Natal ao pé da lareira. Uma delas é lorota.',
  pitch: 'Conte três coisas sobre você — duas verdadeiras e uma inventada — e descubra quem da mesa mente melhor que o Papai Noel.',
  howTo: [
    'No celular, escreva 3 frases sobre você: 2 verdades e 1 mentira.',
    'Na sua vez, a TV lê as suas frases para a mesa.',
    'Os outros conversam e votam: qual é a mentira?',
    'Acertou: +1. Quem escreveu ganha +1 por pessoa enganada.',
  ],
  duration: '10-20 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#ff8a3d',
    light: '#ffc79e',
    glow: 'rgba(255, 138, 61, 0.45)',
    contrast: '#2a1104',
    sigil: '✌',
  },
  options: [
    {
      key: 'turns',
      label: 'Quantos jogadores aparecem',
      help: 'Com muita gente, sorteie só alguns para a partida não ficar longa.',
      choices: [
        { value: 0, label: 'Todos' },
        { value: 6, label: '6' },
        { value: 10, label: '10' },
      ],
      default: 0,
    },
    {
      key: 'talkSeconds',
      label: 'Tempo de papo',
      help: 'Por vez: a mesa conversa e vota qual é a mentira.',
      choices: [
        { value: 30, label: '30 s' },
        { value: 45, label: '45 s' },
        { value: 60, label: '60 s' },
      ],
      default: 45,
    },
  ],
  music: 'natal',
  victoryMusic: 'wish',
}
