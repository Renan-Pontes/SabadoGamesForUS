import { Box, Button, Typography } from '@mui/material'
import { nameOf } from '../engine/helpers'
import type { PlaceholderState } from '../engine/placeholder'
import type { HalloweenGameMeta, HalloweenViewProps } from '../engine/types'
import { useCountdown } from './clockHooks'

/**
 * Telas provisórias dos jogos ainda em construção (a Etapa 2 troca pelas de
 * verdade). Bastam para testar a sala inteira: começar, responder, terminar.
 */

type Props = HalloweenViewProps<PlaceholderState> & { meta: HalloweenGameMeta }

export function PlaceholderTv({ meta, state, players, now }: Props) {
  const { seconds } = useCountdown(state.deadline, now)
  const done = new Set(state.acted)
  return (
    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <Box>
        <Typography sx={{ fontSize: 'clamp(5rem, 9vw, 8rem)', lineHeight: 1 }}>{meta.icon}</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.5rem, 6vw, 6rem)', color: meta.accent.main }}>
          {state.over ? 'Fim do ensaio!' : 'Em construção 🚧'}
        </Typography>
        <Typography sx={{ fontSize: 'clamp(1.8rem, 2.6vw, 2.6rem)', color: 'var(--text-secondary)', mb: 3 }}>
          {state.over
            ? 'Os fantasmas ainda estão montando este jogo.'
            : `Toquem "Estou vivo" no celular${seconds !== null ? ` · ${seconds}s` : ''}`}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
          {state.roster.map((id) => (
            <Box
              key={id}
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: 'var(--radius-full)',
                border: `3px solid ${done.has(id) ? meta.accent.main : 'var(--border-medium)'}`,
                fontSize: 'clamp(1.6rem, 2vw, 2rem)',
                fontWeight: 700,
              }}
            >
              {done.has(id) ? '✓ ' : ''}
              {nameOf(players, id)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export function PlaceholderPhone({ meta, state, myInput, send }: Props) {
  return (
    <Box sx={{ textAlign: 'center', pt: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <Typography sx={{ fontSize: '4rem', lineHeight: 1 }}>{meta.icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
        {state.over ? 'Fim do ensaio' : 'Jogo em construção'}
      </Typography>
      {!state.over && (
        <Button
          variant="contained"
          disabled={Boolean(myInput)}
          onClick={() => send({ alive: true })}
          sx={{ minHeight: 64, minWidth: 240, fontSize: '1.3rem', fontWeight: 800, background: meta.accent.main, color: meta.accent.contrast }}
        >
          {myInput ? '✓ Anotado!' : '👻 Estou vivo'}
        </Button>
      )}
    </Box>
  )
}
