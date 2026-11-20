import { describe, expect, it } from 'vitest'
import { AVATARS, assignAvatars, avatarFor, avatarForName, getAvatar, nameKey, preferredAvatarIndex } from './avatars'

const seats = (...ids: number[]) => ids.map((id) => ({ id }))

describe('AVATARS', () => {
  it('tem 15 personagens e 15 cores, todos diferentes', () => {
    expect(AVATARS).toHaveLength(15)
    expect(new Set(AVATARS.map((avatar) => avatar.id)).size).toBe(15)
    expect(new Set(AVATARS.map((avatar) => avatar.color.toLowerCase())).size).toBe(15)
    AVATARS.forEach((avatar, index) => {
      expect(avatar.index).toBe(index)
      expect(avatar.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(avatar.label.length).toBeGreaterThan(0)
      expect(getAvatar(avatar.id)).toBe(avatar)
    })
  })
})

describe('assignAvatars', () => {
  it('mesa cheia de 15 não repete nenhum avatar, mesmo com ids que colidem', () => {
    // 1, 16, 31... preferem todos o mesmo avatar.
    const ids = Array.from({ length: 15 }, (_, i) => 1 + i * 15)
    expect(new Set(ids.map(preferredAvatarIndex)).size).toBe(1)
    const assigned = assignAvatars(seats(...ids))
    expect(new Set([...assigned.values()].map((avatar) => avatar.id)).size).toBe(15)
  })

  it('ids espalhados (várias salas ao mesmo tempo) também não repetem', () => {
    const ids = [3, 7, 18, 22, 33, 41, 48, 52, 63, 64, 77, 90, 91, 105, 120]
    const assigned = assignAvatars(seats(...ids))
    expect(new Set([...assigned.values()].map((avatar) => avatar.id)).size).toBe(15)
  })

  it('não depende da ordem da lista (TV e celular recebem em ordens diferentes)', () => {
    const a = assignAvatars(seats(40, 10, 25, 55, 11))
    const b = assignAvatars(seats(55, 11, 40, 25, 10))
    for (const id of [10, 11, 25, 40, 55]) expect(a.get(id)).toBe(b.get(id))
  })

  it('quem chega depois não muda o avatar de quem já estava', () => {
    const before = assignAvatars(seats(100, 115, 101))
    const after = assignAvatars(seats(100, 115, 101, 130, 131, 160))
    for (const id of [100, 115, 101]) expect(after.get(id)).toBe(before.get(id))
  })

  it('cada um fica no preferido quando não há disputa', () => {
    const assigned = assignAvatars(seats(200, 201, 202))
    expect(assigned.get(200)).toBe(AVATARS[preferredAvatarIndex(200)])
    expect(assigned.get(201)).toBe(AVATARS[preferredAvatarIndex(201)])
    expect(assigned.get(202)).toBe(AVATARS[preferredAvatarIndex(202)])
  })

  it('com mais de 15, repete o mínimo possível', () => {
    const assigned = assignAvatars(seats(...Array.from({ length: 20 }, (_, i) => i * 15)))
    const counts = new Map<string, number>()
    for (const avatar of assigned.values()) counts.set(avatar.id, (counts.get(avatar.id) ?? 0) + 1)
    expect(counts.size).toBe(15)
    expect(Math.max(...counts.values())).toBe(2)
  })

  it('ignora id repetido e lista vazia', () => {
    expect(assignAvatars([]).size).toBe(0)
    expect(assignAvatars(seats(5, 5, 5)).size).toBe(1)
  })
})

describe('avatarFor', () => {
  it('é o mesmo que a distribuição da mesa', () => {
    const roster = seats(1, 16, 31)
    const assigned = assignAvatars(roster)
    for (const seat of roster) expect(avatarFor(seat, roster)).toBe(assigned.get(seat.id))
  })

  it('sem mesa (ou fora dela) cai no preferido pelo id', () => {
    expect(avatarFor({ id: 16 })).toBe(AVATARS[preferredAvatarIndex(16)])
    expect(avatarFor({ id: 99 }, seats(1, 2))).toBe(AVATARS[preferredAvatarIndex(99)])
  })

  it('aguenta id estranho (negativo, zero)', () => {
    expect(AVATARS).toContain(avatarFor({ id: -7 }))
    expect(AVATARS).toContain(avatarFor({ id: 0 }))
  })
})

describe('avatarForName', () => {
  it('é estável e ignora espaços e maiúsculas', () => {
    expect(avatarForName('Ana')).toBe(avatarForName('  ana '))
    expect(nameKey(' ÁNA ')).toBe('ána')
    expect(AVATARS).toContain(avatarForName(''))
  })
})
