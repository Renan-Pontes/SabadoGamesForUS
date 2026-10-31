/**
 * O ritmo da revelação, igual no motor (que marca o prazo da fase), na TV
 * (que abre as portas) e nos celulares (que só contam o resultado depois
 * que a TV mostrou). Tudo em ms desde o começo da revelação, no relógio do
 * servidor — então TV e celulares andam juntos mesmo vendo o estado com
 * atraso.
 *
 *   intro ─► portas seguras, uma a uma ─► suspense ─► porta(s) do monstro ─► resultado
 */

/** "As portas vão abrir…" antes da primeira porta. */
export const REVEAL_INTRO_MS = 1600
/** Intervalo entre uma porta segura e a próxima. */
export const SAFE_DOOR_MS = 1100
/** Silêncio (batida de coração) antes da primeira porta de monstro. */
export const SUSPENSE_MS = 1400
/** Intervalo entre duas portas de monstro. */
export const MONSTER_DOOR_MS = 900
/** Depois da última porta, quanto até a TV dizer quem morreu. */
export const RESULT_DELAY_MS = 1200
/** Com susto de tela cheia, o resultado espera o susto passar (~2,5 s). */
export const SCARE_HOLD_MS = 2600
/** Quanto tempo o resultado fica na tela antes do placar. */
export const RESULT_HOLD_MS = 4000

export type RevealSchedule = {
  /** Quando cada porta abre, na ordem de abertura (`order[i]` abre em `openAt[i]`). */
  openAt: number[]
  /** Quando abre a primeira porta de monstro. */
  monsterAt: number
  /** Quando aparece o resultado (quem morreu, ou a salvação). */
  resultAt: number
  /** Duração total da fase. */
  total: number
}

/**
 * Agenda da revelação: `doorCount` portas, das quais as `monsterCount`
 * últimas da ordem têm monstro. Com `scare`, o resultado espera o susto.
 */
export function revealSchedule(doorCount: number, monsterCount: number, scare: boolean): RevealSchedule {
  const monsters = Math.max(0, Math.min(doorCount, monsterCount))
  const safe = Math.max(0, doorCount - monsters)
  const openAt: number[] = []
  for (let i = 0; i < safe; i += 1) openAt.push(REVEAL_INTRO_MS + i * SAFE_DOOR_MS)
  const monsterAt = REVEAL_INTRO_MS + safe * SAFE_DOOR_MS + SUSPENSE_MS
  for (let j = 0; j < monsters; j += 1) openAt.push(monsterAt + j * MONSTER_DOOR_MS)
  const lastOpen = openAt.length ? openAt[openAt.length - 1] : monsterAt
  const resultAt = Math.max(lastOpen + RESULT_DELAY_MS, scare ? monsterAt + SCARE_HOLD_MS : 0)
  return { openAt, monsterAt, resultAt, total: resultAt + RESULT_HOLD_MS }
}
