import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'corrida-de-vassouras',
  name: 'Corrida de Vassouras',
  icon: '🧹',
  tagline: 'Aposte na bruxa certa. Amaldiçoe as outras.',
  pitch: 'Apostas, maldições e vassouras desgovernadas: grite para a TV e junte mais doces.',
  howTo: [
    'Cinco bruxas apostam corrida na TV; os dados decidem quem voa.',
    'Toda etapa, aposte em quem fica na frente: 1º paga 3 🍬, 2º paga 1.',
    'Jogue uma maldição: a mais amaldiçoada (2+) cai e volta 2 casas.',
    'Na 1ª etapa, aposte também na campeã da corrida: +5 🍬.',
    'Quem tiver mais doces quando uma bruxa cruzar a chegada vence.',
  ],
  duration: '6-9 min',
  vibe: 'Corrida',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#d946ef',
    light: '#f5d0fe',
    glow: 'rgba(217, 70, 239, 0.45)',
    contrast: '#1d0420',
    sigil: '≋',
  },
  options: [],
  music: 'race',
}
