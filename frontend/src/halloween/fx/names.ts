import { getRoom } from '../../lib/api'
import type { Player } from '../../lib/types'

/**
 * Nomes da sala para os sustos que usam nome (zoom suspeito, olhos no
 * escuro), quando o jogo não informou nenhum. Busca uma vez por minuto no
 * máximo — o susto pode esperar meio segundo, o PythonAnywhere agradece.
 */

const TTL_MS = 60_000

let cache: { code: string; at: number; names: string[] } | null = null

function nameOf(player: Player) {
  return (player.name || player.user?.profile?.nickname || player.user?.username || '').trim()
}

export async function roomPlayerNames(code: string): Promise<string[]> {
  if (cache && cache.code === code && Date.now() - cache.at < TTL_MS) return cache.names
  try {
    const room = await getRoom(code)
    const players = room.players ?? []
    // Prefere quem está online: zoom em quem foi embora não tem graça.
    const online = players.filter((player) => player.online !== false)
    const names = (online.length ? online : players).map(nameOf).filter(Boolean)
    cache = { code, at: Date.now(), names }
    return names
  } catch {
    return cache?.code === code ? cache.names : []
  }
}
