type RoomView = 'host' | 'player'

const STORAGE_KEY = 'sabado_last_room'
const STAY_PREFIX = 'sabado_stay_in_lobby_'

export function saveLastRoom(code: string, view: RoomView) {
  const payload = {
    code: code.toUpperCase(),
    view,
    savedAt: Date.now(),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function loadLastRoom(): { code: string; view: RoomView } | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { code?: string; view?: RoomView }
    if (!parsed.code || (parsed.view !== 'host' && parsed.view !== 'player')) {
      return null
    }
    return { code: parsed.code, view: parsed.view }
  } catch {
    return null
  }
}

export function clearLastRoom() {
  window.localStorage.removeItem(STORAGE_KEY)
}

export function setStayInLobby(code: string, stay: boolean) {
  if (!code) return
  const key = `${STAY_PREFIX}${code.toUpperCase()}`
  if (stay) {
    window.localStorage.setItem(key, '1')
  } else {
    window.localStorage.removeItem(key)
  }
}

export function getStayInLobby(code: string) {
  if (!code) return false
  const key = `${STAY_PREFIX}${code.toUpperCase()}`
  return window.localStorage.getItem(key) === '1'
}

export function clearStayInLobby(code: string) {
  if (!code) return
  const key = `${STAY_PREFIX}${code.toUpperCase()}`
  window.localStorage.removeItem(key)
}
