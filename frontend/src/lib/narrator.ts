/**
 * Narração por voz com a Web Speech API do navegador.
 *
 * Sem biblioteca, sem chave de API, sem custo: Chrome, Edge e Safari trazem
 * vozes em português do Brasil. É o suficiente para a TV ler as regras para a
 * sala — e funciona offline.
 */

const PREFERRED_LANGS = ['pt-BR', 'pt_BR', 'pt-PT', 'pt']

let cachedVoice: SpeechSynthesisVoice | null = null

export function canNarrate(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * A lista de vozes carrega de forma assíncrona no Chrome: na primeira chamada
 * pode vir vazia. Por isso a escolha é refeita a cada `speak`, e o resultado
 * bom fica em cache.
 */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (!canNarrate()) return null
  if (cachedVoice) return cachedVoice

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  for (const lang of PREFERRED_LANGS) {
    // Vozes "Google" e "Microsoft" costumam ser as mais naturais.
    const match =
      voices.find((v) => v.lang.replace('_', '-').startsWith(lang) && /google|microsoft/i.test(v.name)) ??
      voices.find((v) => v.lang.replace('_', '-').startsWith(lang))
    if (match) {
      cachedVoice = match
      return match
    }
  }
  return null
}

export type SpeakOptions = {
  rate?: number
  pitch?: number
  /** A voz começou de fato (as vozes podem demorar a carregar). */
  onStart?: () => void
  /** Terminou de falar até o fim. */
  onEnd?: () => void
  /** Parou por qualquer motivo: fim, cancelamento ou erro. */
  onStop?: () => void
  onError?: () => void
}

/**
 * Fala o texto e devolve uma função que cancela.
 *
 * Cancela qualquer fala anterior antes de começar: numa troca rápida de passo
 * do tutorial, duas vozes sobrepostas seriam pior do que nenhuma.
 */
export function speak(text: string, options: SpeakOptions = {}): () => void {
  if (!canNarrate() || !text.trim()) {
    options.onEnd?.()
    return () => undefined
  }

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'pt-BR'
  }
  utterance.rate = options.rate ?? 0.98
  utterance.pitch = options.pitch ?? 1
  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => {
    options.onEnd?.()
    options.onStop?.()
  }
  utterance.onerror = (event) => {
    options.onStop?.()
    // "interrupted" e "canceled" são o cancelamento normal, não falha.
    if (event.error === 'interrupted' || event.error === 'canceled') return
    options.onError?.()
  }

  // Chrome: se as vozes ainda não carregaram, espera o evento e tenta de novo.
  if (!voice && synth.getVoices().length === 0) {
    const retry = () => {
      synth.removeEventListener('voiceschanged', retry)
      cachedVoice = null
      speak(text, options)
    }
    synth.addEventListener('voiceschanged', retry)
    // Se o evento nunca vier, fala com a voz padrão mesmo.
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', retry)
      if (!synth.speaking) synth.speak(utterance)
    }, 600)
    return () => {
      synth.removeEventListener('voiceschanged', retry)
      synth.cancel()
    }
  }

  synth.speak(utterance)
  return () => synth.cancel()
}

export function stopNarration() {
  if (canNarrate()) window.speechSynthesis.cancel()
}

/** Chave do localStorage que marca "já vi o tutorial deste jogo". */
export function tutorialSeenKey(slug: string) {
  return `sabado_tutorial_seen_${slug}`
}

export function hasSeenTutorial(slug: string) {
  try {
    return window.localStorage.getItem(tutorialSeenKey(slug)) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(slug: string) {
  try {
    window.localStorage.setItem(tutorialSeenKey(slug), '1')
  } catch {
    // Sem localStorage (modo privado, etc.) o aviso só volta a aparecer.
  }
}
