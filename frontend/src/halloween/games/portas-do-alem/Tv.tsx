import { useEffect, useRef, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { playSfx, speakSpooky, useMusic } from '../../audio'
import { GRACE_MS, listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import { triggerScare, useSuppressScares, type ScareKind } from '../../scare'
import { BigReveal, CandleTimer, CandyRain, DoorSvg, HauntedTitle, PlayerBadge, SPOOKY_COLORS } from '../../ui'
import { IMPATIENT_LINES } from './content'
import {
  CHOOSE_SECONDS,
  IMPATIENT_FROM,
  STATUS_SECONDS,
  finalStanding,
  ghostsOf,
  nextRoundSetup,
  type PortasReveal,
  type State,
} from './engine'
import { meta } from './meta'
import { SUSPENSE_MS } from './timeline'
import {
  GHOST_TINT,
  MONSTER_GLOW,
  SAFE_GLOW,
  doorViews,
  plural,
  rankingColumns,
  revealClock,
  tvDoorWidth,
  useViewport,
  visibleNames,
  woodFor,
  type DoorView,
  type RevealClock,
} from './view'

/**
 * TV do "Portas do Além": o corredor com as portas. Só desenha o estado —
 * quem decide portas, monstros e mortos é o motor. Na revelação, as portas
 * abrem uma a uma no ritmo de `revealSchedule` (relógio do servidor), a do
 * monstro por último. Letras para 3 metros: texto ≥ 28 px, títulos ≥ 64 px.
 */

const ACCENT = meta.accent
/** Sustos do primeiro sangue (um por partida, variando com a rodada). */
const FIRST_BLOOD_SCARES: readonly ScareKind[] = ['scream', 'pumpkin', 'skeletons', 'doot']
/** Sustos surpresa do meio da partida: só meme, diferentes dos do primeiro sangue. */
const SURPRISE_SCARES: readonly ScareKind[] = ['bruh', 'spider', 'eyes', 'pipe']
const TEXT = 'clamp(1.75rem, 2.2vw, 2.4rem)'
/** Nomes embaixo das portas: menores que o texto corrido, mas nunca abaixo de 28 px. */
const NAME = 'clamp(1.75rem, 1.6vw, 2rem)'
const SMALL_TITLE = 'clamp(2.2rem, 3vw, 3.4rem)'
/** Linhas do ranking final (15 pessoas em 3 colunas): nunca abaixo de 28 px. */
const ROW = 'clamp(1.75rem, 1.6vw, 2.1rem)'

export default function Tv({ state, players, now }: HalloweenViewProps<State>) {
  const phase = state.over ? 'final' : state.phase
  // Meme aleatório no meio da escolha ou das portas abrindo estraga o momento.
  useSuppressScares(phase === 'choose' || phase === 'reveal')
  // Trilha tensa; quando o além perde a paciência, perseguição; no fim, vitória.
  useMusic(state.over ? 'victory' : state.extraMonsters > 0 ? 'chase' : 'tension')
  usePhaseSounds(state, players, now)

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2.5 } }}>
      <TopBar state={state} />
      {/* "Encerrar" do host põe over = true em qualquer fase: o fim vence tudo. */}
      {state.over ? (
        <FinalBoard state={state} players={players} />
      ) : (
        <>
          {state.phase === 'choose' && <ChooseBoard state={state} players={players} now={now} />}
          {state.phase === 'reveal' && state.reveal && (
            <RevealBoard state={state} reveal={state.reveal} players={players} now={now} />
          )}
          {state.phase === 'status' && <StatusBoard state={state} players={players} now={now} />}
        </>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Som e sustos: uma vez por momento (rodada + fase), nunca a cada poll
// ---------------------------------------------------------------------------

function usePhaseSounds(state: State, players: HPlayer[], now: () => number) {
  const phase = state.over ? 'final' : state.phase
  const moment = `${state.round}-${phase}`
  // O estado chega como objeto novo a cada poll; o efeito lê o mais recente
  // por aqui e só dispara quando o momento muda.
  const latest = useRef({ state, players, now })
  useEffect(() => {
    latest.current = { state, players, now }
  })

  useEffect(() => {
    const { state: s, players: people, now: clockNow } = latest.current
    const names = (ids: number[]) => listNames(ids.map((id) => nameOf(people, id)))
    // Na troca de momento só se cancela o que ainda não tocou: narração que
    // já começou termina sozinha (cortada no meio soa como defeito).
    const timers: number[] = []
    const at = (ms: number, run: () => void) => {
      timers.push(window.setTimeout(run, Math.max(0, ms)))
    }

    if (phase === 'choose') {
      playSfx('creak', { volume: 0.8 })
      if (s.round === 1) speakSpooky('Escolham uma porta… se tiverem coragem.')
      else if (s.round === s.totalRounds) speakSpooky('Última rodada! Quem sobreviver, divide a vitória.')
      else if (s.round === IMPATIENT_FROM) {
        playSfx('thunder', { volume: 0.8 })
        speakSpooky('O além está ficando impaciente…')
      }
    }

    if (phase === 'reveal' && s.reveal) {
      const reveal = s.reveal
      const clock = revealClock(reveal, clockNow())
      // TV recarregada no meio da revelação: só toca o que ainda vai acontecer.
      const later = (ms: number, run: () => void) => {
        if (ms - clock.elapsed > -300) at(ms - clock.elapsed, run)
      }
      later(0, () => playSfx('creak'))
      reveal.order.forEach((door, index) => {
        const monster = reveal.monsterDoors.includes(door)
        later(clock.schedule.openAt[index], () => playSfx(monster ? 'monster' : 'door', { volume: monster ? 1.1 : 0.7 }))
      })
      later(clock.schedule.monsterAt - SUSPENSE_MS, () => playSfx('heartbeat'))
      later(clock.schedule.monsterAt, () => {
        const victim = nameOf(people, reveal.victims[0])
        if (reveal.scare === 'final') triggerScare('zoom', { name: victim })
        else if (reveal.scare === 'first-blood') triggerScare(FIRST_BLOOD_SCARES[s.round % FIRST_BLOOD_SCARES.length])
        else if (reveal.scare === 'surprise') {
          const kind = SURPRISE_SCARES[s.round % SURPRISE_SCARES.length]
          // Os olhos no escuro sussurram o nome de quem o monstro pegou.
          triggerScare(kind, kind === 'eyes' ? { name: victim } : undefined)
        } else if (reveal.victims.length) playSfx('scream', { delay: 0.25 })
      })
      later(clock.schedule.resultAt, () => {
        if (reveal.victims.length) {
          playSfx('ghost', { volume: 0.8 })
          const verb = reveal.victims.length === 1 ? 'virou fantasma' : 'viraram fantasmas'
          speakSpooky(`${names(reveal.victims)} ${verb}.`)
        } else if (!reveal.saved) {
          // A salvação tem a própria festa (BigReveal com risada).
          playSfx('fail')
          speakSpooky('O monstro não pegou ninguém.')
        }
      })
    }

    if (phase === 'status') playSfx(s.reveal?.victims.length ? 'bell' : 'pop', { volume: 0.6 })

    if (phase === 'final') {
      playSfx('organ')
      const { winners } = finalStanding(s)
      const line =
        winners.length === 1
          ? `${names(winners)} sobreviveu ao além!`
          : winners.length > 1
            ? `Empate dos últimos: ${names(winners)}.`
            : 'Ninguém sobreviveu.'
      at(1200, () => speakSpooky(line))
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [moment, phase])

  // Tique-taque nos últimos 5 segundos da escolha.
  const { seconds } = useCountdown(state.phase === 'choose' && !state.over ? state.deadline : null, now, GRACE_MS)
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    playSfx('tick')
  }, [seconds])
}

// ---------------------------------------------------------------------------
// Cabeçalho e portas
// ---------------------------------------------------------------------------

function TopBar({ state }: { state: State }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontFamily: 'var(--font-numeric)', fontSize: 'clamp(1.8rem, 2.4vw, 2.6rem)', color: 'var(--text-secondary)', letterSpacing: '0.12em', lineHeight: 1 }}
        >
          {state.over ? 'FIM DA NOITE' : `RODADA ${state.round} · MÁX. ${state.totalRounds}`}
        </Typography>
        {!state.over && (
          <Typography noWrap sx={{ fontFamily: 'var(--font-display)', fontSize: SMALL_TITLE, color: ACCENT.light, lineHeight: 1.1, mt: 0.5 }}>
            📍 {state.corridor}
          </Typography>
        )}
      </Box>
      {!state.over && state.phase !== 'status' && (
        <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          🚪 {plural(state.doors, 'porta', 'portas')} · 👹 {plural(state.monsters, 'monstro', 'monstros')}
        </Typography>
      )}
    </Box>
  )
}

