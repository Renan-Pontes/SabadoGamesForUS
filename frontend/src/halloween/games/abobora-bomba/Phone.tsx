import { useEffect, useState, type ReactNode } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import { listNames, nameOf } from '../../engine/helpers'
import type { HPlayer, HalloweenViewProps } from '../../engine/types'
import { useCountdown, useServerNow } from '../../framework/clockHooks'
import {
  HOLD_TO_PASS_MS,
  HOLD_TO_PASS_TYPED_MS,
  MAX_WORD_LENGTH,
  cleanWord,
  gameDecided,
  holdStartOf,
  isAlive,
  livesOf,
  mostBooms,
  nextInLine,
  realMsLeft,
  standings,
  winners,
  wordAccepted,
  wordUsed,
  type AbbState,
} from './engine'
import FuseRope from './FuseRope'
import HoldButton from './HoldButton'
import { meta } from './meta'
import { TICK_FROM_MS, buzz, fuseFraction, heartsText, heatLabel, savedText, secondsOf } from './view'
import { useWakeLock } from './wakeLock'

/**
 * Celular da Abóbora-Bomba: uma ação clara por tela. Com a abóbora na mão,
 * a tela fica laranja com o tema, o pavio gigante e o botão "SEGURE PARA
 * PASSAR"; sem ela, quem está com a abóbora e o meu pavio.
 */

const ACCENT = meta.accent

type Props = HalloweenViewProps<AbbState>

export default function Phone(props: Props) {
  const { state, me } = props
  // Tela acesa a partida inteira: celular bloqueado não vê a abóbora chegar.
  useWakeLock(me !== null && !state.over)
  if (!me) return null
  if (state.over) return <FinalPanel {...props} />
  if (state.phase === 'theme') return <ThemePanel {...props} />
  if (state.phase === 'boom') return <BoomPanel {...props} />
  if (!isAlive(state, me.id)) return <GhostPanel {...props} />
  // Uma tela nova por posse: o rascunho e o aperto não passam de uma para outra.
  if (state.holder === me.id) return <HolderPanel key={state.inputKey} {...props} />
  return <WaitPanel {...props} />
}

// ---------------------------------------------------------------------------
// Pecinhas
// ---------------------------------------------------------------------------

function Header({ state, me }: { state: AbbState; me: HPlayer }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em' }}>
        RODADA {state.round}/{state.totalRounds}
      </Typography>
      <Typography sx={{ fontSize: '1.25rem', letterSpacing: '0.04em' }}>
        {heartsText(livesOf(state, me.id), state.maxLives)}
      </Typography>
    </Box>
  )
}

function ThemeLine({ state, onOrange = false }: { state: AbbState; onOrange?: boolean }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography
        sx={{
          fontSize: '0.8rem',
          letterSpacing: '0.24em',
          fontWeight: 800,
          color: onOrange ? 'rgba(31, 13, 2, 0.7)' : ACCENT.main,
        }}
      >
        TEMA
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.15, wordBreak: 'break-word' }}>
        {state.theme.icon} {state.theme.text}
      </Typography>
    </Box>
  )
}

function Card({ children, accent = false, glow = false }: { children: ReactNode; accent?: boolean; glow?: boolean }) {
  return (
    <Box
      className={glow ? 'your-turn' : undefined}
      sx={{
        p: 2,
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        border: `2px solid ${accent ? ACCENT.main : 'var(--border-medium)'}`,
        background: accent ? ACCENT.main : 'rgba(255, 255, 255, 0.03)',
        color: accent ? ACCENT.contrast : 'var(--text-primary)',
      }}
    >
      {children}
    </Box>
  )
}

