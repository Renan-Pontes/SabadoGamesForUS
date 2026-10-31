import { memo, useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, nameOf, ranking } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares } from '../../scare'
import { BigReveal, CandleTimer, CandyRain, Cauldron, HauntedTitle, PlayerBadge, withAlpha } from '../../ui'
import { BET_TIPS, START_SPEECH, WITCHES, witchOf } from './content'
import {
  BET_SECONDS,
  FIRST_BET_SECONDS,
  LEADER_PAYS,
  SECOND_PAYS,
  TRACK_LENGTH,
  WINNER_PAYS,
  finalAwards,
  standings,
  type CvRace,
  type State,
} from './engine'
import { meta } from './meta'
import { Die, WitchTag, WitchToken } from './parts'
import { candies, isFirstFall, raceCue, raceFrame, randomScaresAllowed, shortNames, type RaceFrame } from './view'

/**
 * TV da Corrida de Vassouras. Só desenha o estado: o motor já sorteou a
 * etapa inteira (ordem, dados, maldição) e guardou em `state.race`; aqui a
 * corrida é animada no relógio do servidor, momento a momento.
 *
 * Letras para 3 metros: texto de 28 px para cima, títulos de 64 px para
 * cima, vela/cronômetro sempre à vista.
 */

const ACCENT = meta.accent
const TEXT = 'clamp(1.8rem, 2.3vw, 2.6rem)'
const SMALL_TEXT = 'clamp(1.75rem, 2vw, 2.2rem)'
const TITLE = 'clamp(4rem, 4.6vw, 5.2rem)'
// Raias pela altura da tela: notebook com zoom de 125–150% (864 ou 720 px de
// altura) também tem de mostrar a pista, a vela e os ✓ sem rolar.
const LANE_HEIGHT = 'clamp(48px, 6.8vh, 88px)'
const TOKEN_SIZE = 'clamp(40px, 5.6vh, 72px)'
/** Tela baixa (notebook com zoom): some o que é só enfeite. */
const SHORT_SCREEN = '@media (max-height: 780px)'
/** Lilás das maldições. */
const CURSE_COLOR = '#d8b4fe'

export default function Tv({ state, players, now }: HalloweenViewProps<State>) {
  // Apostas (votação), corrida e chegada (revelação) seguram os sustos
  // aleatórios; o placar entre etapas e o fim, não. O susto do jogo é a 1ª queda.
  useSuppressScares(!randomScaresAllowed(state))
  // Coração batendo nas apostas, Grieg galopando na corrida.
  useMusic(state.over ? 'victory' : state.phase === 'bet' ? 'tension' : 'race')
  usePhaseSounds(state)

  // "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo.
  if (state.over) return <FinalBoard state={state} players={players} />
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {state.phase === 'bet' && <BetBoard state={state} players={players} now={now} />}
      {state.phase === 'race' && <RaceBoard state={state} now={now} />}
      {state.phase === 'payout' && <PayoutBoard state={state} players={players} now={now} />}
    </Box>
  )
}

/** Sons de cada fase (a corrida tem os próprios, momento a momento). */
function usePhaseSounds(state: State) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  const first = state.round === 1
  const finished = state.winner !== null
  const paid = Object.keys(state.payout?.gains ?? {}).length > 0
  useEffect(() => {
    if (phase === 'bet') {
      playSfx('bell', { volume: 0.6 })
      if (first) return speakSpooky(START_SPEECH)
    }
    if (phase === 'payout') {
      playSfx(finished ? 'win' : 'ding')
      if (paid) playSfx('pop', { delay: 0.35 })
    }
    if (phase === 'final') playSfx('organ')
  }, [moment, phase, first, finished, paid])
}

/**
 * Tique-taque nos últimos 5 segundos das apostas. Componente à parte (não
 * desenha nada) para o relógio não redesenhar a TV inteira 4 vezes por segundo.
 */
