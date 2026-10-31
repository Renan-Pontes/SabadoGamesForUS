import { Suspense, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { restartRoom } from '../lib/api'
import { useMusic } from './audio'
import type { BaseState, HalloweenGameModule, HalloweenView, HalloweenViewProps } from './engine/types'
import { CenterMessage, HalloweenFrame } from './framework/Frame'
import { EndBar, HostBar } from './framework/HostControls'
import { HostSetupScreen, PlayerSetupScreen, TvSetupScreen } from './framework/SetupScreen'
import { useHalloweenRoom, type HalloweenRoomApi } from './framework/useHalloweenRoom'
import { useScareMoment } from './framework/scareMoment'
import { ViewBoundary } from './framework/ViewBoundary'
import { useWakeLock } from './framework/wakeLock'
import { sendRoomFx } from './fx/api'
import { getHalloweenGame } from './registry'
import { SCARY_RANDOM, useScareNames } from './scare'
import { isHalloweenSlug } from './slugs'

/**
 * A tela única dos jogos da Noite do Terror (`/game/:code/:slug?view=...`).
 *
 * view=tv → a TV do jogo (e, por trás, a TV é o juiz que roda o motor);
 * view=host/player → o celular. Em volta das telas de cada jogo, o
 * framework cuida do que é igual para todos: configuração, espectador,
 * fim de partida, controles do host e o caminho de volta para a sala.
 */
export default function HalloweenGameScreen() {
  const { code = '', slug = '' } = useParams()
  const [params] = useSearchParams()
  const rawView = params.get('view')
  const view: HalloweenView = rawView === 'tv' || rawView === 'host' ? rawView : 'player'
  const roomCode = code.toUpperCase()
  const game = getHalloweenGame(slug)

  if (!game) return <UnknownGame code={roomCode} slug={slug} />
  // A key remonta tudo ao trocar de sala, jogo ou visão: nada de estado velho.
  return <GameRunner key={`${roomCode}:${slug}:${view}`} code={roomCode} view={view} game={game} />
}

function UnknownGame({ code, slug }: { code: string; slug: string }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
      <CenterMessage icon="🪦" title="Jogo não encontrado" text={`Não existe jogo de Halloween chamado “${slug}”.`}>
        <Button variant="outlined" color="inherit" onClick={() => navigate(code ? `/game/${code}` : '/')}>
          Voltar
        </Button>
      </CenterMessage>
    </Box>
  )
}

