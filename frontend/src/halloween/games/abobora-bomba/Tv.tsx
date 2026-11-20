import { memo, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { paceDelay } from '../../../lib/spokenLines'
import { playSfx, speakFestive, useMusic } from '../../audio'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares, type Cameo } from '../../scare'
import { CandleTimer, FESTIVE_ROUND_FONT, PlayerBadge } from '../../ui'
import {
  ARRIVAL_GRACE_MS,
  BOOM_SECONDS,
  aliveIds,
  gameDecided,
  heatRate,
  holdStartOf,
  isAlive,
  livesOf,
  mostBooms,
  realMsLeft,
  standings,
  themeSecondsFor,
  winners,
  type AbbStanding,
  type AbbState,
} from './engine'
import FuseRope from './FuseRope'
import GiftBox from './GiftBox'
import { meta } from './meta'
import { ConfettiRain, PofBurst, PofReveal } from './Pof'
import {
  BOOM_REVEAL_MS,
  CLOSE_CALL_MS,
  CLOSE_CALL_SHOW_MS,
  TICK_FROM_MS,
  boomLine,
  finalLine,
  fuseFraction,
  heartsText,
  heatLabel,
  moodFor,
  outLine,
  prizeFor,
  savedText,
  seatPosition,
  secondsOf,
  shakeLevel,
  themeLine,
  towardCenter,
  type Point,
} from './view'

/**
 * TV do Presente-Bomba: a mesa em círculo, o presente pulando de nome em
 * nome (tremendo cada vez mais conforme o pavio acaba) e uma vela-pavio
 * embaixo de cada nome. Só desenha o estado — quem decide passe, POF e
 * vencedor é o motor. Letras para 3 metros: texto de pelo menos 28 px,
 * títulos de 64 px para cima, vela sempre à vista.
 */

const ACCENT = meta.accent
const GOLD = '#ffd166'

export default function Tv({ state, players, now }: HalloweenViewProps<AbbState>) {
  // Efeito aleatório no meio da roda ou do POF atrapalha: segura até o anúncio do tema.
  useSuppressScares(state.over || state.phase === 'play' || state.phase === 'boom')
  // Depois do POF, um segundinho de silêncio para a piada; o Jingle Bells volta com o tema novo.
  useMusic(state.over ? (meta.victoryMusic ?? 'wish') : state.phase === 'boom' ? null : (meta.music ?? 'jingle'))
  useTvSounds(state, players, now)

  // "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo.
  if (state.over) return <FinalBoard state={state} players={players} />
  return <Stage state={state} players={players} now={now} />
}

// ---------------------------------------------------------------------------
// Som, voz e efeitos: uma vez por momento, nunca a cada poll
// ---------------------------------------------------------------------------

