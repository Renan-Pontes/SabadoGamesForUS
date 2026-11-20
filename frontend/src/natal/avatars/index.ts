/**
 * Avatares de Natal por jogador: o mesmo bichinho e a mesma cor na TV e no
 * celular, sem repetir na mesa (até 15).
 *
 *   <RoomAvatarsProvider players={players}>…</RoomAvatarsProvider>
 *   const avatar = useAvatar({ id: player.id, name: player.name })
 *   <ChristmasAvatar avatar={avatar} size={42} animated />
 */
export { default as ChristmasAvatar } from './ChristmasAvatar'
export { default as RoomAvatarsProvider } from './RoomAvatarsProvider'
export {
  AVATARS,
  assignAvatars,
  avatarFor,
  avatarForName,
  getAvatar,
  preferredAvatarIndex,
} from './avatars'
export { buildRoomAvatars, resolveAvatar, useAvatar, useRoomAvatars, useRosterAvatars } from './roomAvatars'
export type { AvatarId, AvatarInfo } from './avatars'
export type { ChristmasAvatarProps } from './ChristmasAvatar'
export type { RoomAvatars, AvatarPlayer } from './roomAvatars'
