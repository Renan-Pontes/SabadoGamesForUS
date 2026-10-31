import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'retrato-assombrado',
  name: 'Retrato Assombrado',
  icon: '🎨',
  tagline: 'Todo mundo desenha. Um não sabe o quê.',
  pitch: 'Desenhe a palavra sem entregar — e descubra quem está só copiando.',
  howTo: [
    'Todos veem a categoria; só quem não é impostor vê a palavra.',
    'Todo mundo desenha ao mesmo tempo no celular.',
    'No meio, a TV mostra os desenhos: chance de o impostor copiar.',
    'Votem no impostor. Pego, ele ainda pode chutar a palavra.',
  ],
  duration: '15-20 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#34d399',
    light: '#a7f3d0',
    glow: 'rgba(52, 211, 153, 0.42)',
    contrast: '#03150e',
    sigil: '✎',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
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
      help: 'De vez em quando, todo mundo (ou ninguém) é impostor.',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'party',
}