function useTvSounds(state: AbbState, players: HPlayer[], now: () => number) {
  const phase = state.over ? 'final' : state.phase
  const round = state.round
  const moment = `${round}-${phase}`
  const victim = phase === 'boom' ? (state.boom?.victim ?? null) : null
  const victimName = victim === null ? '' : nameOf(players, victim)
  const eliminated = phase === 'boom' && Boolean(state.boom?.eliminated)
  const firstOut = eliminated && state.roster.filter((id) => !isAlive(state, id)).length === 1
  const decided = phase === 'boom' && gameDecided(state)
  const themeText = state.theme?.text ?? ''
  const champs = phase === 'final' ? winners(state) : []
  const finalText = phase === 'final' ? finalLine(listNames(champs.map((id) => nameOf(players, id))), champs.length) : ''
  /** Quando a última fala começou: duas falas nunca saem coladas. */
  const lastSpoke = useRef<number | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let stopVoice: (() => void) | null = null
    const later = (ms: number, run: () => void) => timers.push(setTimeout(run, ms))
    const say = (ms: number, text: string) => {
      if (!text) return
      later(paceDelay(ms, lastSpoke.current, Date.now()), () => {
        lastSpoke.current = Date.now()
        stopVoice = speakFestive(text)
      })
    }

    if (phase === 'theme') {
      playSfx('sleigh', { volume: 0.8 })
      say(700, themeLine(round, themeText))
    } else if (phase === 'play') {
      playSfx('fuse')
    } else if (phase === 'boom' && victim === null) {
      // O host apagou o pavio: "ding" de alívio e brilhinho (a tela diz o resto).
      playSfx('ding')
      playSfx('chime', { delay: 0.3 })
    } else if (phase === 'boom') {
      // POF: estouro, brilho de purpurina e o trombone triste da vítima. A
      // piada fica na tela; a voz só fala quando alguém sai do jogo.
      playSfx('pop', { volume: 1.4 })
      playSfx('boom', { volume: 0.8, delay: 0.05 })
      playSfx('chime', { volume: 0.9, delay: 0.2 })
      const sad = playSfx('fail', { volume: 0.8, delay: 1 })
      if (eliminated) say(1000 + Math.round(sad * 1000), outLine(victimName))
      // Visita de Natal só nos momentos grandes, depois da tela do POF: o
      // primeiro a sair ganha o boneco de neve acenando do canto, o POF que
      // decide o jogo traz um presente de paraquedas e, de vez em quando, o
      // duende desconfiado 🤨 espia quem estourou.
      const visit: Cameo | null = firstOut ? 'snowman' : decided ? 'parachuteGift' : Math.random() < 0.18 ? 'peek' : null
      if (visit) later(BOOM_REVEAL_MS + 300, () => triggerScare(visit, { name: victimName }))
    } else if (phase === 'final') {
      playSfx('win')
      playSfx('sleigh', { delay: 0.8 })
      say(1600, finalText)
    }

    return () => {
      timers.forEach(clearTimeout)
      stopVoice?.()
    }
  }, [moment, phase, round, victim, victimName, eliminated, firstOut, decided, themeText, finalText])

  // Cada passe faz "fuuu" (o presente voando) e às vezes um "boing" na chegada.
  const passKey = phase === 'play' && state.passes > 0 ? `${state.round}-${state.passes}` : null
  const passes = state.passes
  useEffect(() => {
    if (!passKey) return
    playSfx('whoosh', { volume: 0.45 })
    if (passes % 4 === 0) playSfx('boing', { volume: 0.5, delay: 0.3 })
  }, [passKey, passes])

  // O presente esquentou: guizo do trenó e o pavio chiando mais forte.
  const heatKey = phase === 'play' && state.heat > 0 ? `${state.round}-${state.heat}` : null
  useEffect(() => {
    if (!heatKey) return
    playSfx('sleigh', { volume: 0.9 })
    playSfx('fuse', { delay: 0.25 })
  }, [heatKey])

  // Tique-taque acelerando quando o pavio de quem segura passa dos 5 s finais.
  const fuseEnd = phase === 'play' ? state.fuseEnd : null
  useEffect(() => {
    if (fuseEnd === null) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = () => {
      const left = fuseEnd - now()
      if (left <= 0) {
        // Pavio zerado: um "boing" de "ih…" no segundo de suspense antes do POF
        // (o juiz ainda espera um passe que esteja na rede).
        playSfx('boing', { volume: 0.8 })
        return
      }
      if (left > TICK_FROM_MS) {
        timer = setTimeout(loop, left - TICK_FROM_MS)
        return
      }
      playSfx('tick', { volume: 0.55 + 0.6 * (1 - left / TICK_FROM_MS) })
      timer = setTimeout(loop, Math.max(110, Math.min(900, left / 5.5)))
    }
    loop()
    return () => clearTimeout(timer)
  }, [fuseEnd, now])
}

// ---------------------------------------------------------------------------
// Palco: barra de cima, mesa e o POF
// ---------------------------------------------------------------------------

function Stage({ state, players, now }: { state: AbbState; players: HPlayer[]; now: () => number }) {
  // 5 quadros por segundo bastam para a corda queimar lisa (os números mudam de 1 em 1 s).
  const t = useServerNow(now, 200)
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
      <TopBar state={state} players={players} now={now} />
      <Table state={state} players={players} t={t} />
      <BoomReveal state={state} players={players} t={t} />
    </Box>
  )
}

