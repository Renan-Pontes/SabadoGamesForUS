import type { HalloweenGameMeta } from '../../engine/types'

export const meta: HalloweenGameMeta = {
  slug: 'pergunta-trocada',
  name: 'Pergunta Trocada',
  icon: '🤨',
  tagline: 'Todo mundo respondeu a mesma pergunta. Quase todo mundo.',
  pitch: 'Panetone, amigo secreto e réveillon: um de vocês recebeu a pergunta errada e nem sabe. Ache a resposta que não combina — ou disfarce como se fosse a sua.',
  howTo: [
    'Todos recebem a mesma pergunta — menos um, que recebe outra e nem sabe!',
    'Responda no celular: um número, um nome ou poucas palavras.',
    'A TV mostra todas as respostas e depois a pergunta de verdade.',
    'Conversem e votem: quem respondeu outra pergunta?',
    'Pegaram o impostor? A mesa pontua. Escapou? Ele pontua.',
  ],
  duration: '15-25 min',
  vibe: 'Dedução',
  minPlayers: 3,
  maxPlayers: 15,
  accent: {
    main: '#a78bfa',
    light: '#d9ccff',
    glow: 'rgba(167, 139, 250, 0.45)',
    contrast: '#1a0f3d',
    sigil: '?',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Cada rodada tem uma pergunta nova.',
      choices: [
        { value: 3, label: '3' },
        { value: 5, label: '5' },
        { value: 7, label: '7' },
      ],
      default: 5,
    },
    {
      key: 'talkSeconds',
      label: 'Tempo de conversa',
      help: 'Depois que a pergunta de verdade aparece. Todo mundo pronto? A votação abre antes.',
      choices: [
        { value: 45, label: '45 s' },
        { value: 60, label: '1 min' },
        { value: 90, label: '1 min 30' },
      ],
      default: 60,
    },
    {
      key: 'chaos',
      label: 'Rodada sem impostor',
      help: 'Uma vez por partida, talvez, ninguém recebe a pergunta trocada — e ninguém sabe até o fim.',
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
