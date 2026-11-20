import { createContext, useContext, useMemo } from 'react'
import { assignAvatars, avatarFor, avatarForName, nameKey, type AvatarInfo } from './avatars'

/**
 * Os avatares da mesa inteira, para quem só sabe o nome (o PlayerBadge dos
 * jogos recebe só `name`). A tela do jogo põe um <RoomAvatarsProvider> em
 * volta; sem ele, cada crachá cai no avatar pelo id ou pelo nome.
 */
export type RoomAvatars = {
  byId: ReadonlyMap<number, AvatarInfo>
  byName: ReadonlyMap<string, AvatarInfo>
}

export type AvatarPlayer = { id: number; name?: string | null }

export function buildRoomAvatars(players: ReadonlyArray<AvatarPlayer>): RoomAvatars {
  const byId = assignAvatars(players)
  const byName = new Map<string, AvatarInfo>()
  // Nome repetido: fica com quem chegou antes (menor id).
  for (const player of [...players].sort((a, b) => a.id - b.id)) {
    const key = nameKey(player.name ?? '')
    const avatar = byId.get(player.id)
    if (key && avatar && !byName.has(key)) byName.set(key, avatar)
  }
  return { byId, byName }
}

/** Mesa (se houver) → id → nome. Sempre devolve um avatar. */
export function resolveAvatar(
  room: RoomAvatars | null,
  who: { id?: number | null; name?: string | null },
): AvatarInfo {
  const hasId = typeof who.id === 'number' && Number.isFinite(who.id)
  if (room) {
    if (hasId) {
      const byId = room.byId.get(who.id as number)
      if (byId) return byId
    }
    const byName = who.name ? room.byName.get(nameKey(who.name)) : undefined
    if (byName) return byName
  }
  if (hasId) return avatarFor({ id: who.id as number })
  return avatarForName(who.name ?? '')
}

export const RoomAvatarsContext = createContext<RoomAvatars | null>(null)

export function useRoomAvatars(): RoomAvatars | null {
  return useContext(RoomAvatarsContext)
}

/**
 * Para listas que recebem a mesa (SeatGrid, PlayerRoster, PlayerRail): usa
 * o provider se ele conhece a pessoa; senão distribui pela própria lista.
 */
export function useRosterAvatars(players: ReadonlyArray<AvatarPlayer>): (player: AvatarPlayer) => AvatarInfo {
  const room = useRoomAvatars()
  const local = useMemo(() => buildRoomAvatars(players), [players])
  return (player) => room?.byId.get(player.id) ?? resolveAvatar(local, player)
}

/** O avatar de alguém nesta tela (mesmo na TV e no celular). */
export function useAvatar(who: { id?: number | null; name?: string | null }): AvatarInfo {
  return resolveAvatar(useRoomAvatars(), who)
}