function TopBar({ state, players, now }: { state: AbbState; players: HPlayer[]; now: () => number }) {
  const play = state.phase === 'play'
  const deadline = play ? state.fuseEnd : state.deadline
  const total =
    state.phase === 'theme'
      ? themeSecondsFor(state.round) * 1000
      : play
        ? state.fuseMs / heatRate(state.heat) + ARRIVAL_GRACE_MS
        : BOOM_SECONDS * 1000
  const label =
    state.phase === 'theme'
      ? 'valendo em'
      : play
        ? `pavio de ${nameOf(players, state.holder)}`
        : gameDecided(state)
          ? 'fim de jogo em'
          : 'próxima rodada'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1 }}
        >
          🎁 RODADA {state.round}/{state.totalRounds}
          {state.mode === 'digitar' ? ' · ✍️ DIGITAR' : ''}
        </Typography>
        {play && state.heat > 0 && <HeatBadge key={state.heat} heat={state.heat} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-muted)', textAlign: 'right', maxWidth: '28vw' }}>
          {label}
        </Typography>
        <CandleTimer deadline={deadline} total={total} now={now} size={140} />
      </Box>
    </Box>
  )
}

function HeatBadge({ heat }: { heat: number }) {
  return (
    <Box
      className="animate-pop-in"
      sx={{
        alignSelf: 'flex-start',
        px: 2.5,
        py: 0.75,
        borderRadius: 'var(--radius-full)',
        background: `linear-gradient(90deg, ${ACCENT.main}, #f59e0b)`,
        color: '#fff6dc',
        fontWeight: 800,
        fontSize: 'clamp(1.75rem, 2.1vw, 2.3rem)',
        lineHeight: 1.1,
        boxShadow: `0 0 26px ${ACCENT.glow}`,
      }}
    >
      🔥 O PRESENTE ESQUENTOU · pavio {heatLabel(heat)}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// A mesa
// ---------------------------------------------------------------------------

function Table({ state, players, t }: { state: AbbState; players: HPlayer[]; t: number }) {
  const count = state.roster.length
  const compact = count > 10
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const holderIndex = state.holder === null ? -1 : state.roster.indexOf(state.holder)
  const seat = holderIndex >= 0 ? seatPosition(holderIndex, count) : { x: 50, y: 50 }
  const spot = holderIndex >= 0 ? towardCenter(seat, 0.3) : seat
  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: 520, lg: 600 } }}>
      {/* A toalha da ceia: veludo verde com uma fita dourada cruzando, como um presente. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: '11%',
          right: '11%',
          top: '19%',
          bottom: '19%',
          borderRadius: '120px',
          background: [
            'linear-gradient(90deg, transparent calc(50% - 22px), rgba(255, 209, 102, 0.1) calc(50% - 22px), rgba(255, 209, 102, 0.1) calc(50% + 22px), transparent calc(50% + 22px))',
            'linear-gradient(0deg, transparent calc(50% - 22px), rgba(255, 209, 102, 0.07) calc(50% - 22px), rgba(255, 209, 102, 0.07) calc(50% + 22px), transparent calc(50% + 22px))',
            'radial-gradient(ellipse at center, rgba(31, 157, 85, 0.42) 0%, rgba(14, 70, 48, 0.55) 55%, rgba(6, 16, 31, 0.3) 100%)',
          ].join(', '),
          border: `4px dashed rgba(255, 209, 102, 0.45)`,
          boxShadow: 'inset 0 0 90px rgba(0, 0, 0, 0.45), 0 0 40px rgba(79, 214, 126, 0.15)',
        }}
      />
      <Center state={state} players={players} t={t} />
      {state.roster.map((id, index) => {
        const at = seatPosition(index, count)
        return (
          <Seat
            key={id}
            state={state}
            id={id}
            name={nameOf(players, id)}
            x={at.x}
            y={at.y}
            online={online.has(id)}
            compact={compact}
            // Só o pavio de quem segura anda com o relógio: os outros assentos não redesenham.
            t={state.phase === 'play' && state.holder === id ? t : 0}
          />
        )
      })}
      <Present state={state} spot={spot} t={t} />
    </Box>
  )
}

type SeatProps = {
  state: AbbState
  id: number
  name: string
  x: number
  y: number
  online: boolean
  compact: boolean
  t: number
}

const Seat = memo(function Seat({ state, id, name, x, y, online, compact, t }: SeatProps) {
  const alive = isAlive(state, id)
  const holding = state.holder === id && (state.phase === 'play' || state.phase === 'theme')
  const burning = state.phase === 'play' && state.holder === id && t >= holdStartOf(state)
  const exploded = state.phase === 'boom' && state.boom?.victim === id
  const ms = realMsLeft(state, id, t)
  const urgent = burning && ms <= TICK_FROM_MS
  const line = 'clamp(1.75rem, 2vw, 2.2rem)'
  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: holding ? 3 : 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        maxWidth: compact ? 240 : 320,
      }}
    >
      {/* Quem virou boneco de neve fica clarinho e congelado, com ☃️ no crachá. */}
      <Box sx={{ opacity: alive ? 1 : 0.6, filter: alive ? 'none' : 'saturate(0.2) brightness(1.25)', maxWidth: '100%' }}>
        <PlayerBadge
          name={name}
          size="lg"
          highlight={holding || exploded}
          offline={alive && !online}
          acted={state.phase === 'play' && state.acted.includes(id)}
          trailing={alive ? undefined : '☃️'}
        />
      </Box>
      {alive ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: line, lineHeight: 1, letterSpacing: '-0.04em' }}>
            {heartsText(livesOf(state, id), state.maxLives)}
          </Typography>
          <FuseRope
            fraction={exploded ? 0 : fuseFraction(state, id, t)}
            burning={burning}
            width={compact ? 70 : 110}
            height={compact ? 10 : 12}
          />
          <Typography
            className={urgent ? 'animate-urgent' : undefined}
            sx={{
              fontFamily: 'var(--font-numeric)',
              fontSize: line,
              lineHeight: 1,
              minWidth: '2.4ch',
              color: urgent ? ACCENT.main : burning ? GOLD : 'var(--text-secondary)',
            }}
          >
            {exploded ? '🎊' : `${secondsOf(ms)}s`}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: line, lineHeight: 1, color: '#bfe6ff' }}>☃️ boneco de neve</Typography>
      )}
    </Box>
  )
})

