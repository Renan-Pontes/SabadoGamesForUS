import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'quem-morre-primeiro',
  name: 'Quem Morre Primeiro?',
  icon: '⚰️',
  tagline: 'Num filme de terror, quem da galera não sobrevive?',
  pitch: 'Vote em quem cairia em cada clichê de terror — e acerte o que a galera pensa.',
  howTo: [
    'A TV pergunta: quem da galera faria isso num filme de terror?',
    'Todo mundo vota em alguém no celular — vale até em você.',
    'O mais votado ganha uma lápide com epitáfio.',
    'Votou com a maioria? Ponto para você.',
  ],
  duration: '8-12 min',
  vibe: 'Festa',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#8cf045',
    light: '#d4ffb0',
    glow: 'rgba(140, 240, 69, 0.42)',
    contrast: '#0d1a04',
    sigil: '⚰',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Cada rodada é uma pergunta.',
      choices: [
        { value: 6, label: '6' },
        { value: 8, label: '8' },
        { value: 10, label: '10' },
      ],
      default: 8,
    },
  ],
  music: 'tension',
}
