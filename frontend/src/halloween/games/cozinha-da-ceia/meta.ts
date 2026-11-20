import type { HalloweenGameMeta } from '../../engine/types'

/**
 * Cozinha da Ceia: dois times de duendes cozinhando a ceia de Natal contra
 * o relógio. Cada celular é um par de mãos numa estação; a TV é a cozinha.
 */
export const meta: HalloweenGameMeta = {
  slug: 'cozinha-da-ceia',
  name: 'Cozinha da Ceia',
  icon: '🧑‍🍳',
  tagline: 'Time contra time: a ceia tem que sair!',
  pitch: 'Peru no forno, rabanada no fogo e a vó cobrando o pavê: cada um cuida de uma estação pelo celular, o time grita junto e a TV mostra a bagunça. Entregue mais pratos que o outro time — sem queimar nada!',
  howTo: [
    'Cada time tem sua cozinha na TV e uma fila de pedidos.',
    'Seu celular é sua estação: tábua, tigela, fogão, forno ou balcão.',
    'Toque para cortar, pôr no fogo e TIRAR antes de queimar!',
    'No balcão, monte o prato completo e entregue antes de esgotar.',
    'Conversem! Mais pratos entregues vence a rodada.',
  ],
  duration: '10-20 min',
  vibe: 'Cooperativo',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#ff9f43',
    light: '#ffd6a8',
    glow: 'rgba(255, 159, 67, 0.45)',
    contrast: '#2a1402',
    sigil: '✦',
  },
  options: [
    {
      key: 'minutes',
      label: 'Tempo de cozinha',
      help: 'Quanto dura cada rodada de pedidos.',
      choices: [
        { value: 2, label: '2 min' },
        { value: 3, label: '3 min' },
        { value: 4, label: '4 min' },
      ],
      default: 3,
    },
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'Melhor de N: quem ganhar a maioria das rodadas leva a ceia.',
      choices: [
        { value: 1, label: '1' },
        { value: 3, label: 'Melhor de 3' },
        { value: 5, label: 'Melhor de 5' },
      ],
      default: 3,
    },
    {
      key: 'chaos',
      label: 'Imprevistos',
      help: 'Da 2ª rodada em diante: faltou gás, a vó chegou, ceia lotada...',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'jingle',
  victoryMusic: 'wish',
  // Toque de cozinha pede resposta rápida (o mínimo do servidor gratuito).
  phonePollMs: 1000,
}
