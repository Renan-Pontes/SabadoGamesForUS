import { createTheme } from '@mui/material/styles'

/**
 * Tema MUI do Sabado Games — Noite Feliz (Natal).
 *
 * Regra geral: o tema cuida dos controles (botões, campos, diálogos). A
 * aparência de card fica com `components/ui/Panel` — por isso não há override
 * global de `MuiPaper` aqui: ele também atingia `Alert` e `Menu`, brigando com
 * as cores de severidade.
 *
 * As cores repetem as variáveis de `index.css` em hexadecimal porque o MUI
 * calcula contraste e variações a partir delas (e não entende `var(--...)`).
 */
const CANDY = { main: '#e8394a', light: '#ff6b78', dark: '#9e1424', contrastText: '#ffffff' }
const PINE = { main: '#1f9d55', light: '#4fd67e', dark: '#12693a', contrastText: '#ffffff' }
const MINT = { main: '#4fd67e', light: '#8ef0ae', dark: '#1f8f4a', contrastText: '#04210f' }
const BERRY = { main: '#ff4d6d', light: '#ff8098', dark: '#b3203f', contrastText: '#ffffff' }
const STAR = { main: '#f5c242', light: '#ffd975', dark: '#c48a12', contrastText: '#1f1402' }
const ICE = { main: '#7fd8ff', light: '#b8ecff', dark: '#3aa6dc', contrastText: '#03182a' }

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: CANDY,
    secondary: PINE,
    background: { default: '#06101f', paper: '#0c1a2f' },
    text: { primary: '#f4f8ff', secondary: '#b6c6de' },
    error: BERRY,
    success: MINT,
    warning: STAR,
    info: ICE,
    divider: 'rgba(42, 69, 112, 0.8)',
  },

  typography: {
    fontFamily: '"Rajdhani", sans-serif',
    h1: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.03em' },
    h2: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.03em' },
    h3: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h4: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h5: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    h6: { fontFamily: '"Fredoka", "Rajdhani", sans-serif', fontWeight: 600, letterSpacing: '0.02em' },
    button: { fontFamily: '"Rajdhani", sans-serif', fontWeight: 700, letterSpacing: '0.05em' },
  },

  shape: { borderRadius: 14 },

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontWeight: 700,
          padding: '12px 24px',
          fontSize: '0.98rem',
          borderRadius: 14,
          transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
          '&:active': { transform: 'translateY(1px) scale(0.99)' },
          '&.Mui-disabled': {
            // O padrão do MUI some demais; aqui precisa continuar legível.
            color: 'rgba(244, 248, 255, 0.34)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
        // Bala de Natal: vermelho com brilho em cima e texto branco.
        contained: {
          backgroundImage: 'linear-gradient(135deg, #ff6b78 0%, #e8394a 48%, #b3132a 100%)',
          boxShadow:
            '0 6px 22px rgba(232, 57, 74, 0.36), inset 0 2px 0 rgba(255, 255, 255, 0.22), inset 0 -2px 0 rgba(0, 0, 0, 0.18)',
          '&:hover': {
            boxShadow:
              '0 8px 30px rgba(232, 57, 74, 0.52), inset 0 2px 0 rgba(255, 255, 255, 0.22), inset 0 -2px 0 rgba(0, 0, 0, 0.18)',
            filter: 'brightness(1.07)',
          },
          '&.Mui-disabled': { backgroundImage: 'none', background: 'rgba(255,255,255,0.06)', boxShadow: 'none' },
        },
        containedSecondary: {
          backgroundImage: 'linear-gradient(135deg, #4fd67e 0%, #1f9d55 55%, #12693a 100%)',
          boxShadow: '0 6px 22px rgba(31, 157, 85, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.18), inset 0 -2px 0 rgba(0, 0, 0, 0.2)',
          color: '#ffffff',
          '&:hover': { boxShadow: '0 8px 30px rgba(31, 157, 85, 0.55)' },
        },
        containedSuccess: {
          backgroundImage: 'linear-gradient(135deg, #8ef0ae, #4fd67e 50%, #1f8f4a)',
          boxShadow: '0 6px 22px rgba(79, 214, 126, 0.3)',
          color: '#04210f',
          '&:hover': { boxShadow: '0 8px 30px rgba(79, 214, 126, 0.45)' },
        },
        containedWarning: {
          backgroundImage: 'linear-gradient(135deg, #ffd975, #f5c242 50%, #c48a12)',
          boxShadow: '0 6px 22px rgba(245, 194, 66, 0.3)',
          color: '#1f1402',
        },
        containedError: {
          backgroundImage: 'linear-gradient(135deg, #ff8098, #ff4d6d 50%, #b3203f)',
          boxShadow: '0 6px 22px rgba(255, 77, 109, 0.36)',
          color: '#ffffff',
        },
        containedInfo: {
          backgroundImage: 'linear-gradient(135deg, #b8ecff, #7fd8ff 50%, #3aa6dc)',
          boxShadow: '0 6px 22px rgba(127, 216, 255, 0.3)',
          color: '#03182a',
        },
        outlined: {
          borderWidth: 2,
          borderColor: 'rgba(255, 107, 120, 0.55)',
          color: '#ff8c95',
          backgroundColor: 'rgba(6, 16, 31, 0.35)',
          '&:hover': {
            borderWidth: 2,
            borderColor: 'rgba(255, 107, 120, 0.95)',
            boxShadow: '0 0 22px rgba(232, 57, 74, 0.25)',
          },
        },
        outlinedSecondary: {
          borderColor: 'rgba(79, 214, 126, 0.55)',
          color: '#8ef0ae',
          '&:hover': {
            borderColor: '#4fd67e',
            boxShadow: '0 0 22px rgba(79, 214, 126, 0.3)',
            backgroundColor: 'rgba(31, 157, 85, 0.12)',
          },
        },
        outlinedSuccess: {
          borderColor: 'rgba(79, 214, 126, 0.55)',
          '&:hover': { borderColor: '#4fd67e', boxShadow: '0 0 22px rgba(79, 214, 126, 0.28)' },
        },
        outlinedError: {
          borderColor: 'rgba(255, 77, 109, 0.55)',
          '&:hover': { borderColor: '#ff4d6d', boxShadow: '0 0 22px rgba(255, 77, 109, 0.28)' },
        },
        text: { padding: '8px 16px' },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", monospace',
            backgroundColor: 'rgba(9, 22, 42, 0.78)',
            backdropFilter: 'blur(6px)',
            '& fieldset': { borderColor: '#2a4570', borderWidth: 2 },
            '&:hover fieldset': { borderColor: '#7fc4ff' },
            '&.Mui-focused fieldset': { borderColor: '#f5c242', borderWidth: 2 },
            '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(245, 194, 66, 0.14)' },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffd975' },
          '& .MuiFormHelperText-root': { fontSize: '0.72rem', marginLeft: 2 },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0c1a2f',
          backgroundImage:
            'radial-gradient(ellipse 120% 70% at 50% -20%, rgba(127, 196, 255, 0.18), transparent 60%), linear-gradient(165deg, rgba(18,35,61,0.97), rgba(6,16,31,0.98))',
          border: '1px solid rgba(42, 69, 112, 0.9)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(127, 196, 255, 0.14)',
          borderRadius: 18,
        },
      },
    },

    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(3, 8, 16, 0.72)' },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: '1px solid transparent', fontWeight: 600 },
        standardError: {
          background: 'rgba(255, 77, 109, 0.14)',
          borderColor: 'rgba(255, 77, 109, 0.45)',
          color: '#ffa3b3',
        },
        standardSuccess: {
          background: 'rgba(79, 214, 126, 0.12)',
          borderColor: 'rgba(79, 214, 126, 0.4)',
          color: '#b8f5cc',
        },
        standardWarning: {
          background: 'rgba(245, 194, 66, 0.13)',
          borderColor: 'rgba(245, 194, 66, 0.4)',
          color: '#ffe19a',
        },
        standardInfo: {
          background: 'rgba(127, 216, 255, 0.12)',
          borderColor: 'rgba(127, 216, 255, 0.42)',
          color: '#cfefff',
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: { height: 6 },
        thumb: {
          '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 10px rgba(232, 57, 74, 0.16)' },
        },
        rail: { opacity: 0.22 },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: '#2a4570', opacity: 1 },
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
          background: 'rgba(9, 22, 42, 0.97)',
          border: '1px solid rgba(42, 69, 112, 0.9)',
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
      styleOverrides: { root: { color: '#f5c242' } },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(42, 69, 112, 0.6)', borderRadius: 999 },
        bar: { borderRadius: 999 },
      },
    },
  },
})

export default appTheme