/** O presente: pula de assento em assento (transição de posição + pulinho a cada passe). */
function Present({ state, spot, t }: { state: AbbState; spot: Point; t: number }) {
  const holder = state.holder
  if (holder === null) return null
  const play = state.phase === 'play'
  const burning = play && t >= holdStartOf(state)
  const ms = realMsLeft(state, holder, t)
  const level = shakeLevel(burning, ms)
  const exploded = state.phase === 'boom' && state.boom?.victim !== null
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 4,
        pointerEvents: 'none',
        transition: 'left 480ms cubic-bezier(0.34, 1.4, 0.64, 1), top 480ms cubic-bezier(0.34, 1.4, 0.64, 1)',
      }}
    >
      <Box
        key={`${state.round}-${state.passes}`}
        sx={{
          animation: 'abbHop 480ms ease-out',
          '@keyframes abbHop': {
            '0%': { transform: 'translateY(0) scale(0.92)' },
            '45%': { transform: 'translateY(-56px) scale(1.12) rotate(-12deg)' },
            '100%': { transform: 'none' },
          },
        }}
      >
        {exploded ? (
          <PofBurst prize={prizeFor(state.round)} />
        ) : (
          <GiftBox
            size={150}
            fuse={play ? fuseFraction(state, holder, t) : null}
            lit={burning}
            mood={state.phase === 'boom' ? 'surprised' : moodFor(level)}
            shake={level}
          />
        )}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// O centro da mesa: tema, com quem está o presente, placar
// ---------------------------------------------------------------------------

function Center({ state, players, t }: { state: AbbState; players: HPlayer[]; t: number }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '52%',
        maxHeight: '56%',
        overflow: 'hidden',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        textAlign: 'center',
      }}
    >
      {state.phase === 'theme' && <ThemeCenter state={state} players={players} />}
      {state.phase === 'play' && <PlayCenter state={state} players={players} t={t} />}
      {state.phase === 'boom' && <BoomCenter state={state} players={players} />}
    </Box>
  )
}

