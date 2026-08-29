/** Vocabulário do baralho, compartilhado entre os jogos de carta. */

export type SuitKey = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export const SUITS: Record<SuitKey, { symbol: string; label: string; red: boolean }> = {
  hearts: { symbol: '♥', label: 'Copas', red: true },
  diamonds: { symbol: '♦', label: 'Ouros', red: true },
  clubs: { symbol: '♣', label: 'Paus', red: false },
  spades: { symbol: '♠', label: 'Espadas', red: false },
}

export const SUIT_ORDER: SuitKey[] = ['hearts', 'diamonds', 'clubs', 'spades']

/**
 * O baralho do Blef Jack tem 14 postos por naipe (56 cartas), na ordem
 * histórica do baralho de corte: Valete, Cavaleiro, Dama, Rei.
 */
export function rankLabel(rank: number) {
  switch (rank) {
    case 1:
      return 'A'
    case 11:
      return 'J'
    case 12:
      return 'C'
    case 13:
      return 'Q'
    case 14:
      return 'K'
    default:
      return String(rank)
  }
}