/** "O além está ficando impaciente…" (rodada 8+) e o aviso da última rodada. */
function OmenBanner({ round, totalRounds, extra }: { round: number; totalRounds: number; extra: number }) {
  if (extra <= 0 && round < totalRounds) return null
  const count = IMPATIENT_LINES.length
  const line = IMPATIENT_LINES[(((round - IMPATIENT_FROM) % count) + count) % count] ?? IMPATIENT_LINES[0]
  const text =
    round >= totalRounds
      ? '⚠️ Última rodada: quem sobreviver divide a vitória!'
      : `😤 ${line} +${plural(extra, 'monstro', 'monstros')}`
  return (
    <Box
      className="animate-pop-in"
      sx={{
        alignSelf: 'center',
        px: 3,
        py: 1,
        borderRadius: 'var(--radius-full)',
        border: `3px solid ${MONSTER_GLOW}`,
        background: 'rgba(80, 6, 12, 0.72)',
        boxShadow: `0 0 30px rgba(220, 38, 38, 0.45)`,
      }}
    >
      <Typography className="hw-pulse" sx={{ fontSize: TEXT, fontWeight: 800, color: '#fecaca', textAlign: 'center' }}>
        {text}
      </Typography>
    </Box>
  )
}

function Corridor({
  doors,
  views,
  clock,
  players,
  victims,
  autoPicked,
  ghostRow = false,
  timer,
  now,
}: {
  doors: number
  views: DoorView[] | null
  clock: RevealClock | null
  players: HPlayer[]
  victims: number[]
  autoPicked: number[]
  /** Reserva a linha "👻 N" em cima das portas (só quando algum fantasma votou). */
  ghostRow?: boolean
  timer: { deadline: number | null; total: number; grace: boolean }
  now: () => number
}) {
  const viewport = useViewport()
  const width = tvDoorWidth(doors, { width: viewport.width - 260, height: viewport.height })
  // A vela acompanha a porta: grande na TV grande, sem esticar o corredor na
  // pequena. Mínimo 140 px: os segundos da vela (20% do tamanho) ficam ≥ 28 px.
  const candle = Math.round(Math.min(180, Math.max(140, width * 1.6 * 0.75)))
  // Suspense: as portas que faltam (as do monstro) tremem antes de abrir.
  const suspense = clock !== null && !clock.monsterOut && clock.opened.size >= doors - (views?.filter((v) => v.monster).length ?? 0)
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        px: { xs: 2, md: 4 },
        pt: 3,
        // Espaço para o chão do corredor não cobrir os nomes.
        pb: '34px',
        borderRadius: 'var(--radius-xl)',
        background: `
          linear-gradient(180deg, rgba(12, 6, 22, 0.15), rgba(12, 6, 22, 0.85)),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 46px),
          repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 3px, transparent 3px 92px),
          linear-gradient(180deg, #2a1d3a, #160d22)`,
        border: '2px solid rgba(255, 255, 255, 0.06)',
        boxShadow: `inset 0 -40px 60px rgba(0,0,0,0.55), 0 0 40px ${ACCENT.glow}`,
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: { xs: 2, md: 4 }, minWidth: 0 }}>
        {Array.from({ length: doors }, (_, index) => {
          const door = index + 1
          const view = views?.[index] ?? null
          const open = clock?.opened.has(door) ?? false
          return (
            <DoorColumn
              key={door}
              door={door}
              width={width}
              view={view}
              open={open}
              knock={suspense && !open}
              players={players}
              victims={victims}
              autoPicked={autoPicked}
              ghostRow={ghostRow}
            />
          )
        })}
      </Box>
      <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Timer deadline={timer.deadline} total={timer.total} now={now} grace={timer.grace} size={candle} />
      </Box>
      {/* O chão do corredor */}
      <Box
        aria-hidden
        sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', background: 'linear-gradient(180deg, #3b2716, #1a1009)' }}
      />
    </Box>
  )
}