function TickTock({ deadline, now }: { deadline: number | null; now: () => number }) {
  const { seconds } = useCountdown(deadline, now, GRACE_MS)
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    playSfx('tick')
  }, [seconds])
  return null
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function StageLabel({ state, extra }: { state: State; extra?: string }) {
  const late = state.round >= state.maxStages - 2
  return (
    <Typography
      sx={{
        fontFamily: 'var(--font-numeric)',
        fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)',
        color: 'var(--text-secondary)',
        letterSpacing: '0.12em',
        lineHeight: 1,
      }}
    >
      ETAPA {state.round}
      {extra ? ` · ${extra}` : ''}
      {late ? ` · 🕛 MEIA-NOITE NA ${state.maxStages}` : ''}
    </Typography>
  )
}

function Title({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: 'var(--font-display)',
        fontSize: TITLE,
        color: ACCENT.main,
        lineHeight: 1,
        letterSpacing: '0.04em',
        textShadow: `0 0 24px ${ACCENT.glow}`,
      }}
    >
      {children}
    </Typography>
  )
}

function Countdown({ deadline, now }: { deadline: number | null; now: () => number }) {
  const { seconds } = useCountdown(deadline, now)
  if (seconds === null) return null
  return (
    <Box
      sx={{
        width: 'clamp(100px, 8vw, 136px)',
        height: 'clamp(100px, 8vw, 136px)',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: `6px solid ${ACCENT.main}`,
        boxShadow: `0 0 30px ${ACCENT.glow}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>
        {seconds}
      </Typography>
    </Box>
  )
}

/** Contadores ao lado de cada raia (índice = bruxa). */
type LaneCounts = { bets?: number[]; curses?: number[]; fans?: number[] }

/** As cinco raias. Cada bruxa voa na sua; o número à esquerda é a posição. */
function Track({
  positions,
  arrivals,
  active = null,
  shaking = null,
  tumble = null,
  counts = {},
}: {
  positions: number[]
  arrivals: number[]
  active?: number | null
  shaking?: number | null
  tumble?: number | null
  counts?: LaneCounts
}) {
  const order = standings(positions, arrivals)
  const started = positions.some((position) => position > 0)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.9vh, 10px)' }}>
      {WITCHES.map((witch) => (
        <Lane
          key={witch.id}
          witch={witch.id}
          position={positions[witch.id] ?? 0}
          place={started ? order.indexOf(witch.id) + 1 : 0}
          active={active === witch.id}
          dim={active !== null && active !== witch.id}
          shaking={shaking === witch.id}
          tumble={tumble === witch.id}
          bets={counts.bets?.[witch.id] ?? 0}
          curses={counts.curses?.[witch.id] ?? 0}
          fans={counts.fans?.[witch.id] ?? 0}
        />
      ))}
    </Box>
  )
}

const SQUARES = TRACK_LENGTH + 1 // largada + 16 casas

function squareBackground(square: number, color: string) {
  if (square === 0) return 'repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px)'
  if (square === TRACK_LENGTH) return 'repeating-conic-gradient(#f5f0e1 0% 25%, #1a1024 0% 50%) 50% / 16px 16px'
  return withAlpha(color, square % 2 ? 0.16 : 0.09)
}

/**
 * Uma raia. Memorizada e só com props simples: a corrida redesenha ~10
 * vezes por segundo, mas cada raia só redesenha quando a bruxa dela muda —
 * TV de festa costuma ter processador fraco.
 */
const Lane = memo(function Lane({
  witch,
  position,
  place,
  active,
  dim,
  shaking,
  tumble,
  bets,
  curses,
  fans,
}: {
  witch: number
  position: number
  /** 0 = ninguém saiu da largada ainda. */
  place: number
  active: boolean
  dim: boolean
  shaking: boolean
  tumble: boolean
  bets: number
  curses: number
  fans: number
}) {
  const w = witchOf(witch)
  const placeColor = place === 1 ? '#fbbf24' : place === 2 ? '#e5e7eb' : 'var(--text-muted)'
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'clamp(52px, 4.2vw, 80px) clamp(180px, 14vw, 270px) minmax(0, 1fr) clamp(120px, 10vw, 190px)',
        alignItems: 'center',
        columnGap: 'clamp(8px, 1vw, 18px)',
        height: LANE_HEIGHT,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.9rem, 2.6vw, 3rem)', color: placeColor, textAlign: 'right', lineHeight: 1 }}>
        {place ? `${place}º` : ''}
      </Typography>
      <Typography noWrap sx={{ fontSize: TEXT, fontWeight: 800, color: w.light, lineHeight: 1.1 }}>
        {w.name}
      </Typography>
      <Box sx={{ position: 'relative', height: '100%', minWidth: 0 }}>
        <LaneSquares color={w.color} active={active} />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${((Math.min(TRACK_LENGTH, Math.max(0, position)) + 0.5) / SQUARES) * 100}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 850ms cubic-bezier(0.34, 1.36, 0.64, 1)',
            zIndex: active ? 2 : 1,
          }}
        >
          <WitchToken witch={witch} size={TOKEN_SIZE} glow={active} shaking={shaking} tumble={tumble} dim={dim} />
        </Box>
      </Box>
      {/* Lado a lado (quebra só se não couber): empilhado, não cabia na raia de uma tela baixa. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          alignContent: 'center',
          columnGap: '0.45em',
          fontSize: SMALL_TEXT,
          fontWeight: 800,
          lineHeight: 1.05,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {fans > 0 && <span>📣 {fans}</span>}
        {bets > 0 && <span>🎟️ {bets}</span>}
        {curses > 0 && <span style={{ color: CURSE_COLOR }}>🕯️ {curses}</span>}
      </Box>
    </Box>
  )
})

/** As 17 casas da raia (largada, 1–15 e a chegada quadriculada). */
const LaneSquares = memo(function LaneSquares({ color, active }: { color: string; active: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: '14% 0',
        display: 'grid',
        gridTemplateColumns: `repeat(${SQUARES}, 1fr)`,
        gap: '3px',
        borderRadius: 2,
        overflow: 'hidden',
        border: `2px solid ${withAlpha(color, active ? 0.8 : 0.3)}`,
        transition: 'border-color 300ms ease',
      }}
    >
      {Array.from({ length: SQUARES }, (_, square) => (
        <Box key={square} sx={{ background: squareBackground(square, color) }} />
      ))}
    </Box>
  )
})

/** Quantas apostas de etapa e quantas torcidas (campeã) cada bruxa tem. */
function countBy(values: (number | null | undefined)[]): number[] {
  const counts = WITCHES.map(() => 0)
  for (const value of values) if (typeof value === 'number' && counts[value] !== undefined) counts[value] += 1
  return counts
}

// ---------------------------------------------------------------------------
// Apostas
// ---------------------------------------------------------------------------

function BetBoard({ state, players, now }: { state: State; players: HPlayer[]; now: () => number }) {
  const done = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const total = (state.round === 1 ? FIRST_BET_SECONDS : BET_SECONDS) * 1000
  // Da 2ª etapa em diante, a torcida (aposta na campeã) aparece ao lado de cada raia.
  const fans = state.round > 1 ? countBy(Object.values(state.winnerBets)) : undefined
  // Tudo numa tela de notebook com zoom (720–864 px de altura): título curto,
  // a vela ao lado da pista e a contagem de apostas na linha da etapa.
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <Box sx={{ minWidth: 0 }}>
        <StageLabel state={state} extra={`📱 ${done.size}/${state.roster.length} APOSTARAM`} />
        <Title>{state.round === 1 ? '🎟️ Façam suas apostas!' : '🎟️ Apostem e amaldiçoem!'}</Title>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: { xs: 2, md: 3 }, alignItems: 'center' }}>
        <Track positions={state.positions} arrivals={state.arrivals} counts={{ fans }} />
        {/* A vela zera na hora prometida; a folga de 2 s fica escondida. */}
        <CandleTimer deadline={state.deadline === null ? null : state.deadline - GRACE_MS} total={total} now={now} size={160} />
      </Box>
      <TickTock deadline={state.deadline} now={now} />

      <Box sx={{ mt: 'auto' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          {state.roster.map((id) => (
            <PlayerBadge key={id} name={nameOf(players, id)} acted={done.has(id)} offline={!online.has(id)} size="lg" />
          ))}
        </Box>
        <Typography sx={{ mt: 1.5, fontSize: SMALL_TEXT, color: ACCENT.light, lineHeight: 1.2, [SHORT_SCREEN]: { display: 'none' } }}>
          {BET_TIPS[(state.round - 1) % BET_TIPS.length]}
        </Typography>
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------

function RaceBoard({ state, now }: { state: State; now: () => number }) {
  if (!state.race) return null
  return <RaceView state={state} race={state.race} now={now} />
}

function RaceView({ state, race, now }: { state: State; race: CvRace; now: () => number }) {
  const t = useServerNow(now, 100)
  const frame = raceFrame(race, t - race.at, state.round)
  useRaceSounds(state, race, frame)

  const bets = countBy(Object.values(state.bets).map((bet) => bet.stage))
  const kind = frame.beat?.kind ?? 'intro'
  const ending = kind === 'finish' || kind === 'midnight'
  const champion = witchOf(race.finished)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, minHeight: 'clamp(110px, 12vh, 150px)' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StageLabel state={state} extra="CORRIDA" />
          <Typography
            key={`${frame.beatIndex}-${frame.caption}`}
            className="animate-pop-in"
            sx={{
              fontWeight: 800,
              fontSize: 'clamp(2.2rem, 3vw, 3.8rem)',
              lineHeight: 1.08,
              mt: 0.75,
              color: frame.active !== null ? witchOf(frame.active).light : 'var(--text-primary)',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
            }}
          >
            {frame.caption}
          </Typography>
        </Box>
        <BeatIcon frame={frame} />
        <Countdown deadline={state.deadline} now={now} />
      </Box>

      <Track
        positions={frame.positions}
        arrivals={frame.arrivals}
        active={frame.active}
        shaking={frame.shaking ? race.fell : null}
        tumble={frame.fallen && kind === 'fall' ? race.fell : null}
        counts={{ bets, curses: race.curses }}
      />

      <Typography sx={{ mt: 'auto', fontSize: SMALL_TEXT, color: 'var(--text-secondary)', textAlign: 'center' }}>
        🥇 líder da etapa paga {LEADER_PAYS} 🍬 · 🥈 segunda paga {SECOND_PAYS} 🍬 · 🎟️ apostas · 🕯️ maldições (2+ derruba)
      </Typography>

      <BigReveal
        open={ending}
        tone="witch"
        sound={kind === 'midnight' ? 'gong' : 'reveal'}
        icon={kind === 'midnight' ? '🕛' : `🏁${champion.emoji}`}
        title={kind === 'midnight' ? 'MEIA-NOITE!' : `${champion.name.toUpperCase()} VENCEU!`}
        subtitle={kind === 'midnight' ? `Vence quem estava na frente: ${champion.name}` : 'primeira a cruzar a chegada'}
      />
    </Box>
  )
}

/** O dado da vez ou o ícone do momento (maldição, líder, chegada). */
function BeatIcon({ frame }: { frame: RaceFrame }) {
  const size = 'clamp(92px, 9vh, 128px)'
  if (frame.die) {
    return <Die key={`${frame.beatIndex}-${frame.die.rolling}`} value={frame.die.value} witch={frame.die.witch} size={size} rolling={frame.die.rolling} />
  }
  const icon: Record<string, string> = { intro: '🎲', fall: '🕯️', weak: '💨', lead: '🥇', finish: '🏁', midnight: '🕛' }
  return (
    <Box
      key={frame.beatIndex}
      className="animate-pop-in"
      sx={{ width: size, height: size, display: 'grid', placeItems: 'center', fontSize: `calc(${size} * 0.72)`, lineHeight: 1, flexShrink: 0 }}
    >
      {icon[frame.beat?.kind ?? 'intro'] ?? '🎲'}
    </Box>
  )
}

/**
 * Um som por momento da corrida (a lista mora em `raceCue`, testada: nada
 * de grito alto a cada queda) e o susto de meme só na 1ª queda da partida.
 */
function useRaceSounds(state: State, race: CvRace, frame: RaceFrame) {
  const kind = frame.beat?.kind ?? 'intro'
  const step = frame.beat?.kind === 'step' ? race.steps[frame.beat.index] : null
  const roll = step?.roll ?? 0
  const firstFall = kind === 'fall' && isFirstFall(state.history, state.round)
  const name = witchOf(kind === 'step' ? step?.witch : race.finished ?? race.fell).name
  const moment = `${state.round}-${frame.beatIndex}`
  useEffect(() => {
    const cue = raceCue(kind, { roll, firstFall, witch: name })
    for (const sound of cue.sfx) {
      const options: { delay?: number; volume?: number } = {}
      if (sound.delay !== undefined) options.delay = sound.delay
      if (sound.volume !== undefined) options.volume = sound.volume
      playSfx(sound.name, options)
    }
    if (cue.scare) triggerScare(cue.scare)
    if (cue.speak) return speakSpooky(cue.speak)
  }, [moment, kind, roll, firstFall, name])
}

// ---------------------------------------------------------------------------
// Pagamento
// ---------------------------------------------------------------------------

function PayoutBoard({ state, players, now }: { state: State; players: HPlayer[]; now: () => number }) {
  const payout = state.payout
  if (!payout) return null
  const finished = state.winner !== null
  const fell = state.race?.fell ?? null
  const total = Object.values(payout.gains).reduce((sum, value) => sum + value, 0)
  // O caldeirão sobe para o cabeçalho: a coluna da direita fica só com o
  // placar, e 15 nomes cabem numa tela de notebook com zoom.
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StageLabel state={state} extra="RESULTADO" />
          <Title>
            {finished ? (
              <>
                🏁 <WitchTag witch={state.winner} /> venceu!
              </>
            ) : (
              '🍬 Hora dos doces'
            )}
          </Title>
          <Typography sx={{ fontSize: TEXT, fontWeight: 700, lineHeight: 1.15, mt: 0.75 }}>
            {total ? `${candies(total)} saíram do caldeirão!` : 'O caldeirão ficou fechado…'}
          </Typography>
        </Box>
        <Cauldron size={176} potion={ACCENT.main}>
          🍬{total}
        </Cauldron>
        <Countdown deadline={state.deadline} now={now} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr' }, gap: { xs: 2, md: 4 }, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <PayCard medal="🥇" witch={payout.leader} label={`líder da etapa · paga ${LEADER_PAYS} 🍬`} ids={payout.onLeader} players={players} delay={0} />
          <PayCard medal="🥈" witch={payout.second} label={`segunda · paga ${SECOND_PAYS} 🍬`} ids={payout.onSecond} players={players} delay={250} />
          {finished && (
            <PayCard
              medal="🏆"
              witch={state.winner ?? 0}
              label={`campeã · aposta da 1ª etapa paga ${WINNER_PAYS} 🍬`}
              ids={payout.champions}
              players={players}
              delay={500}
            />
          )}
          {fell !== null && (
            <Typography sx={{ fontSize: SMALL_TEXT, color: CURSE_COLOR, lineHeight: 1.2 }}>
              🕯️ <WitchTag witch={fell} /> caiu da vassoura — praga de {shortNames(payout.cursers, players)}
            </Typography>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <RankList state={state} players={players} gains={payout.gains} />
        </Box>
      </Box>
    </Box>
  )
}

function PayCard({
  medal,
  witch,
  label,
  ids,
  players,
  delay,
}: {
  medal: string
  witch: number
  label: string
  ids: number[]
  players: HPlayer[]
  delay: number
}) {
  const w = witchOf(witch)
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${withAlpha(w.color, 0.7)}`,
        background: `linear-gradient(90deg, ${withAlpha(w.color, 0.22)}, rgba(10, 6, 18, 0.8))`,
      }}
    >
      <Typography sx={{ fontSize: 'clamp(2.6rem, 3.4vw, 3.8rem)', lineHeight: 1 }}>{medal}</Typography>
      {/* Folga à esquerda: a vassoura sai para trás da bolinha. */}
      <Box sx={{ pl: 2.5, flexShrink: 0 }}>
        <WitchToken witch={witch} size="clamp(56px, 6vh, 76px)" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: w.light, lineHeight: 1.1 }}>
          {w.name} <Box component="span" sx={{ color: 'var(--text-secondary)', fontWeight: 600 }}>· {label}</Box>
        </Typography>
        <Typography sx={{ fontSize: SMALL_TEXT, color: ids.length ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.2 }}>
          {shortNames(ids, players, 'ninguém apostou nela')}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Placar de doces; com mais de 8 pessoas, em colunas (`wide`: até três, no
 * fim, quando o placar tem a largura toda). Linhas baixas: 15 nomes cabem
 * numa tela de 720–864 px de altura.
 */
