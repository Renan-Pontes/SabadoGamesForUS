import { describe, expect, it } from 'vitest'
import { loginPath, roomCodeFromPath, safeNextPath } from './useRequireAuth'
import { ApiError, friendlyError, isAuthError } from '../lib/api'

describe('safeNextPath', () => {
  it('aceita caminho interno com busca', () => {
    expect(safeNextPath('/play/1234')).toBe('/play/1234')
    expect(safeNextPath('/game/1234?view=player')).toBe('/game/1234?view=player')
  })

  it('recusa endereço de fora e truques de barra', () => {
    expect(safeNextPath('https://golpe.com')).toBeNull()
    expect(safeNextPath('//golpe.com/play/1')).toBeNull()
    expect(safeNextPath('/\\golpe.com')).toBeNull()
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
  })

  it('recusa a própria entrada (laço) e vazio', () => {
    expect(safeNextPath('/')).toBeNull()
    expect(safeNextPath('/?next=/play/1')).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
  })
})

describe('loginPath', () => {
  it('codifica o destino', () => {
    expect(loginPath('/play/1234')).toBe('/?next=%2Fplay%2F1234')
  })

  it('sem destino válido, só a entrada', () => {
    expect(loginPath('https://golpe.com')).toBe('/')
    expect(loginPath(undefined)).toBe('/')
  })
})

describe('roomCodeFromPath', () => {
  it('acha o código das telas de sala', () => {
    expect(roomCodeFromPath('/play/1234')).toBe('1234')
    expect(roomCodeFromPath('/host/ab12')).toBe('AB12')
    expect(roomCodeFromPath('/game/5678?view=tv')).toBe('5678')
    expect(roomCodeFromPath('/game/5678/espiao-assombrado')).toBe('5678')
  })

  it('não inventa código fora de sala', () => {
    expect(roomCodeFromPath('/lobby')).toBeNull()
    expect(roomCodeFromPath('/profile')).toBeNull()
    expect(roomCodeFromPath(null)).toBeNull()
  })
})

describe('friendlyError', () => {
  it('lê o erro de campo do DRF sem mostrar JSON', () => {
    const err = new ApiError(400, '{"nickname":["Diga um apelido para entrar."]}')
    expect(friendlyError(err, 'x')).toBe('Diga um apelido para entrar.')
  })

  it('traduz mensagens conhecidas do backend', () => {
    expect(friendlyError(new ApiError(400, '{"non_field_errors":["Invalid credentials."]}'), 'x')).toBe(
      'E-mail ou senha não conferem.',
    )
    expect(friendlyError(new ApiError(404, '{"detail":"No Room matches the given query."}'), 'x')).toBe(
      'Não achamos essa sala. Confira o código.',
    )
    expect(friendlyError(new ApiError(400, '{"detail":"All players must be ready before starting."}'), 'x')).toMatch(
      /pronto/,
    )
  })

  it('página HTML de erro vira a mensagem padrão', () => {
    expect(friendlyError(new ApiError(500, '<!doctype html><h1>Server Error</h1>'), 'Tente de novo.')).toBe(
      'Tente de novo.',
    )
  })

  it('falta de rede tem mensagem própria', () => {
    expect(friendlyError(new TypeError('Failed to fetch'), 'x')).toMatch(/conexão/)
  })
})

describe('isAuthError', () => {
  it('só 401 e 403 derrubam a sessão', () => {
    expect(isAuthError(new ApiError(401, ''))).toBe(true)
    expect(isAuthError(new ApiError(403, ''))).toBe(true)
    expect(isAuthError(new ApiError(500, ''))).toBe(false)
    expect(isAuthError(new TypeError('Failed to fetch'))).toBe(false)
  })
})
