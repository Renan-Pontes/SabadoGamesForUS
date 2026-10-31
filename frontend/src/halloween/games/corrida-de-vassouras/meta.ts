import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'corrida-de-vassouras',
  name: 'Corrida de Vassouras',
  icon: '🧹',
  tagline: 'Aposte na bruxa certa. Amaldiçoe as outras.',
  pitch: 'Apostas, maldições e vassouras desgovernadas: quem junta mais doces?',
  howTo: [
    'Cinco bruxas apostam corrida na TV.',
    'A cada etapa, aposte em quem vai estar na frente.',
    'Jogue uma maldição numa rival: a mais amaldiçoada cai.',
    'Os dados decidem o resto. Mais doces no fim vence.',
  ],
  duration: '10-15 min',
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
