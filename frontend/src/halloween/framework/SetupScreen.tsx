import { useState, type CSSProperties } from 'react'
import { Box, Button, Typography } from '@mui/material'
import type { HPlayer, HalloweenGameMeta, HalloweenOptionValue } from '../engine/types'
import { sanitizeOptions } from '../engine/helpers'

/**
 * Telas de configuração, iguais para todos os jogos: a TV explica o jogo
 * em letras grandes, o host escolhe as opções e aperta "Começar", e o resto
 * da mesa é mandado olhar para a TV.
 */

function onlineCount(players: readonly HPlayer[]) {
  return players.filter((player) => player.online).length
}

/** TV: nome, frase e "Como jogar" bem grandes, mais quem está na sala. */
export function TvSetupScreen({
  meta,
  players,
  error,
}: {
  meta: HalloweenGameMeta
  players: HPlayer[]
  error?: string | null
}) {
  const online = onlineCount(players)
  const missing = Math.max(0, meta.minPlayers - online)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1.15fr' },
          gap: { xs: 3, lg: 6 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ textAlign: { xs: 'center', lg: 'left' } }} className="animate-pop-in">
          <Box aria-hidden className="animate-wobble" sx={{ fontSize: 'clamp(5rem, 10vw, 9rem)', lineHeight: 1, display: 'inline-block' }}>
            {meta.icon}
          </Box>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(4rem, 7.5vw, 7.5rem)',
              lineHeight: 0.95,
              color: meta.accent.main,
              textShadow: `0 0 34px ${meta.accent.glow}`,
              mt: 1,
            }}
          >
            {meta.name}
          </Typography>
          <Typography sx={{ fontSize: 'clamp(1.8rem, 2.8vw, 2.8rem)', color: 'var(--text-primary)', mt: 2, lineHeight: 1.2 }}>
            {meta.pitch}
          </Typography>
        </Box>

        <Box
          sx={{
            borderRadius: 'var(--radius-xl)',
            border: `2px solid ${meta.accent.main}55`,
            background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
            p: { xs: 3, md: 4 },
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 3.6vw, 3.6rem)',
              color: meta.accent.light,
              mb: 2,
              lineHeight: 1,
            }}
          >
            Como jogar
          </Typography>
          <Box component="ol" sx={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {meta.howTo.map((step, index) => (
              <Box
                component="li"
                key={step}
                className="stagger-in"
                style={{ '--stagger-index': index } as CSSProperties}
                sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}
              >
                <Box
                  component="span"
                  sx={{
                    fontFamily: 'var(--font-numeric, var(--font-display))',
                    fontSize: 'clamp(2rem, 3vw, 3rem)',
                    color: meta.accent.main,
                    minWidth: '1.4ch',
                    lineHeight: 1,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ fontSize: 'clamp(1.75rem, 2.5vw, 2.5rem)', lineHeight: 1.2, color: 'var(--text-primary)' }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 'clamp(1.6rem, 2.2vw, 2.2rem)', color: 'var(--text-secondary)', mb: 1.5 }}>
          Na sala ({online}) · {missing > 0 ? `faltam ${missing} para começar` : 'o host aperta “Começar” no celular'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {players.map((player) => (
            <Box
              key={player.id}
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: 'var(--radius-full)',
                border: `2px solid ${player.online ? meta.accent.main : 'var(--border-medium)'}`,
                color: player.online ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 'clamp(1.6rem, 2vw, 2rem)',
                fontWeight: 700,
                opacity: player.online ? 1 : 0.55,
              }}
            >
              {player.isHost ? '👑 ' : ''}
              {player.name}
            </Box>
          ))}
        </Box>
        {error && (
          <Typography sx={{ mt: 2, fontSize: '1.8rem', color: 'var(--accent-red-light)' }}>⚠️ {error}</Typography>
        )}
      </Box>
    </Box>
  )
}

