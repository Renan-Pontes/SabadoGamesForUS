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

// Game Pages
import ReadMyMindGame from './pages/games/ReadMyMindGame'

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
        },
        contained: {
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(220, 38, 38, 0.4)',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"JetBrains Mono", monospace',
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
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
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
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
