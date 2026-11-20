import type { HalloweenGameMeta } from '../../engine/types'

/**
 * Presente-Bomba: a batata quente de Natal. O slug continua 'abobora-bomba'
 * (salas e links antigos seguem funcionando); só o nome e a roupa mudaram.
 */
export const meta: HalloweenGameMeta = {
  slug: 'abobora-bomba',
  name: 'Presente-Bomba',
  icon: '🎁',
  tagline: 'Batata quente de Natal: fala e passa!',
  pitch: 'Batata quente natalina com pavio individual: quem enrola só queima o próprio tempo — e o presente faz POF!',
  howTo: [
    'A TV mostra um tema. Com o presente na mão, fale uma palavra dele.',
    'Segure o botão do celular para passar o presente — é batata quente!',
    'Seu pavio só queima enquanto o presente está com você.',
    'Acabou o pavio: POF! Perde uma vida. Vence quem sobrar com mais vidas.',
  ],
  duration: '10-25 min',
  vibe: 'Festa',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#ff4057',
    light: '#ffd166',
    glow: 'rgba(255, 64, 87, 0.5)',
    contrast: '#2a0509',
    sigil: '✦',
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
      help: 'Perdeu todas, vira boneco de neve ☃️ e só assiste (e torce).',
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
  music: 'jingle',
  victoryMusic: 'wish',
  phonePollMs: 700,
}
