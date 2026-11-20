import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'retrato-assombrado',
  name: 'Retrato de Natal',
  icon: '🎅',
  tagline: 'Todo mundo desenha o Natal. Um não faz ideia do quê.',
  pitch: 'Rabisque a palavra natalina sem entregar — e descubra o duende que está só copiando.',
  howTo: [
    'Todos veem a categoria; só o impostor fica sem a palavra.',
    'Todo mundo desenha junto no celular, em duas etapas.',
    'No meio, a TV mostra os desenhos: o impostor aproveita para copiar.',
    'Votem no impostor na exposição de Natal.',
    'Escapou, ganha 2 pontos; pego, ainda pode chutar a palavra.',
  ],
  duration: '10-15 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#3ee07f',
    light: '#b6f7cf',
    glow: 'rgba(62, 224, 127, 0.45)',
    contrast: '#03190b',
    sigil: '✎',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Cada rodada: palavra secreta, desenho em duas etapas e votação (~3 min).',
      choices: [
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
      ],
      default: 4,
    },
    {
      key: 'chaos',
      label: 'Rodadas malucas',
      help: 'De vez em quando, todo mundo (ou ninguém) é impostor. Milagre de Natal!',
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
