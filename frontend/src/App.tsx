import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

import { appTheme } from './theme'
import { AuthProvider } from './context/AuthProvider'

// Telas fora de partida
import Landing from './pages/Landing'
import Lobby from './pages/Lobby'
import HostRoom from './pages/HostRoom'
import Profile from './pages/Profile'
import TvDisplay from './pages/TvDisplay'
import PlayerController from './pages/PlayerController'
import Game from './pages/Game'
import NotFound from './pages/NotFound'

// Minigames. Para adicionar um jogo novo: crie a tela, registre a rota aqui
// e o slug em `lib/gameCatalog.ts` e em `pages/Game.tsx`.
import ReadMyMindGame from './pages/games/ReadMyMindGame'
import ConfinamentoGame from './pages/games/ConfinamentoGame'
import BelezaGame from './pages/games/BelezaGame'
import LeilaoGame from './pages/games/LeilaoGame'
import BlefJackGame from './pages/games/BlefJackGame'
import SugorokuGame from './pages/games/SugorokuGame'
import CacadaGame from './pages/games/CacadaGame'
import SintoniaGame from './pages/games/SintoniaGame'
import CaveiraGame from './pages/games/CaveiraGame'
import ResistenciaGame from './pages/games/ResistenciaGame'
import PalavraChaveGame from './pages/games/PalavraChaveGame'
import InfiltradoGame from './pages/games/InfiltradoGame'
import PerfilGame from './pages/games/PerfilGame'
import CamaleaoGame from './pages/games/CamaleaoGame'
import LobisomemGame from './pages/games/LobisomemGame'
import CorridaDeCamelosGame from './pages/games/CorridaDeCamelosGame'
import NaoParaGame from './pages/games/NaoParaGame'
import PalpiteCertoGame from './pages/games/PalpiteCertoGame'
import ArtistaFalsoGame from './pages/games/ArtistaFalsoGame'
import BombaRelogioGame from './pages/games/BombaRelogioGame'
import MuralhasGame from './pages/games/MuralhasGame'
import DesenhaGame from './pages/games/DesenhaGame'
import SoUmaGame from './pages/games/SoUmaGame'
import ManadaGame from './pages/games/ManadaGame'
import QuizGame from './pages/games/QuizGame'

/**
 * Troca de tela com uma entrada curta. A `key` na rota faz o React remontar
 * o container a cada navegação, que é o que dispara a animação de novo.
 */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div className="app-content page-enter" key={location.pathname}>
      <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/profile" element={<Profile />} />

              {/* Uma sala tem três telas: host, TV e celular */}
              <Route path="/host/:code" element={<HostRoom />} />
              <Route path="/tv/:code" element={<TvDisplay />} />
              <Route path="/play/:code" element={<PlayerController />} />

              {/* Redireciona para a tela do jogo que está rodando na sala */}
              <Route path="/game/:code" element={<Game />} />

              <Route path="/game/:code/read-my-mind" element={<ReadMyMindGame />} />
              <Route path="/game/:code/confinamento-solitario" element={<ConfinamentoGame />} />
              <Route path="/game/:code/concurso-de-beleza" element={<BelezaGame />} />
              <Route path="/game/:code/leilao-de-cem-votos" element={<LeilaoGame />} />
              <Route path="/game/:code/blef-jack" element={<BlefJackGame />} />
              <Route path="/game/:code/future-sugoroku" element={<SugorokuGame />} />
              <Route path="/game/:code/a-cacada" element={<CacadaGame />} />
              <Route path="/game/:code/sintonia" element={<SintoniaGame />} />
              <Route path="/game/:code/caveira" element={<CaveiraGame />} />
              <Route path="/game/:code/resistencia" element={<ResistenciaGame />} />
              <Route path="/game/:code/palavra-chave" element={<PalavraChaveGame />} />
              <Route path="/game/:code/o-infiltrado" element={<InfiltradoGame />} />
              <Route path="/game/:code/perfil" element={<PerfilGame />} />
              <Route path="/game/:code/camaleao" element={<CamaleaoGame />} />
              <Route path="/game/:code/lobisomem" element={<LobisomemGame />} />
              <Route path="/game/:code/corrida-de-camelos" element={<CorridaDeCamelosGame />} />
              <Route path="/game/:code/nao-para" element={<NaoParaGame />} />
              <Route path="/game/:code/palpite-certo" element={<PalpiteCertoGame />} />
              <Route path="/game/:code/artista-falso" element={<ArtistaFalsoGame />} />
              <Route path="/game/:code/bomba-relogio" element={<BombaRelogioGame />} />
              <Route path="/game/:code/muralhas" element={<MuralhasGame />} />
              <Route path="/game/:code/desenha-e-adivinha" element={<DesenhaGame />} />
              <Route path="/game/:code/so-uma" element={<SoUmaGame />} />
              <Route path="/game/:code/manada" element={<ManadaGame />} />
              <Route path="/game/:code/quiz-da-mesa" element={<QuizGame />} />

      <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
