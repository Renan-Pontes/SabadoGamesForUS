import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { AVATARS, assignAvatars, avatarFor, avatarForName } from './avatars'
import { buildRoomAvatars, resolveAvatar } from './roomAvatars'
import ChristmasAvatar from './ChristmasAvatar'

const players = [
  { id: 31, name: 'Ana' },
  { id: 1, name: 'Bia' },
  { id: 16, name: 'Caio' },
  { id: 40, name: 'ana' },
]

describe('resolveAvatar', () => {
  const room = buildRoomAvatars(players)

  it('acha pelo id o mesmo avatar da distribuição da mesa', () => {
    const assigned = assignAvatars(players)
    for (const player of players) expect(resolveAvatar(room, { id: player.id })).toBe(assigned.get(player.id))
  })

  it('acha pelo nome (crachá dos jogos só tem nome), sem ligar para caixa/espaço', () => {
    expect(resolveAvatar(room, { name: ' caio ' })).toBe(room.byId.get(16))
    // Nome repetido: fica com quem chegou antes (menor id).
    expect(resolveAvatar(room, { name: 'ANA' })).toBe(room.byId.get(31))
  })

  it('sem mesa: id primeiro, depois nome', () => {
    expect(resolveAvatar(null, { id: 16, name: 'x' })).toBe(avatarFor({ id: 16 }))
    expect(resolveAvatar(null, { name: 'Zé' })).toBe(avatarForName('Zé'))
    expect(resolveAvatar(room, { name: 'Desconhecido' })).toBe(avatarForName('Desconhecido'))
  })

  it('ids 1, 16 e 31 colidem no preferido, mas a mesa separa', () => {
    const ids = new Set([1, 16, 31].map((id) => resolveAvatar(room, { id }).id))
    expect(ids.size).toBe(3)
  })
})

describe('ChristmasAvatar', () => {
  it('desenha os 15 personagens (parado, animado e congelado)', () => {
    for (const avatar of AVATARS) {
      const still = renderToString(createElement(ChristmasAvatar, { avatar, size: 28 }))
      expect(still).toContain(`data-avatar="${avatar.id}"`)
      expect(still).toContain(avatar.label)
      expect(still).toContain('xa-off')
      const animated = renderToString(createElement(ChristmasAvatar, { avatar: avatar.id, size: 120, animated: true }))
      expect(animated).toContain('xa-bob')
      const frozen = renderToString(createElement(ChristmasAvatar, { avatar, frozen: true, animated: true }))
      expect(frozen).not.toContain('xa-bob')
      expect(frozen).toContain('grayscale')
    }
  })

  it('título vazio deixa decorativo', () => {
    const html = renderToString(createElement(ChristmasAvatar, { avatar: 'rena', title: '' }))
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('role="img"')
  })
})
