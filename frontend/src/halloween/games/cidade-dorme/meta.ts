import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'cidade-dorme',
  name: 'Cidade Dorme',
  icon: '🔪',
  tagline: 'Ninguém fecha o olho. Todo mundo desconfia.',
  pitch: 'Assassinos à solta, um detetive, um anjo e uma cidade inteira de suspeitos.',
  howTo: [
    'Cada um recebe um papel secreto: assassino, detetive, anjo ou cidadão.',
    'De noite, todo mundo mexe no celular — ninguém fecha o olho.',
    'De manhã a TV conta quem morreu. Conversem e votem em alguém.',
    'A cidade vence tirando os assassinos; eles vencem se empatarem em número.',
  ],
  duration: '20-30 min',
  vibe: 'Dedução',
  minPlayers: 5,
  maxPlayers: 15,
  accent: {
    main: '#e0213a',
    light: '#ff8a9a',
    glow: 'rgba(224, 33, 58, 0.45)',
    contrast: '#1a0306',
    sigil: '☾',
  },
  options: [
    {
      key: 'dayMinutes',
      label: 'Conversa de dia',
      help: 'Tempo para discutir antes da votação.',
      choices: [
        { value: 2, label: '2 min' },
        { value: 3, label: '3 min' },
        { value: 4, label: '4 min' },
      ],
      default: 3,
    },
    {
      key: 'revealRole',
      label: 'Revelar o papel de quem morre',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'night',
}
