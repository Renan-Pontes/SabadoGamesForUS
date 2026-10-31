import { createTheme } from '@mui/material/styles'

/**
 * Tema MUI do Sabado Games — Noite do Terror.
 *
 * Regra geral: o tema cuida dos controles (botões, campos, diálogos). A
 * aparência de card fica com `components/ui/Panel` — por isso não há override
 * global de `MuiPaper` aqui: ele também atingia `Alert` e `Menu`, brigando com
 * as cores de severidade.
 *
 * As cores repetem as variáveis de `index.css` em hexadecimal porque o MUI
 * calcula contraste e variações a partir delas (e não entende `var(--...)`).
 */
const PUMPKIN = { main: '#ff7b1c', light: '#ffa24a', dark: '#c2410c', contrastText: '#1a0b02' }
const WITCH = { main: '#9b4dff', light: '#b06bff', dark: '#6a1fc2', contrastText: '#ffffff' }
const SLIME = { main: '#8cf045', light: '#b4f77e', dark: '#4d9e1d', contrastText: '#0b1a03' }
const BLOOD = { main: '#e0213a', light: '#ff4d63', dark: '#8f0b1d', contrastText: '#ffffff' }
const CANDLE = { main: '#ffc94a', light: '#ffdb85', dark: '#c98a12', contrastText: '#1f1402' }
const ECTO = { main: '#4fe6d0', light: '#8ff2e3', dark: '#1fa592', contrastText: '#03201b' }

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: PUMPKIN,
    secondary: WITCH,
    background: { default: '#0a0612', paper: '#130b20' },
    text: { primary: '#f3eeff', secondary: '#bcb0d4' },
    error: BLOOD,
    success: SLIME,
    warning: CANDLE,
    info: ECTO,
    divider: 'rgba(63, 43, 94, 0.8)',
  },

  typography: {
    fontFamily: '"Rajdhani", sans-serif',
    h1: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.06em' },
    h2: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.06em' },
    h3: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.05em' },
    h4: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.04em' },
    h5: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.04em' },
    h6: { fontFamily: '"Creepster", "Bebas Neue", cursive', letterSpacing: '0.04em' },
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
            color: 'rgba(243, 238, 255, 0.34)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
        // Abóbora acesa: gradiente laranja com texto escuro (branco em
        // laranja não passa no contraste, e a TV fica longe).
        contained: {
          backgroundImage: 'linear-gradient(135deg, #ffa24a 0%, #ff7b1c 45%, #d9480f 100%)',
          boxShadow: '0 6px 22px rgba(255, 123, 28, 0.34), inset 0 -2px 0 rgba(0, 0, 0, 0.18)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(255, 123, 28, 0.5), inset 0 -2px 0 rgba(0, 0, 0, 0.18)',
            filter: 'brightness(1.07)',
          },
          '&.Mui-disabled': { backgroundImage: 'none', background: 'rgba(255,255,255,0.06)', boxShadow: 'none' },
        },
        containedSecondary: {
          backgroundImage: 'linear-gradient(135deg, #b06bff 0%, #8b3fd9 55%, #5b1aa8 100%)',
          boxShadow: '0 6px 22px rgba(139, 63, 217, 0.4), inset 0 -2px 0 rgba(0, 0, 0, 0.2)',
          color: '#ffffff',
          '&:hover': { boxShadow: '0 8px 30px rgba(139, 63, 217, 0.55)' },
        },
        containedSuccess: {
          backgroundImage: 'linear-gradient(135deg, #b4f77e, #8cf045 50%, #4d9e1d)',
          boxShadow: '0 6px 22px rgba(140, 240, 69, 0.3)',
          color: '#0b1a03',
          '&:hover': { boxShadow: '0 8px 30px rgba(140, 240, 69, 0.45)' },
        },
        containedWarning: {
          backgroundImage: 'linear-gradient(135deg, #ffdb85, #ffc94a 50%, #c98a12)',
          boxShadow: '0 6px 22px rgba(255, 201, 74, 0.3)',
          color: '#1f1402',
        },
        containedError: {
          backgroundImage: 'linear-gradient(135deg, #ff4d63, #e0213a 50%, #8f0b1d)',
          boxShadow: '0 6px 22px rgba(224, 33, 58, 0.36)',
          color: '#ffffff',
        },
        containedInfo: {
          backgroundImage: 'linear-gradient(135deg, #8ff2e3, #4fe6d0 50%, #1fa592)',
          boxShadow: '0 6px 22px rgba(79, 230, 208, 0.3)',
          color: '#03201b',
        },
        outlined: {
          borderWidth: 2,
          borderColor: 'rgba(255, 123, 28, 0.5)',
          backgroundColor: 'rgba(10, 6, 18, 0.35)',
          '&:hover': {
            borderWidth: 2,
            borderColor: 'rgba(255, 123, 28, 0.95)',
            boxShadow: '0 0 22px rgba(255, 123, 28, 0.25)',
          },
        },
        outlinedSecondary: {
          borderColor: 'rgba(176, 107, 255, 0.55)',
          color: '#c99bff',
          '&:hover': {
            borderColor: '#b06bff',
            boxShadow: '0 0 22px rgba(176, 107, 255, 0.3)',
            backgroundColor: 'rgba(139, 63, 217, 0.12)',
          },
        },
        outlinedSuccess: {
          borderColor: 'rgba(140, 240, 69, 0.55)',
          '&:hover': { borderColor: '#8cf045', boxShadow: '0 0 22px rgba(140, 240, 69, 0.28)' },
        },
        outlinedError: {
          borderColor: 'rgba(224, 33, 58, 0.55)',
          '&:hover': { borderColor: '#e0213a', boxShadow: '0 0 22px rgba(224, 33, 58, 0.28)' },
        },
        text: { padding: '8px 16px' },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", monospace',
            backgroundColor: 'rgba(16, 9, 28, 0.78)',
            backdropFilter: 'blur(6px)',
            '& fieldset': { borderColor: '#3f2b5e', borderWidth: 2 },
            '&:hover fieldset': { borderColor: '#b06bff' },
            '&.Mui-focused fieldset': { borderColor: '#ff7b1c', borderWidth: 2 },
            '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(255, 123, 28, 0.12)' },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffa24a' },
          '& .MuiFormHelperText-root': { fontSize: '0.72rem', marginLeft: 2 },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#130b20',
          backgroundImage:
            'radial-gradient(ellipse 120% 70% at 50% -20%, rgba(139, 63, 217, 0.22), transparent 60%), linear-gradient(165deg, rgba(27,16,48,0.97), rgba(10,6,18,0.98))',
          border: '1px solid rgba(63, 43, 94, 0.9)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(139, 63, 217, 0.18)',
          borderRadius: 16,
        },
      },
    },

    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(5, 2, 10, 0.72)' },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: '1px solid transparent', fontWeight: 600 },
        standardError: {
          background: 'rgba(224, 33, 58, 0.14)',
          borderColor: 'rgba(224, 33, 58, 0.45)',
          color: '#ff9aa8',
        },
        standardSuccess: {
          background: 'rgba(140, 240, 69, 0.12)',
          borderColor: 'rgba(140, 240, 69, 0.4)',
          color: '#c4f99d',
        },
        standardWarning: {
          background: 'rgba(255, 201, 74, 0.13)',
          borderColor: 'rgba(255, 201, 74, 0.4)',
          color: '#ffe19a',
        },
        standardInfo: {
          background: 'rgba(139, 63, 217, 0.16)',
          borderColor: 'rgba(176, 107, 255, 0.45)',
          color: '#dcc2ff',
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: { height: 6 },
        thumb: {
          '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 10px rgba(255, 123, 28, 0.16)' },
        },
        rail: { opacity: 0.22 },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: '#3f2b5e', opacity: 1 },
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
          background: 'rgba(16, 9, 28, 0.97)',
          border: '1px solid rgba(63, 43, 94, 0.9)',
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
      styleOverrides: { root: { color: '#ff7b1c' } },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(63, 43, 94, 0.6)', borderRadius: 999 },
        bar: { borderRadius: 999 },
      },
    },
  },
})

export default appTheme
