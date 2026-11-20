/**
 * Fontes e cores do kit dos jogos. Importar este módulo carrega as fontes
 * (a camada global já importa; os jogos só precisam das constantes).
 *
 * Natal 2026: os NOMES ficaram os da Noite do Terror (os jogos importam
 * `CREEPY_FONT` e `SPOOKY_COLORS`), mas os valores agora são natalinos — o
 * mesmo truque das variáveis de `index.css`. `BLOODY_FONT` continua a
 * Nosifer, para os jogos "Old" de Halloween.
 */
import '@fontsource/creepster'
import '@fontsource/nosifer'
import './spooky.css'

/** Letra dos títulos e chamadas: no Natal, a de cartão (Mountains of Christmas). */
export const CREEPY_FONT = "'Mountains of Christmas', 'Fredoka', cursive"

/** Letra de título redonda e fofinha, que lê bem de longe (números e frases grandes). */
export const FESTIVE_ROUND_FONT = "'Fredoka', 'Rajdhani', sans-serif"

/** Letra "sangrando" — use pouco (só palavras curtas: SUSTO, MORREU). */
export const BLOODY_FONT = "'Nosifer', 'Creepster', cursive"

/**
 * Paleta do kit (funciona sobre fundo escuro). Nomes da Noite do Terror,
 * valores de Natal: abóbora → vermelho-bala, vela → dourado de estrela,
 * gosma → verde-pinheiro, bruxa → azul-gelo, osso → creme de biscoito.
 */
export const SPOOKY_COLORS = {
  pumpkin: '#ff5a66', // = var(--pumpkin)
  pumpkinDeep: '#c21f33',
  candle: '#f5c242', // = var(--status-waiting)
  blood: '#e8394a', // = var(--blood)
  bone: '#fff6dc',
  ghost: '#f4f8ff',
  toxic: '#4fd67e',
  witch: '#5aa9ff',
  night: '#06101f',
  moon: '#fffbe8',
} as const

/** Paleta de Natal com nomes próprios, para código novo. */
export const XMAS_COLORS = {
  red: '#e8394a',
  candy: '#ff5a66',
  green: '#1f9d55',
  pine: '#4fd67e',
  gold: '#f5c242',
  snow: '#f4f8ff',
  ice: '#7fd8ff',
  cookie: '#d9a066',
  night: '#06101f',
} as const
