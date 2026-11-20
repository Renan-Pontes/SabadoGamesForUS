/**
 * Kit visual dos jogos. Nasceu na Noite do Terror (por isso os nomes) e no
 * Natal 2026 veste Noite Feliz: título de cartão com pingentes de gelo, vela
 * listrada de bengala, revelação com estrelinhas, chuva de presentes.
 * Os componentes só de Halloween (lápide, abóbora, caldeirão, aranha, porta,
 * SpookyBackdrop) ficam para os jogos Old. Resumo:
 *
 *   <SpookyBackdrop intensity="tv" position="absolute" />   cenário (lua, neblina, morcegos, teias)
 *   <HauntedTitle drip>Cidade Dorme</HauntedTitle>           título de cartão com brilho/pingentes de gelo
 *   <CandleTimer deadline={s.deadline} total={30000} now={now} />  vela de Natal que derrete até o prazo
 *   <Tombstone name="Pedro" epitaph="Foi ver o barulho" rise />    lápide
 *   <PlayerBadge name="Ana" acted ghost={false} size="lg" />       nome + ✓ + ☃️ (fora da rodada)
 *   <BigReveal open title="ERA A JULIA!" icon="🔪" tone="blood" /> revelação dramática (TV)
 *   <DoorSvg label="2" open={revealed} inside="👹" />              porta que abre (ou botão no celular)
 *   <PumpkinSvg face="scary" fuse={0.6} />                         abóbora com pavio animável
 *   <Cauldron potion="#84cc16">🍬 12</Cauldron>                    caldeirão borbulhando
 *   <CandyRain active={over} kind="mixed" />                       chuva de presentes/flocos (vitória)
 *   <SpiderSvg size={48} thread={120} wiggle />                    aranha no fio
 *   <SoundToggle />                                                botão de som para o cabeçalho do celular
 */
import './fonts'

export { default as SpookyBackdrop } from './SpookyBackdrop'
export { default as HauntedTitle } from './HauntedTitle'
export { default as CandleTimer } from './CandleTimer'
export { default as Tombstone } from './Tombstone'
export { default as PlayerBadge } from './PlayerBadge'
export { default as BigReveal } from './BigReveal'
export { default as DoorSvg } from './DoorSvg'
export { default as PumpkinSvg } from './PumpkinSvg'
export { default as Cauldron } from './Cauldron'
export { default as CandyRain } from './CandyRain'
export { default as SpiderSvg } from './SpiderSvg'
export { SoundToggle, PhoneSoundButton, AudioUnlockPrompt } from './SoundControls'

export { CREEPY_FONT, BLOODY_FONT, SPOOKY_COLORS, FESTIVE_ROUND_FONT, XMAS_COLORS } from './fonts'
export { withAlpha } from './color'
export { useReducedMotion, scatter } from './motion'
export { useHideFloatingSoundButton } from './soundButtons'

export type { SpookyIntensity, SpookyLayer } from './SpookyBackdrop'
export type { RevealTone } from './BigReveal'
export type { PumpkinFace } from './PumpkinSvg'
export { default as SnowBackdrop } from '../../natal/SnowBackdrop'