function ThemeLabel() {
  return (
    <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', letterSpacing: '0.3em', fontWeight: 800, color: GOLD, lineHeight: 1 }}>
      ✦ TEMA ✦
    </Typography>
  )
}

function ThemeCenter({ state, players }: { state: AbbState; players: HPlayer[] }) {
  return (
    <Box key={state.round} className="animate-pop-in" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {state.round >= state.totalRounds && (
        <Typography className="hw-pulse" sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color: ACCENT.main, lineHeight: 1 }}>
          🔔 ÚLTIMA RODADA
        </Typography>
      )}
      <ThemeLabel />
      <Typography
        sx={{
          fontFamily: FESTIVE_ROUND_FONT,
          fontWeight: 700,
          fontSize: 'clamp(3.4rem, 5vw, 6rem)',
          lineHeight: 1.02,
          color: 'var(--text-primary)',
          textShadow: `0 0 30px ${ACCENT.glow}, 0 4px 24px rgba(0, 0, 0, 0.6)`,
        }}
      >
        {state.theme.icon} {state.theme.text}
      </Typography>
      <Typography sx={{ fontSize: 'clamp(2rem, 2.6vw, 2.8rem)', color: 'var(--text-secondary)' }}>
        🎁 começa com <b style={{ color: GOLD }}>{nameOf(players, state.holder)}</b>
      </Typography>
      {state.mode === 'digitar' && (
        <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-muted)' }}>
          ✍️ Para passar, escreva uma palavra nova no celular
        </Typography>
      )}
    </Box>
  )
}

function PlayCenter({ state, players, t }: { state: AbbState; players: HPlayer[]; t: number }) {
  // O presente não pula quem está offline (celular bloqueado não é escudo):
  // a TV pede para a mesa chamar a pessoa antes que o pavio acabe.
  const asleep = state.holder !== null && !players.some((player) => player.id === state.holder && player.online)
  // Quem acabou de passar ficou com quase nada de pavio: a TV comemora.
  const closeCall =
    state.from !== null &&
    state.passes > 0 &&
    (state.fuse[String(state.from)] ?? 0) <= CLOSE_CALL_MS &&
    t - state.arrivedAt < CLOSE_CALL_SHOW_MS
  return (
    <>
      <ThemeLabel />
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: 'clamp(2.2rem, 3vw, 3.4rem)', lineHeight: 1.05, color: 'var(--text-primary)' }}>
        {state.theme.icon} {state.theme.text}
      </Typography>
      <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-muted)', mt: 1 }}>o presente está com</Typography>
      <Typography
        key={`${state.round}-${state.passes}`}
        className="animate-pop-in"
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(4rem, 6vw, 6.4rem)',
          lineHeight: 0.95,
          color: ACCENT.main,
          textShadow: `0 0 28px ${ACCENT.glow}, 0 3px 0 #2a0509`,
          wordBreak: 'break-word',
        }}
      >
        {nameOf(players, state.holder)}
      </Typography>
      {asleep ? (
        <Typography className="hw-pulse" sx={{ fontSize: 'clamp(1.9rem, 2.3vw, 2.5rem)', fontWeight: 800, color: GOLD }}>
          💤 celular apagado — chamem!
        </Typography>
      ) : closeCall && state.mode !== 'digitar' ? (
        <Typography className="animate-pop-in" sx={{ fontSize: 'clamp(1.9rem, 2.3vw, 2.5rem)', fontWeight: 800, color: GOLD }}>
          😅 {nameOf(players, state.from)} passou por um fio de lã!
        </Typography>
      ) : state.mode === 'digitar' ? (
        <WordTrail state={state} />
      ) : (
        <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-secondary)' }}>
          fala uma palavra e passa rapidinho!
        </Typography>
      )}
    </>
  )
}

