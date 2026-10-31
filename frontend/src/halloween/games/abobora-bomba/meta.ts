import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'abobora-bomba',
  name: 'Abóbora-Bomba',
  icon: '🎃',
  tagline: 'Fale rápido. O pavio é seu.',
  pitch: 'Batata quente com pavio individual: enrolar só queima o seu tempo.',
  howTo: [
    'A TV mostra um tema. Com a abóbora na mão, fale uma palavra dele.',
    'Segure o botão do celular para passar a abóbora adiante.',
    'Seu pavio só queima enquanto a abóbora está com você.',
    'Acabou o pavio: BUM, perde uma vida. Vence quem sobrar com mais vidas.',
  ],
  duration: '10-25 min',
  vibe: 'Festa',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#ff7b1c',
    light: '#ffb36b',
    glow: 'rgba(255, 123, 28, 0.5)',
    contrast: '#1f0d02',
    sigil: '✸',
  },
  options: [
    {
      key: 'fuse',
      label: 'Pavio',
      help: 'Quanto pavio cada um tem por rodada. Automático: 15 s até 6 pessoas, 12 s até 10, 10 s com mais.',
      choices: [
        { value: 'auto', label: 'Automático' },
        { value: 10, label: '10 s' },
        { value: 15, label: '15 s' },
        { value: 20, label: '20 s' },
      ],
      default: 'auto',
    },
    {
      key: 'lives',
      label: 'Vidas',
      help: 'Perdeu todas, vira fantasma e só assiste.',
      choices: [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
      ],
      default: 2,
    },
    {
      key: 'mode',
      label: 'Modo',
      help: 'Falar: diga a palavra em voz alta. Digitar: escreva uma palavra nova do tema para passar (ela aparece na TV).',
      choices: [
        { value: 'falar', label: 'Falar' },
        { value: 'digitar', label: 'Digitar' },
      ],
      default: 'falar',
    },
  ],
  music: 'chase',
  phonePollMs: 700,
}
