/**
 * Notas musicais por nome ("D4", "C#5", "Bb3") → frequência em Hz.
 *
 * As trilhas são escritas com nomes de nota para dar para ler a melodia no
 * código (e conferir a Tocata ou o Dies Irae de cabeça), não com números
 * mágicos.
 */

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "A4" → 69 (MIDI). Lança erro em nome inválido: melhor quebrar no teste do que tocar errado. */
export function midi(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note)
  if (!match) throw new Error(`Nota inválida: ${note}`)
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0
  return NOTE_INDEX[match[1]] + accidental + (Number(match[3]) + 1) * 12
}

/** Frequência de uma nota (nome ou número MIDI), com afinação A4 = 440 Hz. */
export function freq(note: string | number): number {
  const number = typeof note === 'number' ? note : midi(note)
  return 440 * Math.pow(2, (number - 69) / 12)
}

/** Sobe (ou desce) uma frequência em semitons. */
export function transpose(hz: number, semitones: number): number {
  return hz * Math.pow(2, semitones / 12)
}
