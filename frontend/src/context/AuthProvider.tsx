import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext, type User } from './AuthContext'

const TOKEN_KEY = 'sabado_token'
const API_URL = import.meta.env.VITE_API_URL || 'https://sabadogames.pythonanywhere.com/'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY)
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_URL}/api/auth/me/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser({
          id: data.user.id,
          email: data.user.email,
          nickname: data.user.profile?.nickname || 'Jogador',
        })
      } else {
        logout()
      }
    } catch (err) {
      console.error('Failed to fetch user:', err)
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setIsLoading(false)
    }
  }, [token, fetchUser])

  async function login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Falha no login')
    }

    const data = await response.json()
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
  }

  async function register(email: string, password: string, nickname: string) {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, nickname }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Falha no registro')
    }

    const data = await response.json()
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
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
