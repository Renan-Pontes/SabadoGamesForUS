import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { Game } from '../../lib/types'
import { getGameMeta } from '../../lib/gameCatalog'
import type { GameMeta } from '../../lib/gameCatalog'
import GameTile from './GameTile'

type Shelf = {
  key: string
  title: string
  blurb: string
  icon: string
  match: (game: Game, meta: GameMeta) => boolean
}

/**
 * As prateleiras. A ordem importa: a primeira é o que a mesa vê primeiro.
 * Um jogo pode aparecer em mais de uma — "A Caçada" é tabuleiro na TV e
 * também dedução.
 */
const SHELVES: Shelf[] = [
  {
    key: 'tv',
    title: 'Tabuleiro na TV',
    blurb: 'A TV é o tabuleiro de verdade. O celular é o seu controle.',
    icon: '📺',
    match: (game) =>
      ['a-cacada', 'palavra-chave', 'perfil', 'future-sugoroku', 'corrida-de-camelos', 'nao-para'].includes(game.slug),
  },
  {
    key: 'race',
    title: 'Dados e corrida',
    blurb: 'Sorte, risco e um tabuleiro que anda.',
    icon: '🎲',
    match: (_game, meta) => meta.vibe === 'Corrida',
  },
  {
    key: 'bluff',
    title: 'Blefe e traição',
    blurb: 'Alguém na mesa está mentindo. Talvez você.',
    icon: '🎭',
    match: (_game, meta) => meta.vibe === 'Blefe',
  },
  {
    key: 'deduction',
    title: 'Dedução',
    blurb: 'Junte as pistas antes dos outros.',
    icon: '🔍',
    match: (_game, meta) => meta.vibe === 'Dedução',
  },
  {
    key: 'words',
    title: 'Palavras e conversa',
    blurb: 'Vence quem fala melhor — ou quem escuta melhor.',
    icon: '💬',
    match: (game) => ['sintonia', 'palavra-chave', 'camaleao', 'perfil', 'o-infiltrado'].includes(game.slug),
  },
  {
    key: 'quick',
    title: 'Rápidos',
    blurb: 'Menos de 15 minutos. Bom para abrir ou fechar a noite.',
    icon: '⚡',
    match: (_game, meta) => /^(\d+)/.test(meta.duration) && Number(meta.duration.match(/^(\d+)/)?.[1] ?? 99) <= 10,
  },
  {
    key: 'coop',
    title: 'Cooperativos',
    blurb: 'Todo mundo contra o jogo.',
    icon: '🤝',
    match: (_game, meta) => meta.vibe === 'Cooperativo',
  },
  {
    key: 'big',
    title: 'Mesa cheia',
    blurb: 'Para 8 pessoas ou mais.',
    icon: '👥',
    match: (game) => game.max_players >= 10,
  },
]

type GameShelvesProps = {
  games: Game[]
  selectedId?: number | null
  onSelect?: (game: Game) => void
  /** Motivo para um jogo aparecer apagado (ex.: gente demais na sala). */
  disabledReason?: (game: Game) => string | undefined
}

/**
 * Catálogo em prateleiras com rolagem horizontal, como uma locadora.
 * A mesma tile pode aparecer em mais de uma prateleira: o que muda é o
 * ângulo pelo qual a pessoa está procurando um jogo.
 */
export default function GameShelves({ games, selectedId, onSelect, disabledReason }: GameShelvesProps) {
  const shelves = useMemo(
    () =>
      SHELVES.map((shelf) => ({
        ...shelf,
        games: games.filter((game) => shelf.match(game, getGameMeta(game.slug))),
      })).filter((shelf) => shelf.games.length > 0),
    [games],
  )

  // Tudo que nao entrou em nenhuma prateleira vai para a ultima, para nao sumir.
  const shelved = new Set(shelves.flatMap((shelf) => shelf.games.map((game) => game.id)))
  const leftovers = games.filter((game) => !shelved.has(game.id))

  const all = leftovers.length
    ? [...shelves, { key: 'more', title: 'Outros', blurb: 'O resto do acervo.', icon: '🎲', games: leftovers }]
    : shelves

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {all.map((shelf, shelfIndex) => (
        <Box key={shelf.key} className="stagger-in" style={{ '--stagger-index': shelfIndex } as React.CSSProperties}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 1.25, px: 0.5 }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>{shelf.icon}</Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.3rem', md: '1.6rem' },
                letterSpacing: '0.08em',
                color: 'var(--text-primary)',
              }}
            >
              {shelf.title.toUpperCase()}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: { xs: 'none', sm: 'block' } }}>
              {shelf.blurb}
            </Typography>
            <Typography sx={{ ml: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {shelf.games.length}
            </Typography>
          </Box>

          {/* A prateleira em si: rola na horizontal, com a borda sugerindo continuacao */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              width: 0,
              minWidth: '100%',
              pb: 1.5,
              px: 0.5,
              scrollSnapType: 'x proximity',
              maskImage: 'linear-gradient(90deg, #000 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, #000 92%, transparent)',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { background: 'var(--border-medium)', borderRadius: 3 },
            }}
          >
            {shelf.games.map((game, index) => (
              <Box
                key={`${shelf.key}-${game.id}`}
                sx={{ flex: '0 0 auto', width: { xs: 240, md: 280 }, scrollSnapAlign: 'start' }}
              >
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
        </Box>
      ))}
    </Box>
  )
}