function DoorColumn({
  door,
  width,
  view,
  open,
  knock,
  players,
  victims,
  autoPicked,
  ghostRow,
}: {
  door: number
  width: number
  view: DoorView | null
  open: boolean
  knock: boolean
  players: HPlayer[]
  victims: number[]
  autoPicked: number[]
  ghostRow: boolean
}) {
  const monster = view?.monster ?? null
  const revealing = view !== null
  const shown = open && revealing
  const people = view?.players ?? []
  // Porta lotada: até 4 linhas (3 nomes e "+N"), para a legenda caber embaixo.
  const names = visibleNames(people)
  return (
    <Box sx={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {/* Votos dos fantasmas nesta porta, depois que ela abre (na escolha, segredo).
          Sem fantasma votando (1ª rodada), a linha nem existe: sobra altura. */}
      {revealing && ghostRow && (
        <Typography sx={{ height: '2.3rem', fontSize: NAME, fontWeight: 800, color: GHOST_TINT, opacity: shown && view.ghosts.length ? 1 : 0, transition: 'opacity 400ms ease' }}>
          {shown && view.ghosts.length ? `👻 ${view.ghosts.length}` : ''}
        </Typography>
      )}
      <DoorSvg
        width={width}
        label={door}
        color={woodFor(door)}
        open={shown}
        knock={knock}
        inside={monster ? <span className="hw-pulse">{monster.emoji}</span> : '🕯️'}
        glow={monster ? MONSTER_GLOW : SAFE_GLOW}
      />
      {/* Quem estava atrás: claro se escapou, vermelho riscado se o monstro pegou */}
      {revealing && (
        <Box sx={{ minHeight: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 1, width: '100%' }}>
          {shown &&
            (people.length === 0 ? (
              <Typography sx={{ fontSize: NAME, color: 'var(--text-muted)', fontStyle: 'italic' }}>vazia</Typography>
            ) : (
              <>
                {names.shown.map((id) => {
                  const dead = victims.includes(id)
                  const caught = monster !== null
                  return (
                    <Typography
                      key={id}
                      className="stagger-in"
                      noWrap
                      sx={{
                        maxWidth: '100%',
                        fontSize: NAME,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        color: dead ? '#fca5a5' : caught ? '#bef264' : SPOOKY_COLORS.bone,
                        textDecoration: dead ? 'line-through' : 'none',
                      }}
                    >
                      {dead ? '💀' : caught ? '🍀' : '😅'}
                      {autoPicked.includes(id) ? '🎲' : ''} {nameOf(players, id)}
                    </Typography>
                  )
                })}
                {names.more > 0 && (
                  <Typography sx={{ fontSize: NAME, lineHeight: 1.2, fontWeight: 800, color: 'var(--text-muted)' }}>+{names.more}</Typography>
                )}
              </>
            ))}
        </Box>
      )}
    </Box>
  )
}

function Timer({
  deadline,
  total,
  now,
  grace,
  size = 150,
}: {
  deadline: number | null
  total: number
  now: () => number
  grace: boolean
  size?: number
}) {
  return (
    <CandleTimer
      deadline={deadline === null ? null : deadline - (grace ? GRACE_MS : 0)}
      total={total}
      now={now}
      size={size}
    />
  )
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function ChooseBoard({ state, players, now }: { state: State; players: HPlayer[]; now: () => number }) {
  const acted = new Set(state.acted)
  const online = new Set(players.filter((player) => player.online).map((player) => player.id))
  const ghosts = ghostsOf(state)
  const aliveDone = state.alive.filter((id) => acted.has(id)).length
  const ghostDone = ghosts.filter((id) => acted.has(id)).length
  return (
    <Box className="animate-pop-in" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <OmenBanner round={state.round} totalRounds={state.totalRounds} extra={state.extraMonsters} />
      <Corridor
        doors={state.doors}
        views={null}
        clock={null}
        players={players}
        victims={[]}
        autoPicked={[]}
        timer={{ deadline: state.deadline, total: CHOOSE_SECONDS * 1000, grace: true }}
        now={now}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: ghosts.length ? { xs: '1fr', lg: '1.35fr 1fr' } : '1fr',
          gap: { xs: 2, lg: 4 },
          mt: 'auto',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)', mb: 1, fontWeight: 700 }}>
            😨 Vivos: escolham uma porta no celular · {aliveDone}/{state.alive.length}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {state.alive.map((id) => (
              <PlayerBadge key={id} name={nameOf(players, id)} acted={acted.has(id)} offline={!online.has(id)} size="lg" />
            ))}
          </Box>
        </Box>
        {ghosts.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: TEXT, color: GHOST_TINT, mb: 1, fontWeight: 700 }}>
              👻 Fantasmas: escolham onde o monstro ataca · {ghostDone}/{ghosts.length}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {ghosts.map((id) => (
                <PlayerBadge key={id} name={nameOf(players, id)} acted={acted.has(id)} ghost offline={!online.has(id)} size="lg" />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function RevealBoard({ state, reveal, players, now }: { state: State; reveal: PortasReveal; players: HPlayer[]; now: () => number }) {
  const t = useServerNow(now, 200)
  const clock = revealClock(reveal, t)
  const views = doorViews(reveal, reveal.order.length)
  const names = (ids: number[]) => listNames(ids.map((id) => nameOf(players, id)))
  const beasts = reveal.beasts
  const hunters = Object.keys(reveal.hunters).map(Number)
  // A salvação é rara e merece tela cheia por uns segundos.
  const salvation = reveal.saved && clock.resultShown && clock.elapsed < clock.schedule.resultAt + 3200

  let caption: ReactNode
  if (clock.resultShown) {
    caption = (
      <>
        <Typography
          className="animate-pop-in"
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(4rem, 4.6vw, 5.2rem)',
            lineHeight: 1.05,
            color: reveal.victims.length ? '#f87171' : reveal.saved ? '#bef264' : SPOOKY_COLORS.bone,
            textShadow: '0 4px 24px rgba(0,0,0,0.7)',
          }}
        >
          {reveal.victims.length
            ? `💀 ${names(reveal.victims)} ${reveal.victims.length === 1 ? 'virou fantasma!' : 'viraram fantasmas!'}`
            : reveal.saved
              ? `🍀 ${reveal.salvation} Ninguém morreu.`
              : '😅 O monstro não pegou ninguém!'}
        </Typography>
        {hunters.length > 0 && (
          <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: GHOST_TINT, mt: 1 }}>
            🎯 {names(hunters)} {hunters.length === 1 ? 'mandou' : 'mandaram'} o monstro para a porta certa
          </Typography>
        )}
        {reveal.last && (
          <Typography sx={{ fontSize: TEXT, fontWeight: 800, color: ACCENT.light, mt: 1 }}>🏁 Fim de jogo!</Typography>
        )}
      </>
    )
  } else if (clock.monsterOut) {
    caption = (
      <Typography className="animate-pop-in" sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 4.6vw, 5.2rem)', lineHeight: 1.05, color: '#f87171' }}>
        {beasts.map((beast) => beast.emoji).join(' ')} {beasts.length > 1 ? 'Eram' : 'Era'} {listNames(beasts.map((beast) => beast.name))}!
      </Typography>
    )
  } else {
    const safeOpen = clock.opened.size
    caption = (
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 4.4vw, 4.8rem)', lineHeight: 1.05, color: SPOOKY_COLORS.bone }}>
        {safeOpen === 0
          ? '🚪 As portas vão abrir…'
          : safeOpen >= reveal.order.length - reveal.monsterDoors.length
            ? `😱 ${reveal.monsterDoors.length > 1 ? 'Onde estão os monstros?' : 'Onde está o monstro?'}`
            : '😅 Essa estava segura…'}
      </Typography>
    )
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Corridor
        doors={reveal.order.length}
        views={views}
        clock={clock}
        players={players}
        victims={reveal.victims}
        autoPicked={reveal.autoPicked}
        ghostRow={Object.keys(reveal.ghostVotes).length > 0}
        timer={{ deadline: state.deadline, total: clock.schedule.total, grace: false }}
        now={now}
      />
      <Box sx={{ textAlign: 'center', mt: 'auto', mb: 1 }}>{caption}</Box>
      {reveal.autoPicked.length > 0 && !clock.resultShown && (
        <Typography sx={{ textAlign: 'center', fontSize: TEXT, color: 'var(--text-muted)' }}>
          🎲 {names(reveal.autoPicked)}{' '}
          {reveal.autoPicked.length === 1 ? 'não escolheu e caiu numa porta sorteada' : 'não escolheram e caíram em portas sorteadas'}
        </Typography>
      )}
      <BigReveal open={salvation} icon="🍌" title={reveal.salvation || 'O monstro tropeçou!'} subtitle="Ninguém morreu nesta rodada" tone="toxic" sound="laugh" />
    </Box>
  )
}

