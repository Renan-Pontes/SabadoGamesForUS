import { Suspense, useEffect, useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { RoomAvatarsProvider } from '../natal/avatars'
import { useMusic } from '../halloween/audio'
import { runSimulation } from '../halloween/engine/testkit'
import type { BaseState, HInput, HPlayer, HalloweenViewProps } from '../halloween/engine/types'
import { CenterMessage, HalloweenFrame } from '../halloween/framework/Frame'
import PhaseFlourish from '../halloween/framework/PhaseFlourish'
import { ViewBoundary } from '../halloween/framework/ViewBoundary'
import { HALLOWEEN_REGISTRY } from '../halloween/registry'
import { CAMEOS, CAMEO_INFO, triggerScare } from '../halloween/scare'
import type { Cameo } from '../halloween/scare'
import { SEASON_SLUGS } from '../season'

/**
 * Prévia dos jogos (só no `npm run dev`, em /dev/preview).
 *
 * Joga uma partida simulada com bots e deixa navegar pelos momentos dela,
 * desenhando a TV ou o celular de qualquer jogador — com animação e som de
 * verdade (os efeitos rodam, ao contrário do teste de fumaça). Serve para
 * conferir o visual de cada fase sem montar uma sala com 15 celulares.
 *
 *   /dev/preview?game=pergunta-trocada&players=8&view=tv&step=12&auto=1
 */

const NAMES = [
  'Ana', 'Beto', 'Carla', 'Duda', 'Edu', 'Fê', 'Gabi', 'Hugo',
  'Isa', 'João', 'Kaká', 'Léo', 'Malu', 'Nina', 'Otávio',
]

const PREVIEW_SLUGS = SEASON_SLUGS.filter((slug) => slug in HALLOWEEN_REGISTRY) as (keyof typeof HALLOWEEN_REGISTRY)[]

function previewPlayers(n: number): HPlayer[] {
  return Array.from({ length: n }, (_, index) => ({
    id: index + 1,
    name: NAMES[index] ?? `Jogador ${index + 1}`,
    isHost: index === 0,
    online: true,
  }))
}

function readParams() {
  const params = new URLSearchParams(window.location.search)
  const game = params.get('game')
  return {
    slug: PREVIEW_SLUGS.includes(game as (typeof PREVIEW_SLUGS)[number])
      ? (game as (typeof PREVIEW_SLUGS)[number])
      : PREVIEW_SLUGS[0],
    players: Math.min(15, Math.max(2, Number(params.get('players')) || 6)),
    view: params.get('view') ?? 'tv',
    step: Number(params.get('step')) || 0,
    auto: params.get('auto') === '1',
    seed: Number(params.get('seed')) || 7,
  }
}

function writeParams(next: Record<string, string | number>) {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(next)) params.set(key, String(value))
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
}

type Moment = { state: BaseState & { private?: Record<string, unknown> } }

