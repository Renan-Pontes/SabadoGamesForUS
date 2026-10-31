import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext, type User } from './AuthContext'
import {
  clearToken,
  getMe,
  getToken,
  guestLogin,
  isAuthError,
  loginAccount,
  registerAccount,
  setToken as persistToken,
} from '../lib/api'
import type { AuthResponse } from '../lib/api'
import type { AuthUser } from '../lib/types'

/** A conta fica guardada junto do token: abrir o app não espera o servidor. */
const USER_KEY = 'sabado_user'

/** Espera entre tentativas de buscar a conta quando a rede falha. */
const RETRY_FIRST_MS = 2000
const RETRY_MAX_MS = 15000

/**
 * Conta de convidado (entrou só com apelido) ganha do backend um e-mail
 * sintético "convidado-<hex>@convidado.sabadogames". Ele não serve para nada
 * na tela, então some daqui.
 */
const GUEST_EMAIL_SUFFIX = '@convidado.sabadogames'

function isGuestEmail(email: string | null | undefined) {
  return !email || email.toLowerCase().endsWith(GUEST_EMAIL_SUFFIX)
}

function toUser(data: AuthUser): User {
  const isGuest = isGuestEmail(data.email)
  return {
    id: data.id,
    email: isGuest ? '' : data.email,
    nickname: data.profile?.nickname || 'Jogador',
    isGuest,
  }
}

function readCachedUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<User>
    if (typeof parsed.id !== 'number' || typeof parsed.nickname !== 'string') return null
    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      nickname: parsed.nickname,
      isGuest: Boolean(parsed.isGuest),
    }
  } catch {
    return null
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(USER_KEY)
  } catch {
    // Armazenamento bloqueado (aba anônima): a sessão segue só na memória.
  }
}

/**
 * Sessão do jogador.
 *
 * Toda chamada passa por `lib/api.ts`. Antes este arquivo tinha a própria
 * cópia da URL da API e um `fetch` para cada rota de autenticação — e as duas
 * cópias divergiram: o login apontava para um host que não existia mais
 * enquanto o resto do app já usava o certo.
 *
 * Na festa a rede é o Wi-Fi da sala: só um 401/403 derruba a sessão. Falta de
 * internet mantém a conta em cache e tenta de novo — um convidado deslogado
 * não tem senha para voltar e viraria "Apelido 2" na mesa.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  // Com token e conta em cache, a sessão já nasce pronta (sem tela de
  // carregamento a cada F5); a conta é conferida com o servidor em seguida.
  const [user, setUserState] = useState<User | null>(() => (getToken() ? readCachedUser() : null))
  const [isLoading, setIsLoading] = useState(() => Boolean(getToken()) && !readCachedUser())

  const setUser = useCallback((next: User | null) => {
    writeCachedUser(next)
    setUserState(next)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    writeCachedUser(null)
    setTokenState(null)
    setUserState(null)
    setIsLoading(false)
  }, [])

  // Confere a conta do token atual. Roda ao abrir o app e a cada troca de token.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    let timer: number | undefined

    async function attempt(delay: number) {
      try {
        const data = await getMe()
        // Saiu ou trocou de conta enquanto a resposta vinha: ignora.
        if (cancelled || getToken() !== token) return
        setUser(toUser(data.user))
        setIsLoading(false)
      } catch (err) {
        if (cancelled || getToken() !== token) return
        if (isAuthError(err)) {
          // Token vencido ou revogado: derruba a sessão em vez de deixar o app
          // preso numa identidade que o servidor não reconhece mais.
          logout()
          return
        }
        setIsLoading(false)
        // Com a conta em cache dá para jogar; sem ela, insiste até a rede voltar.
        if (!readCachedUser()) {
          timer = window.setTimeout(() => attempt(Math.min(delay * 2, RETRY_MAX_MS)), delay)
        }
      }
    }

    attempt(RETRY_FIRST_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [token, logout, setUser])

  /**
   * Guarda a sessão nova. A conta que veio junto na resposta já vale (as
   * telas não piscam "deslogado" enquanto o `/me` não volta).
   */
  const startSession = useCallback(
    (data: AuthResponse) => {
      persistToken(data.token)
      if (data.user) {
        setUser(toUser(data.user))
        setIsLoading(false)
      } else {
        writeCachedUser(null)
        setUserState(null)
        setIsLoading(true)
      }
      setTokenState(data.token)
    },
    [setUser],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await loginAccount({ email, password }))
    },
    [startSession],
  )

  const register = useCallback(
    async (email: string, password: string, nickname: string) => {
      startSession(await registerAccount({ email, password, nickname }))
    },
    [startSession],
  )

  const loginAsGuest = useCallback(
    async (nickname: string) => {
      startSession(await guestLogin(nickname.trim()))
    },
    [startSession],
  )

  const refreshUser = useCallback(async () => {
    if (!getToken()) return
    try {
      const data = await getMe()
      setUser(toUser(data.user))
    } catch (err) {
      if (isAuthError(err)) logout()
    }
  }, [logout, setUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginAsGuest,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