function StatusBoard({ state, players, now }: { state: State; players: HPlayer[]; now: () => number }) {
  const ghosts = ghostsOf(state)
  const fresh = new Set(state.reveal?.victims ?? [])
  const next = nextRoundSetup(state)
  const nextRound = state.round + 1
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
        <HauntedTitle size="clamp(4rem, 6.4vw, 7rem)" color={ACCENT.light} glow={ACCENT.main} drip align="left">
          {state.alive.length === 1 ? 'Resta 1 vivo' : `Restam ${state.alive.length} vivos`}
        </HauntedTitle>
        <Timer deadline={state.deadline} total={STATUS_SECONDS * 1000} now={now} grace={false} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 4 }}>
        <Box>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: SMALL_TITLE, color: SPOOKY_COLORS.bone, mb: 1 }}>😨 Vivos</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {state.alive.map((id) => (
              <PlayerBadge key={id} name={nameOf(players, id)} size="lg" />
            ))}
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: SMALL_TITLE, color: GHOST_TINT, mb: 1 }}>
            👻 Fantasmas {ghosts.length ? '' : '(nenhum ainda)'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {ghosts.map((id) => (
              <PlayerBadge
                key={id}
                name={nameOf(players, id)}
                ghost
                highlight={fresh.has(id)}
                size="lg"
                trailing={(state.souls[String(id)] ?? 0) > 0 ? `🎯${state.souls[String(id)]}` : undefined}
              />
            ))}
          </Box>
        </Box>
      </Box>
      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: TEXT, fontWeight: 800, textAlign: 'center' }}>
          Próxima rodada: 🚪 {plural(next.doors, 'porta', 'portas')} · 👹 {plural(next.monsters, 'monstro', 'monstros')}
        </Typography>
        <OmenBanner round={nextRound} totalRounds={state.totalRounds} extra={next.extra} />
      </Box>
    </Box>
  )
}