/** Modo digitar: as últimas palavras da rodada, a mais nova primeiro. */
function WordTrail({ state }: { state: AbbState }) {
  const recent = state.words.slice(-6).reverse()
  if (!recent.length) {
    return (
      <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-muted)' }}>
        ✍️ ninguém escreveu ainda
      </Typography>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 0.5 }}>
      {recent.map((entry, index) => (
        <Box
          key={state.words.length - index}
          className={index === 0 ? 'animate-pop-in' : undefined}
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 'var(--radius-full)',
            border: `2px solid ${index === 0 ? GOLD : 'var(--border-medium)'}`,
            background: index === 0 ? 'rgba(255, 209, 102, 0.14)' : 'transparent',
            fontSize: 'clamp(1.75rem, 2vw, 2.2rem)',
            fontWeight: 700,
            opacity: Math.max(0.45, 1 - index * 0.12),
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.word}
        </Box>
      ))}
    </Box>
  )
}

function BoomCenter({ state, players }: { state: AbbState; players: HPlayer[] }) {
  const boom = state.boom
  if (!boom) return null
  const name = nameOf(players, boom.victim)
  const top = standings(state).slice(0, state.roster.length > 8 ? 5 : 4)
  return (
    <>
      <Typography
        sx={{
          fontFamily: FESTIVE_ROUND_FONT,
          fontWeight: 700,
          fontSize: 'clamp(2.8rem, 4.2vw, 4.6rem)',
          lineHeight: 1,
          color: boom.victim === null ? '#9fe8b8' : ACCENT.main,
          textShadow: '0 3px 0 rgba(0, 0, 0, 0.5)',
        }}
      >
        {boom.victim === null ? '🎅 O host salvou o Natal' : `🎊 POF na mão de ${name}!`}
      </Typography>
      <Typography sx={{ fontSize: 'clamp(1.75rem, 2.1vw, 2.3rem)', color: 'var(--text-secondary)' }}>
        {boom.victim === null
          ? 'pavio apagado: ninguém perde vida'
          : boom.eliminated
            ? 'virou boneco de neve ☃️'
            : `perdeu uma vida · ${heartsText(boom.livesLeft, state.maxLives)}`}
        {` · ${boom.passes} ${boom.passes === 1 ? 'passe' : 'passes'}`}
      </Typography>
      {gameDecided(state) && (
        <Typography sx={{ fontSize: 'clamp(1.9rem, 2.3vw, 2.5rem)', fontWeight: 800, color: GOLD }}>
          🏁 Acabou! O placar final já vem.
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, width: '100%', maxWidth: 760 }}>
        {top.map((row) => (
          <StandingRow key={row.id} row={row} name={nameOf(players, row.id)} maxLives={state.maxLives} small />
        ))}
      </Box>
    </>
  )
}

function StandingRow({ row, name, maxLives, small = false }: { row: AbbStanding; name: string; maxLives: number; small?: boolean }) {
  const fontSize = small ? 'clamp(1.75rem, 2vw, 2.2rem)' : 'clamp(1.8rem, 2.4vw, 2.6rem)'
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: small ? 0.5 : 1,
        borderRadius: 'var(--radius-lg)',
        background: row.place === 1 ? 'rgba(255, 209, 102, 0.16)' : 'rgba(255, 255, 255, 0.05)',
        border: `2px solid ${row.place === 1 ? GOLD : 'transparent'}`,
        opacity: row.lives > 0 ? 1 : 0.6,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize, color: 'var(--text-muted)', minWidth: '2.2ch' }}>{row.place}º</Typography>
      <Typography noWrap sx={{ flex: 1, fontSize, fontWeight: 700, textAlign: 'left' }}>
        {name}
      </Typography>
      <Typography sx={{ fontSize, letterSpacing: '0.04em' }}>{heartsText(row.lives, maxLives)}</Typography>
      {!small && (
        <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-muted)', minWidth: '5ch', textAlign: 'right' }}>
          ⏱ {savedText(row.saved)}
        </Typography>
      )}
    </Box>
  )
}

