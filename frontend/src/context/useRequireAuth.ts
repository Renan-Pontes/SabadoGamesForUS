import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Só aceita caminho interno ("/play/1234"). Nada de "//site.com", URL
 * completa ou barra invertida: o `?next=` vem da barra de endereço e qualquer
 * um pode montar um link com ele.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  // Voltar para a própria entrada criaria um laço.
  if (value === '/' || value.startsWith('/?')) return null
  return value
}

/** Endereço da entrada que devolve a pessoa para `next` depois de entrar. */
export function loginPath(next: string | null | undefined) {
  const safe = safeNextPath(next)
  return safe ? `/?next=${encodeURIComponent(safe)}` : '/'
}

/**
 * Código da sala embutido no `next` (/play/1234, /host/1234, /game/1234...).
 * A entrada usa para avisar "você foi chamado para a sala 1234".
 */
export function roomCodeFromPath(path: string | null | undefined): string | null {
  const match = /^\/(?:play|host|tv|game)\/([A-Za-z0-9]{2,8})(?:[/?#]|$)/.exec(path ?? '')
  return match ? match[1].toUpperCase() : null
}

/**
 * Tela que exige conta: sem login, manda para a entrada com `?next=` da rota
 * atual — quem escaneou o QR da TV digita o apelido e volta direto para a sala.
 * `replace` para o botão "voltar" não cair de novo aqui e quicar.
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate(loginPath(here), { replace: true })
  }, [isAuthenticated, isLoading, navigate, here])
}
