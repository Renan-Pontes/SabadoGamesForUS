import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'mentira-macabra',
  name: 'Mentira Macabra',
  icon: '🤥',
  tagline: 'Um fato bizarro. Só uma resposta é verdade.',
  pitch: 'Invente a mentira mais convincente e fareje a verdade no meio da bagunça.',
  howTo: [
    'A TV mostra um fato verdadeiro e bizarro com uma lacuna.',
    'No celular, invente uma mentira convincente para completar.',
    'Depois, ache a verdade no meio das mentiras da galera.',
    'Achou a verdade: +2. Cada um que cair na sua mentira: +1.',
    'A última rodada vale o dobro!',
  ],
  duration: '8-15 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#ffc94a',
    light: '#ffe7a8',
    glow: 'rgba(255, 201, 74, 0.42)',
    contrast: '#1f1603',
    sigil: '¿',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'A última vale o dobro.',
      choices: [
        { value: 4, label: '4' },
        { value: 6, label: '6' },
        { value: 8, label: '8' },
      ],
      default: 6,
    },
  ],
  music: 'quiz',
}
