import type { HalloweenGameMeta } from '../../engine/types'

/**
 * Fábrica de Presentes: dois times de elfos, uma esteira na TV para cada um
 * e as peças espalhadas pelos celulares — ninguém monta sozinho.
 */
export const meta: HalloweenGameMeta = {
  slug: 'fabrica-de-presentes',
  name: 'Fábrica de Presentes',
  icon: '🏭',
  tagline: 'Time contra time na esteira do Papai Noel!',
  pitch: 'Cada um tem só algumas peças no celular: caixa, papel, laço, etiqueta. Gritem “quem tem o laço dourado?!”, montem os pedidos na ordem e encham o trenó antes do outro time.',
  howTo: [
    'Dois times de elfos: cada um tem uma esteira de presentes na TV.',
    'O pedido mostra as peças na ordem: caixa, papel, laço, etiqueta.',
    'Cada peça está no celular de UMA pessoa do time. Gritem: “quem tem?!”',
    'Toque a sua peça na vez dela. Peça errada vira BAGUNÇA (−5).',
    'Presente pronto vai pro trenó. Mais pontos ganha!',
  ],
  duration: '10-20 min',
  vibe: 'Cooperativo',
  minPlayers: 2,
  maxPlayers: 15,
  accent: {
    main: '#ff7a45',
    light: '#ffc29e',
    glow: 'rgba(255, 122, 69, 0.45)',
    contrast: '#2b0d02',
    sigil: '🎀',
  },
  options: [
    {
      key: 'rounds',
      label: 'Rodadas',
      help: 'A cada rodada as peças trocam de dono.',
      choices: [
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
      ],
      default: 3,
    },
    {
      key: 'minutes',
      label: 'Tempo de cada rodada',
      choices: [
        { value: 2, label: '2 min' },
        { value: 3, label: '3 min' },
        { value: 4, label: '4 min' },
      ],
      default: 3,
    },
    {
      key: 'chaos',
      label: 'Imprevistos',
      help: 'A partir da 2ª rodada: esteira ao contrário, pedido VIP, acabou a fita…',
      choices: [
        { value: true, label: 'Sim' },
        { value: false, label: 'Não' },
      ],
      default: true,
    },
  ],
  music: 'jingle',
  victoryMusic: 'wish',
  phonePollMs: 1000,
}