function RankList({
  state,
  players,
  gains,
  wide = false,
}: {
  state: State
  players: HPlayer[]
  gains: Record<string, number>
  wide?: boolean
}) {
  const entries = ranking(state.scores, state.roster)
  const many = entries.length > 8
  const columns = !many ? '1fr' : wide ? { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, minmax(0, 1fr))' } : { xs: '1fr', lg: '1fr 1fr' }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 1,
        columnGap: 3,
        '& .MuiTypography-root': { lineHeight: 1.15 },
      }}
    >
      {entries.map((entry, index) => {
        const gain = gains[String(entry.id)] ?? 0
        return (
          <Box
            key={entry.id}
            className="stagger-in"
            style={{ animationDelay: `${index * 60}ms` }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 0.5,
              borderRadius: 'var(--radius-lg)',
              background: entry.place === 1 ? `${ACCENT.main}26` : 'rgba(255, 255, 255, 0.04)',
              border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: TEXT, color: 'var(--text-muted)', minWidth: '2ch' }}>
              {entry.place}º
            </Typography>
            <Typography noWrap sx={{ flex: 1, fontSize: TEXT, fontWeight: 700 }}>
              {nameOf(players, entry.id)}
            </Typography>
            {gain > 0 && <Typography sx={{ fontSize: TEXT, color: ACCENT.light, fontWeight: 800 }}>+{gain}</Typography>}
            <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: TEXT, minWidth: '3ch', textAlign: 'right' }}>
              🍬{entry.score}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

function FinalBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const awards = finalAwards(state)
  const leader = witchOf(awards.leader)
  const crossed = awards.winner !== null && !state.race?.midnight
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
      <CandyRain active kind="candy" />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 4 } }}>
        <WitchToken witch={awards.leader} size="clamp(96px, 12vh, 150px)" glow />
        <Box>
          <HauntedTitle size={{ xs: 64, md: 96 }} color={leader.light} glow={leader.color} align="left" drip>
            {awards.winner !== null ? `${leader.name} venceu!` : 'Corrida encerrada'}
          </HauntedTitle>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mt: 1 }}>
            {awards.winner === null
              ? `${leader.name} estava na frente quando a corrida parou.`
              : crossed
                ? `Primeira a cruzar a chegada — ${leader.title}.`
                : 'Bateu a meia-noite com ela na frente.'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 3 } }}>
        <AwardCard
          icon="🍬"
          title="Rei dos doces"
          names={awards.kings.length ? shortNames(awards.kings, players, 'ninguém', 4) : 'Ninguém ganhou nada'}
          detail={awards.kings.length ? candies(awards.topCandy) : 'o caldeirão venceu'}
          delay={0}
        />
        <AwardCard
          icon="🏆"
          title="Apostou na campeã"
          names={awards.winner === null ? '—' : shortNames(awards.champions, players, 'Ninguém', 4)}
          detail={awards.winner === null ? 'a corrida não terminou' : `+${WINNER_PAYS} 🍬 cada`}
          delay={400}
        />
        <AwardCard
          icon="🕯️"
          title="Mestre das maldições"
          names={awards.curseMasters.length ? shortNames(awards.curseMasters, players, 'ninguém', 4) : 'Ninguém derrubou ninguém'}
          detail={
            awards.curseMasters.length
              ? `${awards.maxCurseHits} ${awards.maxCurseHits === 1 ? 'bruxa derrubada' : 'bruxas derrubadas'}`
              : 'as vassouras aguentaram'
          }
          delay={800}
        />
      </Box>

      <RankList state={state} players={players} gains={{}} wide />
    </Box>
  )
}

function AwardCard({ icon, title, names, detail, delay }: { icon: string; title: string; names: string; detail: string; delay: number }) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${ACCENT.main}`,
        background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
        boxShadow: `0 0 40px ${ACCENT.glow}`,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 'clamp(2.8rem, 3.6vw, 4rem)', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', color: ACCENT.light, mt: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2rem, 2.8vw, 3.2rem)', lineHeight: 1.1, mt: 0.5 }}>{names}</Typography>
      <Typography sx={{ fontSize: SMALL_TEXT, color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
