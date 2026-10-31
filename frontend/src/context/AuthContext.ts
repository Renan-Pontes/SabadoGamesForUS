import { createContext } from 'react'

export interface User {
  id: number
  email: string
  nickname: string
  /** Entrou só com apelido: não tem e-mail nem senha para voltar depois. */
  isGuest: boolean
}

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nickname: string) => Promise<void>
  /** Entrada rápida da festa: cria uma conta de convidado só com o apelido. */
  loginAsGuest: (nickname: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
