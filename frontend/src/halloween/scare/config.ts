import { hushMusic, playSfx, speakSpooky } from '../audio'
import {
  ANIMATRONIC_FLASHES,
  APAGAO_BREATH_MS,
  APAGAO_EYES_MS,
  APAGAO_HIT_MS,
  FACE_HIT_MS,
  RASTEJANTE_LUNGE_MS,
  RASTEJANTE_STEPS,
  BATTERY_OFF_MS,
  PRANK_LAUGH_MS,
  PRANK_REVEAL_MS,
  SCREECH_AT_MS,
  VIDEO_DARK_MS,
  VIDEO_HOLD_MS,
} from './scaryTiming'
import type { ConcreteScare } from './bus'
import { customJumpscare, playCustomJumpscareSound } from './customJumpscare'

/**
 * Tempo de tela e trilha sonora de cada susto. Os de meme são curtos
 * (1,8–2,5 s): a festa tem que voltar logo para o jogo. Os de tensão
 * (apagão, rastejante) gastam mais: o medo está na espera.
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
  // O de tensão: a TV "desliga", ~3 s de escuro e respiração, e o rosto por ~1,4 s.
  apagao: 4700,
  // Ela vem engatinhando aos pulos por 3 s e salta na tela.
  rastejante: 4300,
  // Sem o vídeo carregado, vira o animatrônico; com ele, dura o vídeo (scareDurationMs).
  video: 2400,
  // Pegadinhas: engana até o PRANK_REVEAL_MS e ri por PRANK_LAUGH_MS.
  quebrada: PRANK_REVEAL_MS.quebrada + PRANK_LAUGH_MS,
  possuida: PRANK_REVEAL_MS.possuida + PRANK_LAUGH_MS,
  bateria: PRANK_REVEAL_MS.bateria + PRANK_LAUGH_MS,
  // Encara e grita por ~1,15 s, corta para a estática e some.
  penetra: 1700,
}

/** Quando o Penetra some e a tela corta para a estática (casa com o fim do grito). */
export const PENETRA_CUT_MS = 1150

/** Tempo de tela de um susto; o de vídeo dura escuro + vídeo + a cara parada. */
export function scareDurationMs(kind: ConcreteScare): number {
  if (kind === 'video') {
    const videoMs = customJumpscare()?.videoMs
    return videoMs ? VIDEO_DARK_MS + videoMs + VIDEO_HOLD_MS : SCARE_DURATION_MS.animatronic
  }
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
    case 'apagao':
      return { icon: '🌑', text: 'NÃO SE MEXA' }
    case 'rastejante':
      return { icon: '🕸️', text: 'ELA ESTÁ VINDO' }
    case 'video':
      return { icon: '🦊', text: 'ELE CORREU ATÉ VOCÊ' }
    case 'quebrada':
      return { icon: '🎃', text: 'TRAVESSURA! Sua tela tá inteira, kkkkk' }
    case 'possuida':
      return { icon: '🎃', text: name ? `TRAVESSURA! As fotos de ${name} estão salvas, kkkkk` : 'TRAVESSURA! Suas fotos estão salvas, kkkkk' }
    case 'bateria':
      return { icon: '🎃', text: 'TRAVESSURA! A bateria tá ótima, kkkkk' }
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
  /** A ficha cai: risada, um "pop" e a voz gritando "travessura!". */
  const laughAt = (ms: number) => {
    playSfx('pop', { delay: ms / 1000 })
    playSfx('laugh', { delay: ms / 1000 + 0.1 })
    sayLater('travessura!', ms + 150, 1.3, 1.1)
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
      playSfx('slam', { volume: 0.7 })
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
      playSfx('slam', { delay: SCREECH_AT_MS / 1000 })
      break
    case 'face':
      // Meio segundo de silêncio total... e o grito junto com o rosto.
      hushMusic(SCARE_DURATION_MS.face / 1000)
      playSfx('shriek', { delay: FACE_HIT_MS / 1000 })
      playSfx('slam', { delay: FACE_HIT_MS / 1000 })
      break
    case 'apagao':
      // A TV desliga, silêncio total, alguém respira colado no ouvido, o coração
      // acelera, um sussurro... e o rosto grita junto com um impacto grave.
      hushMusic(SCARE_DURATION_MS.apagao / 1000)
      playSfx('powerdown')
      playSfx('breath', { delay: APAGAO_BREATH_MS / 1000 })
      playSfx('heartbeat', { delay: (APAGAO_EYES_MS - 300) / 1000, volume: 0.7 })
      playSfx('whisper', { delay: (APAGAO_HIT_MS - 1100) / 1000, volume: 0.8 })
      playSfx('shriek', { delay: APAGAO_HIT_MS / 1000 })
      playSfx('slam', { delay: APAGAO_HIT_MS / 1000 })
      break
    case 'rastejante':
      // Um zumbido grave crescendo; cada pulo dela estala ossos no chão; o
      // zumbido corta seco um instante antes do bote, e aí vem o guincho.
      hushMusic(SCARE_DURATION_MS.rastejante / 1000)
      playSfx('dread')
      for (const at of RASTEJANTE_STEPS) playSfx('crawl', { delay: at / 1000 })
      playSfx('screech', { delay: (RASTEJANTE_LUNGE_MS - 30) / 1000 })
      playSfx('slam', { delay: (RASTEJANTE_LUNGE_MS - 30) / 1000 })
      break
    case 'video':
      if (!customJumpscare()?.video) return playScareSound('animatronic')
      // O grito é o do próprio vídeo (caminho alto); por baixo, o soco grave.
      hushMusic(scareDurationMs('video') / 1000)
      playSfx('slam', { delay: (VIDEO_DARK_MS + 120) / 1000 })
      break
    case 'quebrada':
      playSfx('shatter')
      laughAt(PRANK_REVEAL_MS.quebrada)
      break
    case 'possuida':
      playSfx('buzzer', { volume: 0.8 })
      playSfx('static', { delay: 0.25, volume: 0.35 })
      playSfx('buzzer', { delay: 1.9, volume: 0.6 })
      laughAt(PRANK_REVEAL_MS.possuida)
      break
    case 'bateria':
      playSfx('tick', { volume: 0.6 })
      playSfx('tick', { delay: 1, volume: 0.6 })
      playSfx('powerdown', { delay: BATTERY_OFF_MS / 1000 })
      laughAt(PRANK_REVEAL_MS.bateria)
      break
    case 'penetra':
      if (playCustomJumpscareSound()) break
      playSfx('jumpscare')
      playSfx('slam')
      break
  }

  return () => {
    for (const timer of timers) window.clearTimeout(timer)
  }
}
