import { getSoundState, routeMediaToScare, scareVolumeGain } from '../audio'

/**
 * Jumpscare próprio, com arquivos seus em `frontend/public/jumpscare/` (o
 * primeiro que existir — e que o navegador toque — de cada linha):
 *
 *   jumpscare.webm | jumpscare.mp4          vídeo: vira o susto 'video', que entra no sorteio
 *                                           dos assustadores (webm pode ter fundo transparente)
 *   jumpscare.gif | .webp | .png | .jpg     imagem: troca o Penetra desenhado (o susto raro)
 *   jumpscare.mp3 | .ogg | .wav             som: toca com o Penetra
 *
 * O som do vídeo vai pelo caminho ALTO dos sustos (saturação, limitador e
 * piso de 0,9 do volume): sai alto mesmo com o volume do app baixo.
 *
 * A TV procura os arquivos ao abrir e deixa tudo carregado — jumpscare que
 * demora meio segundo para aparecer não assusta ninguém. Se o susto chegar
 * antes de terminar de carregar, ou sem arquivo nenhum, vai o Penetra.
 */

export const JUMPSCARE_DIR = '/jumpscare/'

export const JUMPSCARE_FILES = {
  video: ['jumpscare.webm', 'jumpscare.mp4'],
  image: ['jumpscare.gif', 'jumpscare.webp', 'jumpscare.png', 'jumpscare.jpg'],
  audio: ['jumpscare.mp3', 'jumpscare.ogg', 'jumpscare.wav'],
} as const

type MediaKind = keyof typeof JUMPSCARE_FILES
export type JumpscareFiles = Partial<Record<MediaKind, string>>

type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'headers'>>

/** Tipos com codec de cada vídeo (o .webm é VP9 com transparência + Opus). */
const VIDEO_TYPES: Record<string, string> = {
  webm: 'video/webm; codecs="vp9, opus"',
  mp4: 'video/mp4; codecs="avc1.640028, mp4a.40.2"',
}

/** Este navegador toca o vídeo? (Safari antigo não toca webm: vai o mp4.) */
export function browserCanPlay(url: string): boolean {
  if (typeof document === 'undefined') return true
  const type = VIDEO_TYPES[url.split('.').pop() ?? '']
  if (!type) return true
  try {
    return document.createElement('video').canPlayType(type) !== ''
  } catch {
    return true
  }
}

/**
 * Quais arquivos existem. Confere o content-type porque a hospedagem
 * devolve o index.html (200) para qualquer caminho que não existe.
 */
export async function findJumpscareFiles(
  fetcher: Fetcher = (url, init) => fetch(url, init),
  canPlay: (url: string) => boolean = browserCanPlay,
): Promise<JumpscareFiles> {
  const exists = async (kind: MediaKind, url: string) => {
    try {
      const response = await fetcher(url, { method: 'HEAD', cache: 'no-cache' })
      const type = (response.headers.get('content-type') ?? '').toLowerCase()
      return response.ok && (type.startsWith(`${kind}/`) || (kind === 'audio' && type === 'application/ogg'))
    } catch {
      return false
    }
  }
  const found: JumpscareFiles = {}
  await Promise.all(
    (Object.keys(JUMPSCARE_FILES) as MediaKind[]).map(async (kind) => {
      const urls = JUMPSCARE_FILES[kind]
        .map((name) => JUMPSCARE_DIR + name)
        .filter((url) => kind !== 'video' || canPlay(url))
      const hits = await Promise.all(urls.map((url) => exists(kind, url)))
      const first = urls.find((_, i) => hits[i])
      if (first) found[kind] = first
    }),
  )
  return found
}

/** Vídeo aparado entre 0,8 e 6 s: é susto, não sessão de cinema. */
export function videoDurationMs(seconds: number): number {
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
  return Math.round(Math.min(6000, Math.max(800, ms)))
}

export type CustomJumpscare = {
  video?: HTMLVideoElement
  /** Quanto tempo o susto fica na tela quando é vídeo. */
  videoMs?: number
  image?: string
  audio?: HTMLAudioElement
}

let current: CustomJumpscare | null = null
let loading: Promise<CustomJumpscare | null> | null = null

/** O jumpscare próprio já carregado (null = só os desenhados). */
export function customJumpscare(): CustomJumpscare | null {
  return current
}

/** Procura e pré-carrega os arquivos uma vez só (a TV chama ao abrir). */
export function loadCustomJumpscare(): Promise<CustomJumpscare | null> {
  loading ??= prepare()
    .then((media) => (current = media))
    .catch(() => null)
  return loading
}

async function prepare(): Promise<CustomJumpscare | null> {
  const files = await findJumpscareFiles()
  const audio = files.audio ? preloadAudio(files.audio) : undefined
  const [video, imageOk] = await Promise.all([
    files.video ? preloadVideo(files.video) : null,
    files.image ? preloadImage(files.image) : false,
  ])
  const image = imageOk ? files.image : undefined
  if (!video && !image && !audio) return null
  return {
    ...(video ? { video, videoMs: videoDurationMs(video.duration) } : {}),
    ...(image ? { image } : {}),
    ...(audio ? { audio } : {}),
  }
}

function preloadAudio(url: string): HTMLAudioElement {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  audio.load()
  return audio
}

async function preloadImage(url: string): Promise<boolean> {
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    return true
  } catch {
    return false
  }
}

/** Espera o vídeo poder tocar inteiro (ou 20 s e o que tiver chegado). */
function preloadVideo(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    const finish = () => {
      window.clearTimeout(timer)
      video.removeEventListener('canplaythrough', finish)
      video.removeEventListener('error', finish)
      resolve(video.readyState >= 2 && !video.error ? video : null)
    }
    const timer = window.setTimeout(finish, 20_000)
    video.addEventListener('canplaythrough', finish)
    video.addEventListener('error', finish)
    video.src = url
    video.load()
  })
}

function applyVolume(element: HTMLMediaElement, forceMute = false) {
  const state = getSoundState()
  if (!forceMute && routeMediaToScare(element)) {
    // O caminho alto cuida do volume (e do mudo): o elemento sai cheio.
    element.muted = false
    element.volume = 1
    return
  }
  // Áudio do app travado: o elemento toca sozinho, já no volume de susto.
  element.muted = forceMute || state.muted
  element.volume = Math.min(1, Math.max(0, scareVolumeGain(state)))
}

/**
 * Toca o som próprio do Penetra (o susto raro). Devolve false quando não há
 * arquivo de som (aí toca o grito sintetizado).
 */
export function playCustomJumpscareSound(): boolean {
  const media = current
  if (media?.audio) {
    applyVolume(media.audio)
    media.audio.currentTime = 0
    void media.audio.play().catch(() => undefined)
    return true
  }
  return false
}

/**
 * Põe o vídeo já carregado dentro de `host`, parado no 1º quadro, e toca do
 * começo depois de `delayMs` (o escuro antes do bote). Devolve quem tira.
 */
export function mountCustomVideo(host: HTMLElement, delayMs = 0): () => void {
  const video = current?.video
  if (!video) return () => undefined
  video.pause()
  video.currentTime = 0
  host.appendChild(video)
  const start = () => {
    applyVolume(video)
    video.play().catch(() => {
      // Navegador barrou o som (ninguém clicou na TV ainda): assusta mudo mesmo.
      video.muted = true
      void video.play().catch(() => undefined)
    })
  }
  const timer = delayMs > 0 ? window.setTimeout(start, delayMs) : (start(), undefined)
  return () => {
    window.clearTimeout(timer)
    video.pause()
    video.remove()
  }
}