export default function Preview() {
  const [initial] = useState(readParams)
  const [slug, setSlug] = useState(initial.slug)
  const [count, setCount] = useState(initial.players)
  const [view, setView] = useState(initial.view)
  const [step, setStep] = useState(initial.step)
  const [auto, setAuto] = useState(initial.auto)
  const [cameo, setCameo] = useState<Cameo>('cookie')
  const game = HALLOWEEN_REGISTRY[slug]
  const players = useMemo(() => previewPlayers(count), [count])

  // Uma partida inteira com bots; cada estado diferente vira um "momento".
  const moments = useMemo<Moment[]>(() => {
    const result = runSimulation(game.engine, { players, seed: initial.seed, maxSteps: 4000 })
    const seen = new Set<string>()
    const list: Moment[] = []
    for (const state of result.history) {
      const key = `${state.phase}|${state.round ?? ''}|${state.inputKey}|${state.over}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ state: state as Moment['state'] })
    }
    return list
  }, [game, players, initial.seed])

  const index = Math.min(step, moments.length - 1)
  const full = moments[index].state

  useEffect(() => writeParams({ game: slug, players: count, view, step: index, auto: auto ? 1 : 0 }), [slug, count, view, index, auto])

  // Modo automático: avança um momento a cada 5 s (dá tempo de a animação e o som rodarem).
  useEffect(() => {
    if (!auto) return
    const timer = window.setInterval(() => setStep((current) => (current + 1) % moments.length), 5000)
    return () => window.clearInterval(timer)
  }, [auto, moments.length])

  useMusic(view === 'tv' ? (full.over ? (game.meta.victoryMusic ?? 'victory') : (game.meta.music ?? 'lobby')) : null)

  const { private: secrets, ...publicState } = full
  // Relógio da simulação (começa em 1.000.000 ms): 8 s antes do prazo da fase.
  const at = typeof full.deadline === 'number' ? full.deadline - 8000 : 1_000_000
  const viewer = view === 'tv' ? null : players.find((player) => String(player.id) === view) ?? players[0]
  const mine = viewer ? ((secrets?.[String(viewer.id)] ?? null) as HalloweenViewProps['mine']) : null
  const myInput: HInput | null = null
  const noop = () => {}
  const props: HalloweenViewProps = {
    code: 'PREVIA',
    view: viewer ? (viewer.isHost ? 'host' : 'player') : 'tv',
    state: publicState as BaseState,
    players,
    me: viewer,
    isHost: Boolean(viewer?.isHost),
    myInput,
    mine,
    now: () => at,
    send: noop,
    sendSlot: noop,
    command: noop,
    slots: {},
    options: {},
  }
  const Screen = viewer ? game.Phone : game.Tv
  // Os bots não respondem no celular aqui: a prévia mostra a tela "antes de responder".

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap',
          px: 2,
          py: 1,
          background: 'rgba(3, 8, 16, 0.92)',
          borderBottom: '1px solid var(--border-medium)',
          fontSize: '0.85rem',
          '& select, & button, & input': { font: 'inherit', fontSize: '0.85rem' },
        }}
      >
        <Typography sx={{ fontWeight: 800, color: 'var(--accent-gold)' }}>PRÉVIA</Typography>
        <select value={slug} onChange={(event) => { setSlug(event.target.value as typeof slug); setStep(0) }}>
          {PREVIEW_SLUGS.map((option) => (
            <option key={option} value={option}>{HALLOWEEN_REGISTRY[option].meta.name}</option>
          ))}
        </select>
        <label>
          jogadores{' '}
          <input type="number" min={2} max={15} value={count} style={{ width: 48 }} onChange={(event) => { setCount(Number(event.target.value)); setStep(0) }} />
        </label>
        <select value={view} onChange={(event) => setView(event.target.value)}>
          <option value="tv">📺 TV</option>
          {players.map((player) => (
            <option key={player.id} value={String(player.id)}>📱 {player.name}{player.isHost ? ' (host)' : ''}</option>
          ))}
        </select>
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>◀</button>
        <input type="range" min={0} max={moments.length - 1} value={index} onChange={(event) => setStep(Number(event.target.value))} />
        <button type="button" onClick={() => setStep((current) => Math.min(moments.length - 1, current + 1))}>▶</button>
        <span>
          {index + 1}/{moments.length} · <b>{full.phase}</b> · rodada {String(full.round ?? '–')}
          {full.over ? ' · FIM' : ''}
        </span>
        <label>
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} /> auto
        </label>
        <select value={cameo} onChange={(event) => setCameo(event.target.value as Cameo)} aria-label="visita de Natal">
          {CAMEOS.map((kind) => (
            <option key={kind} value={kind}>{CAMEO_INFO[kind].icon} {CAMEO_INFO[kind].label}</option>
          ))}
        </select>
        <button type="button" onClick={() => triggerScare(cameo, { name: players[0]?.name })}>testar visita</button>
      </Box>

      <Box sx={{ flex: 1, position: 'relative', ...(viewer ? { maxWidth: 430, width: '100%', mx: 'auto', borderInline: '1px dashed var(--border-medium)' } : {}) }}>
        <RoomAvatarsProvider players={players}>
          <HalloweenFrame meta={game.meta} view={props.view} code="PREVIA" me={viewer}>
            <ViewBoundary
              resetKey={`${slug}:${view}:${index}`}
              fallback={(retry) => (
                <CenterMessage icon="💥" title="A tela quebrou neste momento" text="Veja o console.">
                  <button type="button" onClick={retry}>Tentar de novo</button>
                </CenterMessage>
              )}
            >
              <Suspense fallback={<CenterMessage loading title="Carregando…" />}>
                <Screen key={`${slug}:${view}`} {...props} />
              </Suspense>
            </ViewBoundary>
            {!viewer && <PhaseFlourish moment={`${full.phase}:${full.round ?? ''}:${full.over}`} color={game.meta.accent.main} />}
          </HalloweenFrame>
        </RoomAvatarsProvider>
      </Box>
    </Box>
  )
}