function GameRunner({ code, view, game }: { code: string; view: HalloweenView; game: HalloweenGameModule }) {
  const navigate = useNavigate()
  const room = useHalloweenRoom(code, view, game)
  const { meta } = game
  const isTv = view === 'tv'
  const status = room.room?.status ?? null
  const roomSlug = room.room?.game?.slug ?? null
  const state = room.game
  const over = Boolean(state?.over)
  const hostish = room.isHost || view === 'host'

  // Música só na TV (jogo sem trilha própria fica no 'lobby'); no fim, vitória.
  useMusic(isTv ? (over ? 'victory' : (meta.music ?? 'lobby')) : null)
  // Os sustos com nome (zoom suspeito, olhos no escuro) usam a mesa do jogo,
  // sem a TV precisar buscar a sala de novo.
  useScareNames(isTv ? room.players.map((player) => player.name) : [])
  // Tela acesa durante a partida: celular bloqueado vira "offline" e perde a
  // vez; notebook ligado na TV apaga no descanso de tela.
  useWakeLock(status === 'live')
  // Momento importante (espião revelado, morte ao amanhecer, abóbora
  // explodindo...): TV e celulares assustam juntos.
  useScareMoment(game, state, room.players, isTv, room.me?.id ?? null, room.roomState._m ?? null)

  // A sala voltou para o lobby (ou fechou), ou trocou de jogo: cada tela
  // volta para o seu lugar.
  useEffect(() => {
    if (!status) return
    if (status !== 'live') {
      navigate(isTv ? `/tv/${code}` : hostish ? `/host/${code}` : `/play/${code}`, { replace: true })
      return
    }
    if (roomSlug && roomSlug !== meta.slug) {
      const target = isHalloweenSlug(roomSlug) ? `/game/${code}/${roomSlug}` : `/game/${code}`
      navigate(`${target}?view=${view}`, { replace: true })
    }
  }, [status, roomSlug, meta.slug, code, view, isTv, hostish, navigate])

  const backToRoom = async () => {
    try {
      await restartRoom(code)
    } catch (err) {
      // Se não deu (sala já no lobby, rede), o efeito acima ou o lobby resolvem.
      console.error('[halloween] não consegui voltar a sala para o lobby', err)
    }
    navigate(`/host/${code}`)
  }

  const frame = (children: ReactNode, footer?: ReactNode) => (
    <HalloweenFrame meta={meta} view={view} code={code} me={room.me} footer={footer}>
      {children}
    </HalloweenFrame>
  )

  if (room.loading) {
    return frame(
      room.error ? (
        <CenterMessage icon="🕸️" title="Sem sinal do além" text={`Tentando de novo… (${room.error})`} big={isTv}>
          <Button variant="outlined" color="inherit" onClick={() => navigate('/')}>
            Ir para o início
          </Button>
        </CenterMessage>
      ) : (
        <CenterMessage loading title="Abrindo a cripta…" big={isTv} />
      ),
    )
  }

  if (status !== 'live' || (roomSlug && roomSlug !== meta.slug)) {
    return frame(<CenterMessage loading title="Voltando para a sala…" big={isTv} />)
  }

  // Problema de rede no meio da partida: avisa sem tirar o jogo da tela.
  const networkWarning = room.error ? (
    <Typography sx={{ textAlign: 'center', color: 'var(--status-waiting)', fontSize: isTv ? '1.4rem' : '0.9rem', mb: 1 }}>
      📡 Conexão instável — tentando de novo…
    </Typography>
  ) : null

  // --- Configuração ---------------------------------------------------------
  if (!state) {
    if (isTv) {
      return frame(
        <>
          {networkWarning}
          <TvSetupScreen meta={meta} players={room.players} error={room.roomState._err} />
        </>,
      )
    }
    if (!room.me) return frame(<NotInRoom code={code} />)
    if (room.isHost) {
      return frame(
        <>
          {networkWarning}
          <HostSetupScreen
            meta={meta}
            players={room.players}
            initialOptions={room.roomState.setup}
            error={room.roomState._err}
            onBegin={(options) => room.command('begin', { options })}
            onBackToRoom={backToRoom}
          />
        </>,
      )
    }
    return frame(<PlayerSetupScreen meta={meta} />)
  }

  // --- Partida --------------------------------------------------------------
  if (!isTv && !room.me) return frame(<NotInRoom code={code} />)

  const hostFooter =
    !isTv && room.isHost ? (
      over ? (
        <EndBar accent={meta.accent} onReplay={() => room.command('replay')} onBackToRoom={backToRoom} />
      ) : (
        <HostBar
          onSkip={() => room.command('skip')}
          onEnd={() => room.command('end')}
          onScare={() => sendRoomFx(code, { scare: SCARY_RANDOM })}
        />
      )
    ) : undefined

  const spectator = !isTv && room.me !== null && !state.roster.includes(room.me.id)

  return frame(
    <>
      {networkWarning}
      {!isTv && room.isHost && room.isJudge && (
        <Typography sx={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--status-waiting)', mb: 1 }}>
          📺 A TV sumiu: seu celular está segurando a partida. Não feche esta tela!
        </Typography>
      )}
      {!isTv && room.isHost && room.roomState._err && (
        <Typography sx={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-red-light)', mb: 1 }}>
          ⚠️ {room.roomState._err}
        </Typography>
      )}
      {spectator ? <Spectator /> : <GameView room={room} game={game} code={code} view={view} />}
    </>,
    hostFooter,
  )
}

/** As telas do jogo, protegidas: erro de desenho não derruba a TV. */
function GameView({
  room,
  game,
  code,
  view,
}: {
  room: HalloweenRoomApi<BaseState>
  game: HalloweenGameModule
  code: string
  view: HalloweenView
}) {
  const state = room.game
  if (!state) return null
  const isTv = view === 'tv'
  const props: HalloweenViewProps = {
    code,
    view,
    state,
    players: room.players,
    me: room.me,
    isHost: room.isHost,
    myInput: room.myInput,
    mine: room.mine,
    now: room.now,
    send: room.send,
    sendSlot: room.sendSlot,
    command: room.command,
    slots: room.slots,
    options: room.options,
  }
  const Screen = isTv ? game.Tv : game.Phone
  return (
    <ViewBoundary
      resetKey={`${state.phase}:${state.round ?? ''}:${state.inputKey}:${state.over}`}
      fallback={(retry) => (
        <CenterMessage icon="💀" title="A tela tropeçou" big={isTv} text="O jogo continua — ela tenta de novo na próxima fase.">
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="outlined" color="inherit" onClick={retry}>
              Tentar de novo
            </Button>
            <Button variant="text" color="inherit" onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          </Box>
        </CenterMessage>
      )}
    >
      <Suspense fallback={<CenterMessage loading title="Abrindo o caixão…" big={isTv} />}>
        <Screen {...props} />
      </Suspense>
    </ViewBoundary>
  )
}

function Spectator() {
  return (
    <CenterMessage
      icon="👻"
      title="Partida rolando"
      text="Você entra na próxima! Enquanto isso, assista pela TV e torça (ou assombre) alguém."
    />
  )
}

function NotInRoom({ code }: { code: string }) {
  const navigate = useNavigate()
  return (
    <CenterMessage icon="🚪" title="Você não está nesta sala" text={`Entre na sala ${code} para jogar.`}>
      <Button variant="contained" onClick={() => navigate(`/play/${code}`)} sx={{ minHeight: 52, fontWeight: 800 }}>
        Entrar na sala
      </Button>
    </CenterMessage>
  )
}