/** Host: as opções do jogo e o botão "Começar". */
export function HostSetupScreen({
  meta,
  players,
  initialOptions,
  error,
  onBegin,
  onBackToRoom,
}: {
  meta: HalloweenGameMeta
  players: HPlayer[]
  initialOptions: Record<string, unknown> | null | undefined
  error?: string | null
  onBegin: (options: Record<string, HalloweenOptionValue>) => void
  onBackToRoom: () => void
}) {
  const [chosen, setChosen] = useState(() => sanitizeOptions(meta.options, initialOptions))
  const [sentAt, setSentAt] = useState<number | null>(null)
  const online = onlineCount(players)
  const missing = Math.max(0, meta.minPlayers - online)
  // Trava o botão por uns segundos depois do toque: o juiz leva ~1 s para
  // começar, e um segundo toque não pode virar dois "Começar".
  const starting = sentAt !== null

  const begin = () => {
    setSentAt(Date.now())
    onBegin(chosen)
    setTimeout(() => setSentAt(null), 4000)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 560, width: '100%', mx: 'auto' }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{meta.tagline}</Typography>
        <Typography sx={{ fontSize: '0.95rem', color: 'var(--text-muted)', mt: 0.5 }}>
          A TV está mostrando as regras para a mesa.
        </Typography>
      </Box>

      {meta.options.map((option) => (
        <Box key={option.key}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', mb: 0.25 }}>{option.label}</Typography>
          {option.help && (
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', mb: 0.75 }}>{option.help}</Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {option.choices.map((choice) => {
              const selected = chosen[option.key] === choice.value
              return (
                <Button
                  key={String(choice.value)}
                  variant={selected ? 'contained' : 'outlined'}
                  onClick={() => setChosen((current) => ({ ...current, [option.key]: choice.value }))}
                  sx={{
                    minHeight: 48,
                    minWidth: 72,
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderColor: meta.accent.main,
                    color: selected ? meta.accent.contrast : meta.accent.light,
                    background: selected ? meta.accent.main : 'transparent',
                    '&:hover': { background: selected ? meta.accent.main : `${meta.accent.main}22`, borderColor: meta.accent.light },
                  }}
                >
                  {choice.label}
                </Button>
              )
            })}
          </Box>
        </Box>
      ))}

      {error && (
        <Typography sx={{ color: 'var(--accent-red-light)', fontWeight: 600 }}>⚠️ {error}</Typography>
      )}

      <Button
        variant="contained"
        size="large"
        disabled={missing > 0 || starting}
        onClick={begin}
        sx={{
          minHeight: 64,
          fontSize: '1.4rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          background: meta.accent.main,
          color: meta.accent.contrast,
          boxShadow: `0 0 28px ${meta.accent.glow}`,
          '&:hover': { background: meta.accent.light },
        }}
      >
        {starting ? 'Começando…' : missing > 0 ? `Faltam ${missing} 👻` : `${meta.icon} Começar`}
      </Button>
      <Typography sx={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        {online} online · {meta.minPlayers} a {meta.maxPlayers} pessoas · {meta.duration}
      </Typography>
      <Button variant="text" color="inherit" onClick={onBackToRoom} sx={{ color: 'var(--text-secondary)' }}>
        🚪 Voltar à sala (trocar de jogo)
      </Button>
    </Box>
  )
}

/** Quem não é host: olhe para a TV. */
export function PlayerSetupScreen({ meta }: { meta: HalloweenGameMeta }) {
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', pt: 4 }}>
      <Box aria-hidden className="animate-ghost" sx={{ fontSize: '4.5rem', lineHeight: 1 }}>
        📺
      </Box>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1 }}>
        Leia as regras na TV
      </Typography>
      <Typography sx={{ color: 'var(--text-secondary)', maxWidth: 360 }}>
        O host está escolhendo as opções. Quando ele apertar “Começar”, o jogo aparece aqui.
      </Typography>
      <Box component="ol" sx={{ textAlign: 'left', maxWidth: 380, pl: 3, color: 'var(--text-secondary)', mt: 1 }}>
        {meta.howTo.map((step) => (
          <Typography component="li" key={step} sx={{ mb: 0.75, fontSize: '1rem' }}>
            {step}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