/** Meu pavio fora da minha vez: a corda e os segundos que ele aguenta. */
function MyFuse({ state, me, now }: { state: AbbState; me: HPlayer; now: () => number }) {
  const t = useServerNow(now, 250)
  const ms = realMsLeft(state, me.id, t)
  return (
    <Box sx={{ p: 1.5, borderRadius: 'var(--radius-lg)', border: '2px solid var(--border-medium)', background: 'rgba(255, 255, 255, 0.03)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1, gap: 1 }}>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Seu pavio</Typography>
        <Typography sx={{ fontFamily: 'var(--font-numeric)', fontSize: '1.6rem', lineHeight: 1, color: ACCENT.main }}>
          {secondsOf(ms)} s{state.phase === 'play' && state.heat > 0 ? ` · 🔥 ${heatLabel(state.heat)}` : ''}
        </Typography>
      </Box>
      <FuseRope fraction={fuseFraction(state, me.id, t)} width="100%" height={14} />
    </Box>
  )
}

/** Modo digitar: as últimas palavras, para ninguém repetir. */
function LastWords({ state }: { state: AbbState }) {
  if (state.mode !== 'digitar' || !state.words.length) return null
  const recent = state.words.slice(-5).reverse()
  return (
    <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-word' }}>
      Já foram: {recent.map((entry) => entry.word).join(' · ')}
      {state.words.length > recent.length ? ' …' : ''}
    </Typography>
  )
}

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

function ThemePanel({ state, players, me, now }: Props) {
  const { seconds } = useCountdown(state.deadline, now)
  if (!me) return null
  const ghost = !isAlive(state, me.id)
  const starts = state.holder === me.id
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Header state={state} me={me} />
      <ThemeLine state={state} />
      {ghost ? (
        <Card>
          <Typography sx={{ fontSize: '2.6rem', lineHeight: 1 }}>👻</Typography>
          <Typography sx={{ fontWeight: 700 }}>Você é fantasma: assista pela TV e assombre a mesa.</Typography>
        </Card>
      ) : starts ? (
        <Card accent glow>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1 }}>🎃 VOCÊ COMEÇA!</Typography>
          <Typography sx={{ fontWeight: 700, mt: 0.5 }}>Já pense numa palavra do tema.</Typography>
        </Card>
      ) : (
        <Card>
          <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>🎃 A abóbora começa com</Typography>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}>
            {nameOf(players, state.holder)}
          </Typography>
        </Card>
      )}
      {!ghost && state.mode === 'digitar' && (
        <Typography sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          ✍️ Para passar, escreva uma palavra nova do tema.
        </Typography>
      )}
      {!ghost && <MyFuse state={state} me={me} now={now} />}
      <Typography sx={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
        Valendo em {seconds ?? 0} s…
      </Typography>
    </Box>
  )
}

/** O pavio gigante de quem segura: segundos até o BUM e a corda queimando. */
function BigFuse({ state, me, now, frozenAt }: { state: AbbState; me: HPlayer; now: () => number; frozenAt: number | null }) {
  const live = useServerNow(now, 100)
  // Depois do passe o pavio para no horário do toque (é ele que vale).
  const t = frozenAt ?? live
  const msLeft = state.fuseEnd === null ? 0 : Math.max(0, state.fuseEnd - t)
  const out = msLeft <= 0
  const urgent = !out && frozenAt === null && msLeft <= TICK_FROM_MS
  const burning = !out && frozenAt === null && t >= holdStartOf(state)
  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        className={urgent ? 'animate-urgent' : undefined}
        sx={{
          fontFamily: 'var(--font-numeric)',
          fontSize: '3.9rem',
          lineHeight: 0.9,
          color: urgent || out ? '#7f1d1d' : ACCENT.contrast,
        }}
      >
        {secondsOf(msLeft)}
      </Typography>
      <FuseRope fraction={fuseFraction(state, me.id, t)} burning={burning} width="100%" height={20} color="#fff1c2" />
      <Typography sx={{ fontWeight: 700, mt: 0.5 }}>
        {frozenAt !== null
          ? '⏸ seu pavio parou'
          : out
            ? '💥 sem pavio'
            : burning
              ? '🔥 seu pavio está queimando'
              : '⏳ o pavio já vai acender'}
        {state.heat > 0 ? ` · abóbora quente ${heatLabel(state.heat)}` : ''}
      </Typography>
    </Box>
  )
}

