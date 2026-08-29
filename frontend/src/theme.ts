import { createTheme } from '@mui/material/styles'

/**
 * Tema MUI do Sabado Games.
 *
 * Regra geral: o tema cuida dos controles (botões, campos, diálogos). A
 * aparência de card fica com `components/ui/Panel` — por isso não há override
 * global de `MuiPaper` aqui: ele também atingia `Alert` e `Menu`, brigando com
 * as cores de severidade.
 */
export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#dc2626', light: '#ef4444', dark: '#991b1b' },
    secondary: { main: '#d4a520', light: '#fbbf24', dark: '#a16207' },
    background: { default: '#0a0a0f', paper: '#12121a' },
    text: { primary: '#f5f5f5', secondary: '#a0a0a0' },
    error: { main: '#dc2626' },
    success: { main: '#22c55e' },
    warning: { main: '#eab308' },
    info: { main: '#22d3ee' },
    divider: 'rgba(42, 42, 58, 0.9)',
  },

  typography: {
    fontFamily: '"Rajdhani", sans-serif',
    h1: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.1em' },
    h2: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.1em' },
    h3: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.08em' },
    h4: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.05em' },
    h5: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.05em' },
    h6: { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.05em' },
    button: { fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, letterSpacing: '0.05em' },
  },

  shape: { borderRadius: 12 },

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontWeight: 700,
          padding: '12px 24px',
          fontSize: '0.98rem',
          borderRadius: 12,
          transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
          '&:active': { transform: 'translateY(1px) scale(0.99)' },
          '&.Mui-disabled': {
            // O padrão do MUI some demais; aqui precisa continuar legível.
            color: 'rgba(245, 245, 245, 0.32)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
        contained: {
          backgroundImage:
            'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(153, 27, 27, 0.95))',
          boxShadow: '0 6px 20px rgba(220, 38, 38, 0.32)',
          '&:hover': { boxShadow: '0 8px 26px rgba(220, 38, 38, 0.45)', filter: 'brightness(1.06)' },
          '&.Mui-disabled': { backgroundImage: 'none', background: 'rgba(255,255,255,0.06)' },
        },
        containedSecondary: {
          backgroundImage:
            'linear-gradient(135deg, rgba(212, 165, 32, 0.95), rgba(161, 98, 7, 0.95))',
          boxShadow: '0 6px 20px rgba(212, 165, 32, 0.3)',
          color: '#0a0a0f',
        },
        containedSuccess: {
          backgroundImage: 'linear-gradient(135deg, #22c55e, #15803d)',
          color: '#04160b',
        },
        containedWarning: {
          backgroundImage: 'linear-gradient(135deg, #eab308, #a16207)',
          color: '#1a1204',
        },
        outlined: {
          borderWidth: 2,
          borderColor: 'rgba(212, 165, 32, 0.45)',
          '&:hover': {
            borderWidth: 2,
            borderColor: 'rgba(212, 165, 32, 0.9)',
            boxShadow: '0 0 20px rgba(212, 165, 32, 0.22)',
          },
        },
        text: { padding: '8px 16px' },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", monospace',
            backgroundColor: 'rgba(12, 12, 18, 0.75)',
            backdropFilter: 'blur(6px)',
            '& fieldset': { borderColor: '#2a2a3a', borderWidth: 2 },
            '&:hover fieldset': { borderColor: '#d4a520' },
            '&.Mui-focused fieldset': { borderColor: '#d4a520', borderWidth: 2 },
          },
          '& .MuiFormHelperText-root': { fontSize: '0.72rem', marginLeft: 2 },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#12121a',
          backgroundImage: 'linear-gradient(165deg, rgba(26,26,36,0.96), rgba(10,10,15,0.98))',
          border: '1px solid rgba(42, 42, 58, 0.9)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65)',
          borderRadius: 16,
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: '1px solid transparent', fontWeight: 600 },
        standardError: {
          background: 'rgba(220, 38, 38, 0.14)',
          borderColor: 'rgba(220, 38, 38, 0.4)',
          color: '#fca5a5',
        },
        standardSuccess: {
          background: 'rgba(34, 197, 94, 0.14)',
          borderColor: 'rgba(34, 197, 94, 0.4)',
          color: '#86efac',
        },
        standardWarning: {
          background: 'rgba(234, 179, 8, 0.14)',
          borderColor: 'rgba(234, 179, 8, 0.4)',
          color: '#fde047',
        },
        standardInfo: {
          background: 'rgba(34, 211, 238, 0.12)',
          borderColor: 'rgba(34, 211, 238, 0.4)',
          color: '#a5f3fc',
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: { height: 6 },
        thumb: {
          '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 10px rgba(212, 165, 32, 0.16)' },
        },
        rail: { opacity: 0.22 },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(10, 10, 15, 0.96)',
          border: '1px solid rgba(42, 42, 58, 0.9)',
          fontSize: '0.75rem',
          fontWeight: 600,
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { transition: 'color 180ms ease, border-color 180ms ease, background 180ms ease' },
      },
    },

    MuiCircularProgress: {
      styleOverrides: { root: { color: '#d4a520' } },
    },
  },
})

export default appTheme
