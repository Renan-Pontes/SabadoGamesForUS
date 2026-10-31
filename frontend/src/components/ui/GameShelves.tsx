import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { Game } from '../../lib/types'
import { getGameMeta } from '../../lib/gameCatalog'
import type { GameMeta } from '../../lib/gameCatalog'
import { HALLOWEEN_SLUGS, isHalloweenSlug } from '../../halloween/slugs'
import GameTile from './GameTile'

type Shelf = {
  key: string
  title: string
  blurb: string
  icon: string
  match: (game: Game, meta: GameMeta) => boolean
}

/**
 * As prateleiras do acervo antigo. A ordem importa: a primeira é o que a mesa
 * vê primeiro. Um jogo pode aparecer em mais de uma — "A Caçada" é tabuleiro
 * na TV e também dedução.
 *
 * Os jogos da Noite do Terror ficam de fora daqui: eles têm a prateleira
 * própria, em destaque, acima de todas (veja `GameShelves`).
 */
const SHELVES: Shelf[] = [
  {
    key: 'tv',
    title: 'Tabuleiro na TV',
    blurb: 'A TV é o tabuleiro de verdade. O celular é o seu controle.',
    icon: '📺',
    match: (game) =>
      [
        'a-cacada',
        'palavra-chave',
        'perfil',
        'future-sugoroku',
        'corrida-de-camelos',
        'nao-para',
        'palpite-certo',
        'artista-falso',
        'bomba-relogio',
        'muralhas',
        'desenha-e-adivinha',
        'so-uma',
        'manada',
        'quiz-da-mesa',
      ].includes(game.slug),
  },
  {
    key: 'race',
    title: 'Dados e corrida',
    blurb: 'Sorte, risco e um tabuleiro que anda.',
    icon: '🎲',
    match: (_game, meta) => meta.vibe === 'Corrida',
  },
  {
    key: 'strategy',
    title: 'Estratégia',
    blurb: 'Pense dois lances à frente. A sorte ajuda pouco aqui.',
    icon: '♟️',
    match: (game, meta) => meta.vibe === 'Estratégia' || ['a-cacada', 'palavra-chave', 'nao-para'].includes(game.slug),
  },
  {
    key: 'casino',
    title: 'Cassino',
    blurb: 'Fichas na mesa. Quem aposta melhor leva.',
    icon: '🎰',
    match: (game, meta) =>
      meta.vibe === 'Aposta' || ['corrida-de-camelos', 'leilao-de-cem-votos', 'blef-jack'].includes(game.slug),
  },
  {
    key: 'party',
    title: 'Festa',
    blurb: 'Barulho, pressa e risada. Sem regra para decorar.',
    icon: '🎉',
    match: (game, meta) => meta.vibe === 'Festa' || ['artista-falso', 'sintonia'].includes(game.slug),
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

type ShelfView = { key: string; title: string; blurb: string; icon: string; games: Game[] }

/**
 * Catálogo em prateleiras com rolagem horizontal, como uma locadora.
 * A mesma tile pode aparecer em mais de uma prateleira: o que muda é o
 * ângulo pelo qual a pessoa está procurando um jogo.
 *
 * Primeiro vem a "🎃 Noite do Terror" com os 10 jogos novos, em destaque (no
 * computador vira uma grade com todos à vista); o acervo antigo segue abaixo.
 */
export default function GameShelves({ games, selectedId, onSelect, disabledReason }: GameShelvesProps) {
  // Na ordem de `HALLOWEEN_SLUGS` — a ordem em que a mesa deve conhecê-los.
  const halloween = useMemo(
    () =>
      HALLOWEEN_SLUGS.map((slug) => games.find((game) => game.slug === slug)).filter(
        (game): game is Game => Boolean(game),
      ),
    [games],
  )

  const classic = useMemo(() => games.filter((game) => !isHalloweenSlug(game.slug)), [games])

  const shelves = useMemo<ShelfView[]>(() => {
    const matched = SHELVES.map((shelf) => ({
      key: shelf.key,
      title: shelf.title,
      blurb: shelf.blurb,
      icon: shelf.icon,
      games: classic.filter((game) => shelf.match(game, getGameMeta(game.slug))),
    })).filter((shelf) => shelf.games.length > 0)

    // Tudo que nao entrou em nenhuma prateleira vai para a ultima, para nao sumir.
    const shelved = new Set(matched.flatMap((shelf) => shelf.games.map((game) => game.id)))
    const leftovers = classic.filter((game) => !shelved.has(game.id))
    return leftovers.length
      ? [...matched, { key: 'more', title: 'Outros', blurb: 'O resto do acervo.', icon: '🎲', games: leftovers }]
      : matched
  }, [classic])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {halloween.length > 0 && (
        <Box className="stagger-in" style={{ '--stagger-index': 0 } as React.CSSProperties}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              mb: 1.5,
              px: 0.5,
              flexWrap: 'wrap',
            }}
          >
            <Typography aria-hidden className="animate-wobble" sx={{ fontSize: '1.9rem', lineHeight: 1 }}>
              🎃
            </Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="h3"
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: { xs: '1.65rem', md: '2.1rem' },
                  lineHeight: 1,
                  letterSpacing: '0.06em',
                  color: 'var(--pumpkin)',
                  textShadow: '0 0 22px rgba(255, 123, 28, 0.45)',
                }}
              >
                NOITE DO TERROR
              </Typography>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.86rem', mt: 0.25 }}>
                Os jogos novos da festa. Regras curtinhas, até 15 pessoas.
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {halloween.length}
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
              '&::-webkit-scrollbar-thumb': { background: 'var(--pumpkin-dark)', borderRadius: 3 },
            }}
          >
            {halloween.map((game, index) => (
              <Box
                key={`halloween-${game.id}`}
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

      {shelves.length > 0 && halloween.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5, mt: -0.5 }}>
          <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-medium))' }} />
          <Typography
            sx={{ fontSize: '0.66rem', letterSpacing: '0.24em', fontWeight: 800, color: 'var(--text-muted)' }}
          >
            O ACERVO DE SEMPRE
          </Typography>
          <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border-medium), transparent)' }} />
        </Box>
      )}

      {shelves.map((shelf, shelfIndex) => (
        <Box
          key={shelf.key}
          className="stagger-in"
          style={{ '--stagger-index': shelfIndex + 1 } as React.CSSProperties}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 1.25, px: 0.5 }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>{shelf.icon}</Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: { xs: '1.3rem', md: '1.55rem' },
                letterSpacing: '0.06em',
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