function HolderPanel({ state, me, myInput, send, now }: Props) {
  const t = useServerNow(now, 250)
  const [draft, setDraft] = useState('')
  // A abóbora chegou: o celular avisa na mão.
  useEffect(() => {
    buzz([90, 60, 90])
  }, [])
  if (!me) return null

  const typed = state.mode === 'digitar'
  const out = state.fuseEnd === null || t >= state.fuseEnd
  // Já mandei o passe desta posse (e a palavra ainda vale): só falta o juiz ver.
  const sent = myInput !== null && (!typed || wordAccepted(state.words, myInput.word))
  const sentAt = sent && typeof myInput?.at === 'number' ? myInput.at : null
  const word = cleanWord(draft)
  const repeated = typed && word !== '' && wordUsed(state.words, word)
  const ready = !sent && !out && (!typed || (word !== '' && !repeated))

  const pass = () => {
    if (!ready) return
    send(typed ? { at: now(), word } : { at: now() })
    // Depois do send: o toquinho de 15 ms do framework não corta este.
    buzz([40, 40, 140])
  }

  const label = sent ? '✓ PASSOU!' : out ? '💥 ACABOU' : typed && !word ? 'ESCREVA UMA PALAVRA' : 'SEGURE PARA PASSAR'
  const hint = sent
    ? 'Passando a abóbora…'
    : out
      ? 'O pavio acabou…'
      : typed
        ? 'Escreva uma palavra nova e segure o botão.'
        : 'Fale uma palavra do tema enquanto segura.'

  return (
    <Box
      sx={{
        mx: -2,
        mt: -0.5,
        px: 2,
        pt: 1.5,
        pb: 3,
        minHeight: '80vh',
        borderRadius: '28px 28px 0 0',
        background: `linear-gradient(180deg, ${ACCENT.light} 0%, ${ACCENT.main} 40%, #c2410c 100%)`,
        boxShadow: `0 0 60px ${ACCENT.glow}`,
        color: ACCENT.contrast,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Compacto: num celular baixo, o botão não pode cair atrás da barra do host.
        gap: 0.75,
        textAlign: 'center',
      }}
    >
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 800, letterSpacing: '0.08em', opacity: 0.8 }}>
          RODADA {state.round}/{state.totalRounds}
        </Typography>
        <Typography sx={{ fontSize: '1.2rem' }}>{heartsText(livesOf(state, me.id), state.maxLives)}</Typography>
      </Box>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.95rem', lineHeight: 1 }}>🎃 A ABÓBORA É SUA!</Typography>
      <ThemeLine state={state} onOrange />

      <BigFuse state={state} me={me} now={now} frozenAt={sentAt} />

      {typed && !sent && (
        <Box sx={{ width: '100%' }}>
          <TextField
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_WORD_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                pass()
              }
            }}
            placeholder="Digite uma palavra"
            autoFocus
            fullWidth
            slotProps={{
              htmlInput: {
                maxLength: MAX_WORD_LENGTH,
                autoCapitalize: 'none',
                autoComplete: 'off',
                autoCorrect: 'off',
                spellCheck: false,
                enterKeyHint: 'send',
                'aria-label': 'Sua palavra',
              },
            }}
            sx={{
              '& .MuiInputBase-root': {
                background: '#fff7ed',
                color: '#1f0d02',
                fontSize: '1.4rem',
                fontWeight: 700,
                borderRadius: 2,
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: repeated ? '#7f1d1d' : 'rgba(31, 13, 2, 0.35)', borderWidth: 2 },
            }}
          />
          {repeated && (
            <Typography sx={{ fontWeight: 800, color: '#7f1d1d', mt: 0.5 }}>Essa já foi! Pense em outra.</Typography>
          )}
        </Box>
      )}

      <HoldButton
        holdMs={typed ? HOLD_TO_PASS_TYPED_MS : HOLD_TO_PASS_MS}
        disabled={!ready && !sent}
        done={sent}
        onComplete={pass}
        label={label}
        holdingLabel={typed ? 'PASSANDO…' : 'FALA A PALAVRA!'}
        // No digitar o teclado ocupa a tela (e o Enter também passa): botão menor.
        size={typed ? 150 : 180}
      />
      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{hint}</Typography>
      <LastWords state={state} />
    </Box>
  )
}

function WaitPanel({ state, players, me, now }: Props) {
  // A mesma regra do motor: o próximo vivo da mesa, online ou não.
  const isNext = me !== null && nextInLine(state, state.holder) === me.id
  // Sou o próximo: um toquinho de aviso para já pensar na palavra.
  useEffect(() => {
    if (isNext) buzz(40)
  }, [isNext])
  if (!me) return null
  const iPassed = state.from === me.id
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Header state={state} me={me} />
      <ThemeLine state={state} />
      <Card>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>🎃 A abóbora está com</Typography>
        <Typography
          key={state.inputKey}
          className="animate-pop-in"
          sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1.05, color: ACCENT.main, wordBreak: 'break-word' }}
        >
          {nameOf(players, state.holder)}
        </Typography>
      </Card>
      {isNext ? (
        <Card accent glow>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', lineHeight: 1.05 }}>⚡ VOCÊ É O PRÓXIMO!</Typography>
          <Typography sx={{ fontWeight: 700 }}>Já pense na sua palavra.</Typography>
        </Card>
      ) : (
        <Typography sx={{ textAlign: 'center', fontWeight: 700, color: iPassed ? 'var(--status-ready, #8cf045)' : 'var(--text-secondary)' }}>
          {iPassed ? '✓ Você passou! Respira…' : 'Prepare uma palavra: a abóbora pode vir rápido.'}
        </Typography>
      )}
      <MyFuse state={state} me={me} now={now} />
      <LastWords state={state} />
    </Box>
  )
}

