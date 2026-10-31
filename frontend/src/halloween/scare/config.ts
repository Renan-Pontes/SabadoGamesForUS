import { hushMusic, playSfx, speakSpooky } from '../audio'
import { RARE_SCARE } from './bus'
import { ANIMATRONIC_FLASHES, FACE_HIT_MS, SCREECH_AT_MS } from './scaryTiming'
import type { ConcreteScare } from './bus'
import { customJumpscare, playCustomJumpscareSound } from './customJumpscare'

/**
 * Tempo de tela e trilha sonora de cada susto. Curtos (1,8–2,5 s): é meme,
 * não filme — a festa tem que voltar logo para o jogo.
 */
export const SCARE_DURATION_MS: Record<ConcreteScare, number> = {
  doot: 2300,
  zoom: 2000,
  scream: 1800,
  pumpkin: 2300,
  pipe: 2000,
  skeletons: 2500,
  spider: 2300,
  static: 2400,
  bruh: 1900,
  eyes: 2500,
  // Escuro, 2 clarões, o bote em 1 s e ~1 s de mandíbula batendo na cara.
  animatronic: 2400,
  // Meio segundo de silêncio e tela preta, e o rosto grita por ~1,4 s.
  face: 2200,
  // Encara e grita por ~1,15 s, corta para a estática e some.
  penetra: 1700,
}

/** Quando o Penetra some e a tela corta para a estática (casa com o fim do grito). */
export const PENETRA_CUT_MS = 1150

/** Tempo de tela de um susto; o raro com vídeo próprio dura o vídeo. */
export function scareDurationMs(kind: ConcreteScare): number {
  if (kind === RARE_SCARE) return customJumpscare()?.videoMs ?? SCARE_DURATION_MS[kind]
  return SCARE_DURATION_MS[kind]
}

/** Texto de legenda de cada susto (também usado na versão calma, sem movimento). */
export function scareCaption(kind: ConcreteScare, name?: string): { icon: string; text: string } {
  switch (kind) {
    case 'doot':
      return { icon: '💀🎺', text: 'doot doot — obrigado sr. esqueleto' }
    case 'zoom':
      return { icon: '🤨📸', text: name ?? 'ALGUÉM AQUI' }
    case 'scream':
      return { icon: '😱', text: 'AAAAAAAH!' }
    case 'pumpkin':
      return { icon: '🎃', text: 'MUÁ-RÁ-RÁ!' }
    case 'pipe':
      return { icon: '🔩', text: '*barulho de cano caindo*' }
    case 'skeletons':
      return { icon: '💀💀', text: 'É MÊS ASSUSTADOR' }
    case 'spider':
      return { icon: '🕷️', text: 'tem uma aranha atrás de você' }
    case 'static':
      return { icon: '📺', text: 'SINAL PERDIDO... ELE ESTÁ AQUI' }
    case 'bruh':
      return { icon: '💀💀💀', text: 'bruh' }
    case 'eyes':
      return { icon: '👀', text: name ? `...${name}...` : '...eu tô te vendo...' }
    case 'animatronic':
      return { icon: '🤖', text: 'ELE AINDA FUNCIONA' }
    case 'face':
      return { icon: '👁️', text: 'NÃO OLHA' }
    case 'penetra':
      return { icon: '👹', text: 'O PENETRA TE ACHOU' }
  }
}

/**
 * Toca o som do susto, casado com a animação (os atrasos são agendados no
 * relógio de áudio). Devolve a função que cancela a voz que ainda não
 * começou — a que já começou termina sozinha (cancelar a fala cortaria
 * também a narração de um jogo que começasse por cima).
 */
export function playScareSound(kind: ConcreteScare, name?: string): () => void {
  const timers: number[] = []
  const sayLater = (text: string, delayMs: number, pitch: number, rate: number) => {
    timers.push(window.setTimeout(() => speakSpooky(text, { pitch, rate }), delayMs))
  }

  switch (kind) {
    case 'doot':
      playSfx('bones', { volume: 0.5 })
      playSfx('doot', { delay: 0.45 })
      break
    case 'zoom':
      playSfx('boom', { delay: 0.3 })
      break
    case 'scream':
      // Só na CENA de susto o grito vai pelo caminho alto; o playSfx('scream') dos jogos fica no nível normal.
      playSfx('scream', { loud: true })
      break
    case 'pumpkin':
      playSfx('laugh', { delay: 0.2 })
      break
    case 'pipe':
      playSfx('clang', { delay: 0.38 })
      break
    case 'skeletons':
      playSfx('bones')
      playSfx('doot', { delay: 1.1, volume: 0.7 })
      break
    case 'spider':
      playSfx('hiss', { delay: 0.6 })
      break
    case 'static':
      playSfx('static', { loud: true })
      playSfx('scream', { delay: 1.2, volume: 0.7, loud: true })
      break
    case 'bruh':
      playSfx('pop')
      playSfx('pop', { delay: 0.15 })
      playSfx('pop', { delay: 0.3 })
      playSfx('boom', { delay: 0.45, volume: 0.6 })
      sayLater('bruh', 500, 0.3, 0.7)
      break
    case 'eyes':
      playSfx('heartbeat', { volume: 0.8 })
      playSfx('whisper', { delay: 0.3 })
      sayLater(name ? `${name}...` : 'eu tô te vendo...', 700, 0.2, 0.6)
      break
    case 'animatronic':
      // A música some na hora; a lâmpada estala nos dois clarões; o guincho vem no bote.
      hushMusic(SCARE_DURATION_MS.animatronic / 1000)
      for (const { at } of ANIMATRONIC_FLASHES) playSfx('flicker', { delay: at / 1000 })
      playSfx('screech', { delay: SCREECH_AT_MS / 1000 })
      break
    case 'face':
      // Meio segundo de silêncio total... e o grito junto com o rosto.
      hushMusic(SCARE_DURATION_MS.face / 1000)
      playSfx('shriek', { delay: FACE_HIT_MS / 1000 })
      break
    case 'penetra':
      if (playCustomJumpscareSound()) break
      playSfx('jumpscare')
      playSfx('boom', { volume: 0.8 })
      break
  }

  return () => {
    for (const timer of timers) window.clearTimeout(timer)
  }
}
