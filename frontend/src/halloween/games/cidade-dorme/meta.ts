import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'cidade-dorme',
  name: 'Vila Dorme',
  icon: '🧝',
  tagline: 'Duendes travessos à solta na vila. Ninguém fecha o olho!',
  pitch: 'Duendes travessos estão transformando a Vila do Papai Noel em bonecos de neve. Uma rena detetive, um anjo e a vila inteira desconfiada — e ninguém fecha o olho.',
  howTo: [
    'Cada um recebe um papel secreto: duende, rena detetive, anjo ou morador.',
    'De noite TODO MUNDO escolhe alguém no celular — ninguém fecha o olho.',
    'De manhã a TV conta quem virou boneco de neve e lê o cartãozinho.',
    'De dia votem: quem tiver 2+ votos (sem empate) vai de trenó pro Polo Norte.',
    'A vila vence pegando os duendes; eles vencem se empatarem em número.',
  ],
  duration: '20-30 min',
  vibe: 'Dedução',
  minPlayers: 5,
  maxPlayers: 15,
  accent: {
    main: '#ff3d5a',
    light: '#ffa3b1',
    glow: 'rgba(255, 61, 90, 0.5)',
    contrast: '#1a0306',
    sigil: '❄',
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
      label: 'Revelar o papel de quem sai do jogo',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'natal',
  victoryMusic: 'wish',
}
