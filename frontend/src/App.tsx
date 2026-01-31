import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// Pages
import Landing from './pages/Landing'
import Lobby from './pages/Lobby'
import HostRoom from './pages/HostRoom'
import Profile from './pages/Profile'
import TvDisplay from './pages/TvDisplay'
import PlayerController from './pages/PlayerController'
import Game from './pages/Game'
import NotFound from './pages/NotFound'
import SuitBackdrop from './components/layout/SuitBackdrop'

// Game Pages
import ReadMyMindGame from './pages/games/ReadMyMindGame'
import ConfinamentoGame from './pages/games/ConfinamentoGame'
import BelezaGame from './pages/games/BelezaGame'
import LeilaoGame from './pages/games/LeilaoGame'
import BlefJackGame from './pages/games/BlefJackGame'
import SugorokuGame from './pages/games/SugorokuGame'

// Context
import { AuthProvider } from './context/AuthProvider'

// MUI Theme customizado para Sabado Games
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#991b1b',
    },
    secondary: {
      main: '#d4a520',
      light: '#fbbf24',
      dark: '#a16207',
    },
    background: {
      default: '#0a0a0f',
      paper: '#12121a',
    },
    text: {
      primary: '#f5f5f5',
      secondary: '#a0a0a0',
    },
    error: {
      main: '#dc2626',
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#eab308',
    },
    info: {
      main: '#22d3ee',
    },
  },
  typography: {
    fontFamily: '"Rajdhani", sans-serif',
    h1: {
      fontFamily: '"Bebas Neue", sans-serif',
      letterSpacing: '0.1em',
    },
    h2: {
      fontFamily: '"Bebas Neue", sans-serif',
      letterSpacing: '0.1em',
    },
    h3: {
      fontFamily: '"Bebas Neue", sans-serif',
      letterSpacing: '0.08em',
    },
    h4: {
      fontFamily: '"Bebas Neue", sans-serif',
      letterSpacing: '0.05em',
    },
    button: {
      fontFamily: '"Rajdhani", sans-serif',
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontWeight: 600,
          padding: '12px 24px',
          fontSize: '1rem',
          borderRadius: 12,
          transition: 'transform 200ms ease, box-shadow 200ms ease, filter 200ms ease',
          '&:active': {
            transform: 'translateY(1px) scale(0.99)',
          },
        },
        contained: {
          backgroundImage: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(153, 27, 27, 0.95))',
          boxShadow: '0 6px 20px rgba(220, 38, 38, 0.35)',
          '&:hover': {
            boxShadow: '0 8px 26px rgba(220, 38, 38, 0.45)',
            filter: 'brightness(1.05)',
          },
        },
        outlined: {
          borderWidth: 2,
          borderColor: 'rgba(212, 165, 32, 0.5)',
          boxShadow: '0 0 0 rgba(0,0,0,0)',
          '&:hover': {
            borderWidth: 2,
            borderColor: 'rgba(212, 165, 32, 0.9)',
            boxShadow: '0 0 20px rgba(212, 165, 32, 0.25)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", monospace',
            backgroundColor: 'rgba(12, 12, 18, 0.75)',
            backdropFilter: 'blur(6px)',
            '& fieldset': {
              borderColor: '#2a2a3a',
              borderWidth: 2,
            },
            '&:hover fieldset': {
              borderColor: '#d4a520',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#d4a520',
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#12121a',
          backgroundImage: 'none',
          border: '1px solid #2a2a3a',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.55)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.2))',
          border: '1px solid rgba(42, 42, 58, 0.8)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(140deg, rgba(18,18,26,0.95), rgba(10,10,15,0.95))',
          border: '1px solid rgba(42, 42, 58, 0.9)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.2))',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: '2px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 12px rgba(0,0,0,0.35)',
        },
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <SuitBackdrop />
          <div className="app-content">
            <Routes>
              {/* Landing - Página inicial */}
              <Route path="/" element={<Landing />} />
              
              {/* Lobby - Dashboard após login */}
              <Route path="/lobby" element={<Lobby />} />
              
              {/* Host Room - Gerenciar sala e selecionar jogos */}
              <Route path="/host/:code" element={<HostRoom />} />
              
              {/* Profile - Editar perfil */}
              <Route path="/profile" element={<Profile />} />
              
              {/* TV Display - Tela do monitor/TV */}
              <Route path="/tv/:code" element={<TvDisplay />} />
              
              {/* Player Controller - Tela do celular */}
              <Route path="/play/:code" element={<PlayerController />} />
              
              {/* Game - Jogo genérico em andamento */}
              <Route path="/game/:code" element={<Game />} />
              
              {/* Read My Mind - Jogo específico */}
              <Route path="/game/:code/read-my-mind" element={<ReadMyMindGame />} />

              {/* Outros jogos */}
              <Route path="/game/:code/confinamento-solitario" element={<ConfinamentoGame />} />
              <Route path="/game/:code/concurso-de-beleza" element={<BelezaGame />} />
              <Route path="/game/:code/leilao-de-cem-votos" element={<LeilaoGame />} />
              <Route path="/game/:code/blef-jack" element={<BlefJackGame />} />
              <Route path="/game/:code/future-sugoroku" element={<SugorokuGame />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