function GhostPanel({ state, players, me }: Props) {
  if (!me) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
      <Header state={state} me={me} />
      <Typography className="hw-float" sx={{ fontSize: '4.5rem', lineHeight: 1 }}>
        👻
      </Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', lineHeight: 1.05 }}>Você virou fantasma</Typography>
      <Typography sx={{ color: 'var(--text-secondary)' }}>Assista pela TV e torça (ou assombre) a mesa.</Typography>
      <Card>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>🎃 A abóbora está com</Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: ACCENT.main, wordBreak: 'break-word' }}>
          {nameOf(players, state.holder)}
        </Typography>
      </Card>
    </Box>
  )
}

function BoomPanel({ state, players, me, now }: Props) {
  const { seconds } = useCountdown(state.deadline, now)
  const victim = state.boom?.victim ?? null
  const mine = me !== null && victim === me.id
  // Explodiu na minha mão: vibração comprida.
  useEffect(() => {
    if (mine) buzz([350, 120, 350])
  }, [mine])
  if (!me) return null
  const boom = state.boom
  const decided = gameDecided(state)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
      <Header state={state} me={me} />
      <Box className="animate-pop-in">
        <Typography sx={{ fontSize: '4.5rem', lineHeight: 1 }}>{victim === null ? '🧯' : mine && boom?.eliminated ? '👻' : '💥'}</Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.3rem',
            lineHeight: 1.05,
            mt: 1,
            color: mine ? 'var(--blood, #e0213a)' : 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {victim === null ? 'Ufa! Pavio apagado.' : mine ? 'VOCÊ EXPLODIU!' : `BUM! Explodiu com ${nameOf(players, victim)}`}
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', mt: 1, fontSize: '1.1rem' }}>
          {victim === null
            ? 'O host encerrou a rodada: ninguém perde vida.'
            : mine
              ? boom?.eliminated
                ? 'Acabaram suas vidas: agora você é fantasma.'
                : `Perdeu uma vida. Sobrou ${boom?.livesLeft ?? 0}.`
              : boom?.eliminated
                ? 'Virou fantasma 👻'
                : 'Perdeu uma vida.'}
        </Typography>
      </Box>
      <Card>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>Suas vidas</Typography>
        <Typography sx={{ fontSize: '2rem', letterSpacing: '0.06em' }}>{heartsText(livesOf(state, me.id), state.maxLives)}</Typography>
      </Card>
      <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>
        {decided ? 'Fim de jogo! Olhe a TV.' : `Próxima rodada em ${seconds ?? 0} s…`}
      </Typography>
    </Box>
  )
}

function FinalPanel({ state, players, me }: Props) {
  if (!me) return null
  const table = standings(state)
  const mine = table.find((row) => row.id === me.id)
  const champs = winners(state)
  const worst = mostBooms(state)
  const iWon = champs.includes(me.id)
  const names = (ids: number[]) => listNames(ids.map((id) => nameOf(players, id)))
  return (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: '4rem', lineHeight: 1 }}>{iWon ? '🏆' : '🎃'}</Typography>
      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', lineHeight: 1 }}>
        {iWon ? 'Você sobreviveu!' : 'Fim de jogo'}
      </Typography>
      {mine && (
        <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
          Você ficou em {mine.place}º · {heartsText(mine.lives, state.maxLives)} · ⏱ {savedText(mine.saved)} de pavio poupado
        </Typography>
      )}
      <Card accent>
        <Typography sx={{ fontWeight: 700, opacity: 0.8 }}>🏆 {champs.length > 1 ? 'Sobreviventes' : 'Último de pé'}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', wordBreak: 'break-word' }}>
          {champs.length ? names(champs) : 'Ninguém sobrou'}
        </Typography>
      </Card>
      <Card>
        <Typography sx={{ color: 'var(--text-muted)', fontWeight: 700 }}>💥 Explodiu mais</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', wordBreak: 'break-word' }}>
          {worst.ids.length ? `${names(worst.ids)} (${worst.count}×)` : 'Ninguém explodiu'}
        </Typography>
      </Card>
    </Box>
  )
}
