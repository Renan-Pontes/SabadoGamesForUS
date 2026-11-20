import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'espiao-assombrado',
  name: 'Espião de Natal',
  icon: '🕵️',
  tagline: 'Todo mundo sabe onde é a festa. Menos o espião.',
  pitch: 'Da ceia da vó ao amigo secreto da firma: pergunte, desconfie e desmascare o penetra antes que ele descubra o lugar — e cuidado com as rodadas malucas.',
  howTo: [
    'Todo mundo recebe o lugar no celular — menos o espião.',
    'Façam perguntas uns aos outros sem entregar o lugar.',
    'Desconfiou? Acuse alguém: a maioria decide.',
    'O espião pode chutar o lugar a qualquer hora. Acertou, ganhou.',
    'Acabou o tempo? Todo mundo vota em quem é o espião.',
  ],
  duration: '30-45 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#ffc83d',
    light: '#ffe8a3',
    glow: 'rgba(255, 200, 61, 0.45)',
    contrast: '#2a1a00',
    sigil: '★',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Cada rodada tem um lugar novo.',
      choices: [
        { value: 3, label: '3' },
        { value: 5, label: '5' },
        { value: 7, label: '7' },
      ],
      default: 5,
    },
    {
      key: 'talkMinutes',
      label: 'Tempo de conversa',
      help: 'Por rodada, antes da votação final. Acusação pausa o relógio.',
      choices: [
        { value: 5, label: '5 min' },
        { value: 7, label: '7 min' },
        { value: 9, label: '9 min' },
      ],
      default: 7,
    },
    {
      key: 'chaos',
      label: 'Rodadas malucas',
      help: 'De vez em quando, todo mundo (ou ninguém) é espião — e ninguém percebe até o fim.',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'jingle',
  victoryMusic: 'wish',
}