/** O POF em tela cheia, nos primeiros segundos da fase. */
function BoomReveal({ state, players, t }: { state: AbbState; players: HPlayer[]; t: number }) {
  const boom = state.boom
  const startedAt = (state.deadline ?? 0) - BOOM_SECONDS * 1000
  const open = state.phase === 'boom' && boom !== null && t < startedAt + BOOM_REVEAL_MS
  const skipped = boom?.victim === null
  const name = nameOf(players, boom?.victim ?? null)
  const eliminated = Boolean(boom?.eliminated)
  return (
    <PofReveal
      open={open}
      title={skipped ? 'UFA!' : 'POF!'}
      prize={skipped ? '🎅' : prizeFor(state.round)}
      line={skipped ? 'O host apagou o pavio!' : boomLine(state.round, name, eliminated)}
      subtitle={skipped ? 'Ninguém perde vida nesta rodada.' : eliminated ? `${name} agora só assiste ☃️` : `${name} perdeu uma vida`}
    >
      {boom && !skipped && !eliminated && (
        <Typography sx={{ fontSize: { xs: '2.4rem', md: '4rem' }, letterSpacing: '0.08em' }}>
          {heartsText(boom.livesLeft, state.maxLives)}
        </Typography>
      )}
    </PofReveal>
  )
}

// ---------------------------------------------------------------------------
// Fim
// ---------------------------------------------------------------------------

function FinalBoard({ state, players }: { state: AbbState; players: HPlayer[] }) {
  const table = standings(state)
  const champs = winners(state)
  const worst = mostBooms(state)
  const lastStanding = aliveIds(state).length === 1
  const names = (ids: number[]) => listNames(ids.map((id) => nameOf(players, id)))
  const champTitle = lastStanding ? 'Último de pé' : champs.length > 1 ? 'Sobreviventes' : 'Mais vidas no fim'
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ConfettiRain active count={44} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: 3 }}>
        <AwardCard
          icon="🏆"
          title={champTitle}
          names={champs.length ? names(champs) : 'Ninguém sobrou'}
          detail={champs.length ? 'o presente nunca estourou na mão' : 'o presente-bomba venceu todo mundo'}
          big
          delay={0}
        />
        <AwardCard
          icon="🎊"
          title="Ímã de presente-bomba"
          names={worst.ids.length ? names(worst.ids) : 'Ninguém fez POF'}
          detail={worst.count ? `${worst.count} ${worst.count === 1 ? 'POF' : 'POFs'} na cara` : 'milagre de Natal'}
          delay={500}
        />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: table.length > 8 ? { xs: '1fr', lg: '1fr 1fr' } : '1fr',
          gap: 1.25,
          columnGap: 5,
          maxWidth: table.length > 8 ? 'none' : 1100,
        }}
      >
        {table.map((row, index) => (
          <Box key={row.id} className="stagger-in" style={{ animationDelay: `${index * 70}ms` }}>
            <StandingRow row={row} name={nameOf(players, row.id)} maxLives={state.maxLives} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function AwardCard({
  icon,
  title,
  names,
  detail,
  delay,
  big = false,
}: {
  icon: string
  title: string
  names: string
  detail: string
  delay: number
  big?: boolean
}) {
  return (
    <Box
      className="animate-pop-in"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        p: 3,
        borderRadius: 'var(--radius-xl)',
        border: `3px solid ${big ? GOLD : ACCENT.main}`,
        background: big
          ? 'linear-gradient(160deg, rgba(31, 157, 85, 0.35), rgba(6, 16, 31, 0.88) 60%)'
          : 'linear-gradient(160deg, rgba(232, 57, 74, 0.32), rgba(6, 16, 31, 0.88) 60%)',
        boxShadow: `0 0 40px ${big ? 'rgba(255, 209, 102, 0.45)' : ACCENT.glow}`,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 'clamp(3rem, 4vw, 4.4rem)', lineHeight: 1 }}>{icon}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 3vw, 3.2rem)', color: GOLD, mt: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontFamily: FESTIVE_ROUND_FONT, fontWeight: 700, fontSize: big ? 'clamp(4rem, 5.4vw, 6rem)' : 'clamp(2.4rem, 3.4vw, 3.8rem)', lineHeight: 1.05, mt: 1 }}>
        {names}
      </Typography>
      <Typography sx={{ fontSize: 'clamp(1.75rem, 2vw, 2.2rem)', color: 'var(--text-secondary)', mt: 0.5 }}>{detail}</Typography>
    </Box>
  )
}
