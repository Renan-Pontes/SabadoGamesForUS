import { useMemo, type ReactNode } from 'react'
import { buildRoomAvatars, RoomAvatarsContext, type AvatarPlayer } from './roomAvatars'

/**
 * Distribui os avatares da mesa para tudo que estiver dentro (PlayerBadge,
 * PlayerRoster, PlayerRail...). Recebe a mesa inteira: assim um crachá
 * sozinho tem o mesmo avatar que no lobby.
 */
export default function RoomAvatarsProvider({
  players,
  children,
}: {
  players: ReadonlyArray<AvatarPlayer>
  children: ReactNode
}) {
  const value = useMemo(() => buildRoomAvatars(players), [players])
  return <RoomAvatarsContext.Provider value={value}>{children}</RoomAvatarsContext.Provider>
}
