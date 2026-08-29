import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext, type User } from './AuthContext'
import {
  clearToken,
  getMe,
  getToken,
  loginAccount,
  registerAccount,
  setToken as persistToken,
} from '../lib/api'

/**
 * Sessão do jogador.
 *
 * Toda chamada passa por `lib/api.ts`. Antes este arquivo tinha a própria
 * cópia da URL da API e um `fetch` para cada rota de autenticação — e as duas
 * cópias divergiram: o login apontava para um host que não existia mais
 * enquanto o resto do app já usava o certo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => getToken())
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
    setUser(null)
  }, [])

  const fetchUser = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMe()
      setUser({
        id: data.user.id,
        email: data.user.email,
        nickname: data.user.profile?.nickname || 'Jogador',
      })
    } catch {
      // Token vencido ou revogado: derruba a sessão em vez de deixar o app
      // preso numa identidade que o servidor não reconhece mais.
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setIsLoading(false)
    }
  }, [token, fetchUser])

  async function login(email: string, password: string) {
    const data = await loginAccount({ email, password })
    persistToken(data.token)
    setToken(data.token)
  }

  async function register(email: string, password: string, nickname: string) {
    const data = await registerAccount({ email, password, nickname })
    persistToken(data.token)
    setToken(data.token)
  }

  async function refreshUser() {
    if (!token) return
    await fetchUser()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