function FinalBoard({ state, players }: { state: State; players: HPlayer[] }) {
  const standing = finalStanding(state)
  const columns = rankingColumns(standing.ranking.length)
  const names = (ids: number[]) => listNames(ids.map((id) => nameOf(players, id)))
  const title =
    standing.winners.length === 1
      ? `${names(standing.winners)} sobreviveu!`
      : standing.winners.length > 1
        ? 'Empate dos últimos!'
        : 'Ninguém sobreviveu…'
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CandyRain active kind="mixed" count={36} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', lineHeight: 1 }}>{standing.winners.length ? '🏆' : '⚰️'}</Typography>
        <HauntedTitle size="clamp(4rem, 6.6vw, 7.4rem)" drip>
          {title}
        </HauntedTitle>
        {standing.winners.length > 1 && (
          <Typography sx={{ fontSize: SMALL_TITLE, fontWeight: 800, mt: 1 }}>
            {names(standing.winners)} {state.round >= state.totalRounds ? 'aguentaram até o além desistir' : 'continuam vivos'}
          </Typography>
        )}
      </Box>
      <Box
        className="animate-pop-in"
        style={{ animationDelay: '500ms' }}
        sx={{
          alignSelf: 'center',
          px: 4,
          py: 2,
          borderRadius: 'var(--radius-xl)',
          border: `3px solid ${GHOST_TINT}`,
          background: 'var(--bg-veil-strong, rgba(10, 6, 18, 0.82))',
          boxShadow: '0 0 40px rgba(125, 211, 252, 0.35)',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: SMALL_TITLE, color: GHOST_TINT }}>👻 Fantasma mais vingativo</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 'clamp(2.4rem, 3.4vw, 3.8rem)', lineHeight: 1.1 }}>
          {standing.avengers.length ? names(standing.avengers) : 'Nenhum fantasma acertou'}
        </Typography>
        <Typography sx={{ fontSize: TEXT, color: 'var(--text-secondary)' }}>
          {standing.avengers.length ? `${plural(standing.maxSouls, 'alma levada', 'almas levadas')}` : 'os vivos tiveram sorte'}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          // 15 pessoas = 3 colunas de 5: o ranking inteiro cabe sem rolar.
          gridTemplateColumns: { xs: '1fr', lg: `repeat(${columns}, minmax(0, 1fr))` },
          gap: 1,
          columnGap: 4,
          width: '100%',
          maxWidth: columns > 1 ? 'none' : 1000,
          alignSelf: 'center',
        }}
      >
        {standing.ranking.map((entry, index) => {
          const died = state.diedIn[String(entry.id)]
          const souls = state.souls[String(entry.id)] ?? 0
          return (
            <Box
              key={entry.id}
              className="stagger-in"
              style={{ animationDelay: `${index * 70}ms` }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                minWidth: 0,
                px: 2,
                py: 0.5,
                borderRadius: 'var(--radius-lg)',
                background: entry.place === 1 ? `${ACCENT.main}2e` : 'rgba(255, 255, 255, 0.04)',
                border: `2px solid ${entry.place === 1 ? ACCENT.main : 'transparent'}`,
              }}
            >
              <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: ROW, color: 'var(--text-muted)', minWidth: '2.2ch' }}>
                {entry.place}º
              </Typography>
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: ROW, fontWeight: 800 }}>
                {died === undefined ? '😨 ' : '👻 '}
                {nameOf(players, entry.id)}
              </Typography>
              <Typography sx={{ fontSize: ROW, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {died === undefined ? 'vivo' : `${died}ª rodada`}
                {souls > 0 ? ` · 🎯${souls}` : ''}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
