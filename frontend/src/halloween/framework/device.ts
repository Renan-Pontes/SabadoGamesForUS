import type { HalloweenView } from '../engine/types'

/**
 * Identidade deste aparelho no contrato de juiz (`room.state._auth.d`).
 *
 * A base fica no localStorage (a TV reaproveita a chave da tela da sala,
 * que já gera ids "tv-..."), e cada aba ganha um sufixo no sessionStorage:
 * recarregar a TV mantém o contrato na hora, mas duas abas de TV abertas
 * não se acham a mesma juíza.
 */

const TV_KEY = 'sabado_tv_device'
const PHONE_KEY = 'sabado_phone_device'
const TAB_KEY = 'sabado_tab_id'

function randomId(length: number) {
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0')
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value)
  } catch {
    // Navegação privada sem armazenamento: o id vale só enquanto a página viver.
  }
}

let fallbackTab: string | null = null

export function judgeDeviceId(view: HalloweenView): string {
  const isTv = view === 'tv'
  const key = isTv ? TV_KEY : PHONE_KEY
  let base = readStorage(() => window.localStorage, key)
  if (!base) {
    base = `${isTv ? 'tv' : 'ph'}-${randomId(6)}`
    writeStorage(() => window.localStorage, key, base)
  }
  // A TV precisa ser reconhecível como TV (ela tem preferência para julgar).
  if (isTv && !base.startsWith('tv-')) base = `tv-${base}`
  if (!isTv && base.startsWith('tv-')) base = `ph-${base.slice(3)}`

  let tab = readStorage(() => window.sessionStorage, TAB_KEY)
  if (!tab) {
    tab = fallbackTab ?? randomId(4)
    fallbackTab = tab
    writeStorage(() => window.sessionStorage, TAB_KEY, tab)
  }
  return `${base}.${tab}`
}
