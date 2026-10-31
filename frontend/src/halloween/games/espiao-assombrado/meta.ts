import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'espiao-assombrado',
  name: 'Espião Assombrado',
  icon: '🕵️',
  tagline: 'Todo mundo sabe onde está. Menos um.',
  pitch: 'Pergunte, desconfie e acuse antes que o espião descubra o lugar.',
  howTo: [
    'Todo mundo recebe o lugar assombrado no celular — menos o espião.',
    'Façam perguntas uns aos outros sem entregar o lugar.',
    'Desconfiou? Acuse alguém: a maioria decide.',
    'O espião pode digitar o lugar a qualquer hora. Acertou, ganhou.',
  ],
  duration: '25-40 min',
  vibe: 'Blefe',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#a855f7',
    light: '#d8b4fe',
    glow: 'rgba(168, 85, 247, 0.45)',
    contrast: '#12041f',
    sigil: '◉',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      choices: [
        { value: 3, label: '3' },
        { value: 5, label: '5' },
        { value: 7, label: '7' },
      ],
      default: 5,
    },
    {
      key: 'talkMinutes',
      label: 'Tempo de conversa',
      help: 'Por rodada, antes da votação final.',
      choices: [
        { value: 5, label: '5 min' },
        { value: 7, label: '7 min' },
        { value: 9, label: '9 min' },
      ],
      default: 7,
    },
    {
      key: 'chaos',
      label: 'Rodadas malucas',
      help: 'De vez em quando, todo mundo (ou ninguém) é espião.',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'tension',
}
