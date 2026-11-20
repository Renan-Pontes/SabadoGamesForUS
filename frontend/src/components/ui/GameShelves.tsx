import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Box, Typography } from '@mui/material'
import type { Game } from '../../lib/types'
import { splitSeason } from '../../season'
import GameTile from './GameTile'

type GameShelvesProps = {
  /** Todos os jogos; a vitrine de Natal sai de `season.ts`, o resto vai para "Old". */
  games: Game[]
  selectedId?: number | null
  onSelect?: (game: Game) => void
  /** Motivo para um jogo aparecer apagado (ex.: gente demais na sala). */
  disabledReason?: (game: Game) => string | undefined
}

/**
 * A vitrine de Natal: poucos jogos, todos simples, todos à vista.
 *
 * Antes eram várias prateleiras (Noite do Terror + acervo antigo agrupado por
 * vibe). Com o catálogo enxugado (`season.ts`) virou uma grade só — no
 * celular rola na horizontal, no computador cabe tudo na tela. Os outros jogos
 * não sumiram: ficam na gaveta "Old", fechada, embaixo.
 */
export default function GameShelves({ games: all, selectedId, onSelect, disabledReason }: GameShelvesProps) {
  const { season: games, old } = useMemo(() => splitSeason(all), [all])
  // A gaveta "Old" abre sozinha se o jogo escolhido estiver lá dentro.
  const oldSelected = old.some((game) => game.id === selectedId)
  const [oldOpen, setOldOpen] = useState(false)
  const showOld = oldOpen || oldSelected

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    {games.length > 0 && (
    <Box className="stagger-in" style={{ '--stagger-index': 0 } as CSSProperties}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5, px: 0.5, flexWrap: 'wrap' }}>
        <Typography aria-hidden className="animate-hop" sx={{ fontSize: '1.9rem', lineHeight: 1 }}>
          🎄
        </Typography>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h3"
            sx={{
              fontFamily: 'var(--font-festive)',
              fontWeight: 700,
              fontSize: { xs: '1.9rem', md: '2.4rem' },
              lineHeight: 1,
              color: 'var(--accent-gold)',
              textShadow: '0 0 22px rgba(245, 194, 66, 0.4)',
            }}
          >
            Jogos de Natal
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.86rem', mt: 0.25 }}>
            Regras curtinhas, até 15 pessoas. Escolha um e chame a galera.
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {games.length}
        </Typography>
      </Box>

      {/* Celular: rola na horizontal. Computador: grade com todos à vista. */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'grid' },
          gridTemplateColumns: { md: 'repeat(auto-fill, minmax(240px, 1fr))' },
          gap: 2,
          overflowX: { xs: 'auto', md: 'visible' },
          width: { xs: 0, md: 'auto' },
          minWidth: '100%',
          pb: 1.5,
          px: 0.5,
          scrollSnapType: 'x proximity',
          maskImage: { xs: 'linear-gradient(90deg, #000 90%, transparent)', md: 'none' },
          WebkitMaskImage: { xs: 'linear-gradient(90deg, #000 90%, transparent)', md: 'none' },
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { background: 'var(--xmas-green)', borderRadius: 3 },
        }}
      >
        {games.map((game, index) => (
          <Box
            key={game.id}
            sx={{ flex: { xs: '0 0 auto', md: 'initial' }, width: { xs: 262, md: 'auto' }, scrollSnapAlign: 'start' }}
          >
            <GameTile
              game={game}
              index={index}
              featured
              selected={game.id === selectedId}
              disabledReason={disabledReason?.(game)}
              onSelect={onSelect}
            />
          </Box>
        ))}
      </Box>
    </Box>
    )}

    {old.length > 0 && (
      <Box>
        <Box
          component="button"
          type="button"
          onClick={() => setOldOpen((open) => !open)}
          aria-expanded={showOld}
          sx={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            width: '100%',
            px: 0.5,
            py: 0.75,
            color: 'var(--text-muted)',
            '&:hover': { color: 'var(--text-secondary)' },
            '&:focus-visible': { outline: '2px solid var(--accent-gold)', borderRadius: 1 },
          }}
        >
          <Typography aria-hidden sx={{ fontSize: '1.2rem', lineHeight: 1 }}>
            📦
          </Typography>
          <Typography sx={{ fontWeight: 800, letterSpacing: '0.18em', fontSize: '0.78rem' }}>
            OLD · JOGOS ANTIGOS
          </Typography>
          <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border-medium), transparent)' }} />
          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            {old.length} {showOld ? '▲' : '▼'}
          </Typography>
        </Box>

        {showOld && (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              width: 0,
              minWidth: '100%',
              pt: 1,
              pb: 1.5,
              px: 0.5,
              scrollSnapType: 'x proximity',
              maskImage: 'linear-gradient(90deg, #000 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, #000 92%, transparent)',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { background: 'var(--border-medium)', borderRadius: 3 },
            }}
          >
            {old.map((game, index) => (
              <Box key={game.id} sx={{ flex: '0 0 auto', width: { xs: 230, md: 260 }, scrollSnapAlign: 'start' }}>
                <GameTile
                  game={game}
                  index={index}
                  selected={game.id === selectedId}
                  disabledReason={disabledReason?.(game)}
                  onSelect={onSelect}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )}
    </Box>
  )
}
