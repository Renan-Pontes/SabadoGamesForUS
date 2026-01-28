import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import HostSetup from './pages/HostSetup'
import HostRoom from './pages/HostRoom'
import JoinRoom from './pages/JoinRoom'
import PlayerRoom from './pages/PlayerRoom'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Register from './pages/Register'
import Settings from './pages/Settings'
import TvRoom from './pages/TvRoom'
import TvSetup from './pages/TvSetup'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" />
            <div>
              <p>Sabado</p>
              <strong>Games</strong>
            </div>
          </div>
          <nav className="nav">
            <NavLink to="/tv" className="nav-link">
              TV
            </NavLink>
            <NavLink to="/host" className="nav-link">
              Controle
            </NavLink>
            <NavLink to="/join" className="nav-link">
              Entrar
            </NavLink>
            <NavLink to="/login" className="nav-link">
              Conta
            </NavLink>
            <NavLink to="/settings" className="nav-link">
              Configurações
            </NavLink>
          </nav>
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host" element={<HostSetup />} />
            <Route path="/host/:code" element={<HostRoom />} />
            <Route path="/tv" element={<TvSetup />} />
            <Route path="/tv/:code" element={<TvRoom />} />
            <Route path="/join" element={<JoinRoom />} />
            <Route path="/play/:code" element={<PlayerRoom />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>Sabado Games · protótipo para noites de jogo</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
