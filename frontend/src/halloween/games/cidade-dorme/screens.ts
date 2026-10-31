import type { MusicTrack } from '../../audio'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HInput, HPlayer } from '../../engine/types'
import { ROLE_INFO } from './content'
import { hasGrace, roleCounts, type Phase, type Role, type State } from './engine'

/**
 * Pecinhas que a TV e o celular do "Cidade Dorme" usam em comum. Moram aqui
 * (e não nos .tsx) porque `Tv.tsx` e `Phone.tsx` só exportam o componente.
 */

/** Vibra o celular, quando dá — confirmação de que a escolha foi. */
export function buzz(pattern: number | number[] = 35): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // Sem vibração (iPhone, computador): tudo bem.
  }
}

/** Folga escondida no relógio das fases de resposta (a vela zera na hora prometida). */
export function graceFor(state: State): number {
  return !state.over && hasGrace(state.phase) ? GRACE_MS : 0
}

/** "NOITE 2", "DIA 2"... para o cabeçalho da TV e do celular. */
export function phaseLabel(state: State): string {
  if (state.over) return 'FIM DA CIDADE'
  switch (state.phase) {
    case 'roles':
      return 'OS PAPÉIS'
    case 'night':
      return `NOITE ${state.round}`
    case 'morning':
      return `MANHÃ ${state.round}`
    case 'day':
      return `DIA ${state.round}`
    case 'vote':
      return `VOTAÇÃO · DIA ${state.round}`
    case 'verdict':
      return `VEREDITO · DIA ${state.round}`
    default:
      return ''
  }
}

/** Trilha de cada fase: noite com órgão, dia com relógio, votação com tensão. */
export function musicFor(phase: Phase): MusicTrack {
  switch (phase) {
    case 'roles':
    case 'night':
      return 'night'
    case 'morning':
    case 'day':
      return 'day'
    default:
      return 'tension'
  }
}

/** Quantos vivos já agiram (✓) — fantasma não conta. */
export function aliveActed(state: State): number {
  return state.acted.filter((id) => state.alive.includes(id)).length
}

/** Fantasmas: quem está no roster mas não está vivo. */
export function ghostsOf(state: State): number[] {
  return state.roster.filter((id) => !state.alive.includes(id))
}

/** Assassinos à solta, se a cidade tem como saber (papéis revelados). */
export function killersAtLarge(state: State): number | null {
  if (!state.revealRole) return null
  const total = roleCounts(state.roster.length).killer
  return Math.max(0, total - state.graveyard.filter((grave) => grave.role === 'killer').length)
}

export function roleLabel(role: Role): string {
  return `${ROLE_INFO[role].icon} ${ROLE_INFO[role].name}`
}

export function namesOf(players: readonly HPlayer[], ids: readonly number[]): string {
  return listNames(ids.map((id) => nameOf(players, id)))
}

/** "1 voto", "2 votos". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * O "⏹ Encerrar" do host põe `over` sem passar pelo motor, então o fim não
 * tem `final` e a TV não sabe quem era quem. Nesse caso cada celular conta o
 * próprio papel no slot 'reveal' (slot de jogador só a TV recebe) e a TV
 * revela. Só vale com a partida encerrada — antes disso, nada é lido.
 */
export const REVEAL_SLOT = 'reveal'
const ROLES: readonly Role[] = ['killer', 'detective', 'angel', 'citizen']

export function revealedRoles(
  state: State,
  slots: Record<string, Record<number, HInput | undefined>>,
): Record<string, Role> {
  const told: Record<string, Role> = {}
  if (!state.over || state.final) return told
  for (const id of state.roster) {
    const role = slots[REVEAL_SLOT]?.[id]?.role
    if (typeof role === 'string' && (ROLES as readonly string[]).includes(role)) told[String(id)] = role as Role
  }
  return told
}
