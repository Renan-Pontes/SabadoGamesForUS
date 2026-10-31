import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { withAlpha } from '../../components/ui/surfaces'

type ActionPanelProps = {
  title: ReactNode
  hint?: ReactNode
  accent: string
  /** Bloqueia a interação e explica o motivo. */
  lockedReason?: ReactNode
  children: ReactNode
}

/**
 * Painel de ação do jogador. É a única coisa que importa na tela do celular,
 * então ganha borda acesa, brilho do acento e destaque acima de tudo.
 */
export default function ActionPanel({
  title,
  hint,
  accent,
  lockedReason,
  children,
}: ActionPanelProps) {
  return (
    <Box
      // Painel liberado = é a sua vez. A borda respira para o celular
      // chamar atenção sem precisar de som.
      className={lockedReason ? undefined : 'your-turn'}
      // withAlpha: alguns jogos passam `var(--status-ready)` como acento, e
      // `${accent}80` virava CSS inválido (painel sem fundo nem brilho).
      style={{ '--turn-color': withAlpha(accent, 0.5) } as React.CSSProperties}
      sx={{
        mt: 3,
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${lockedReason ? 'rgba(255,255,255,0.1)' : accent}`,
        background: lockedReason
          ? 'linear-gradient(160deg, rgba(24, 14, 40, 0.9), rgba(12, 7, 22, 0.94))'
          : `linear-gradient(160deg, ${withAlpha(accent, 0.1)}, rgba(12, 7, 22, 0.95))`,
        boxShadow: lockedReason ? 'none' : `0 20px 50px rgba(0,0,0,0.45), 0 0 40px ${withAlpha(accent, 0.14)}`,
        p: { xs: 2.5, md: 3 },
        // As duas animações juntas: o `animation` daqui apagava a do
        // `.your-turn` (o CSS do componente vem depois do index.css).
        animation: lockedReason
          ? 'popIn 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards'
          : 'popIn 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards, turnBreath 2.2s ease-in-out 420ms infinite',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          letterSpacing: '0.05em',
          color: lockedReason ? 'var(--text-muted)' : accent,
        }}
      >
        {title}
      </Typography>

      {hint && (
        <Typography sx={{ mt: 0.5, mb: 2, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {hint}
        </Typography>
      )}

      {lockedReason ? (
        <Typography
          sx={{
            mt: hint ? 0 : 2,
            p: 2,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {lockedReason}
        </Typography>
      ) : (
        <Box sx={{ mt: hint ? 0 : 2 }}>{children}</Box>
      )}
    </Box>
  )
}
