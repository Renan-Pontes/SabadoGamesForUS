import { getSoundState } from '../audio'

/**
 * Jumpscare próprio: troca o Penetra desenhado por arquivos seus. Basta pôr
 * em `frontend/public/jumpscare/` (o primeiro que existir de cada linha):
 *
 *   jumpscare.webm | jumpscare.mp4                     vídeo (toca com o próprio som)
 *   jumpscare.gif | .webp | .png | .jpg                imagem (avança e treme como o Penetra)
 *   jumpscare.mp3 | .ogg | .wav                        som (com vídeo, toma o lugar do som dele)
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

/**
 * Quais arquivos existem. Confere o content-type porque a hospedagem
 * devolve o index.html (200) para qualquer caminho que não existe.
 */
export async function findJumpscareFiles(
  fetcher: Fetcher = (url, init) => fetch(url, init),
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
      const urls = JUMPSCARE_FILES[kind].map((name) => JUMPSCARE_DIR + name)
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

/** O jumpscare próprio já carregado (null = vai o Penetra desenhado). */
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
  const video = files.video ? await preloadVideo(files.video) : null
  if (video) return { video, videoMs: videoDurationMs(video.duration), audio }
  const image = files.image && (await preloadImage(files.image)) ? files.image : undefined
  if (image || audio) return { image, audio }
  return null
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
  const { muted, volume } = getSoundState()
  element.muted = forceMute || muted
  element.volume = Math.min(1, Math.max(0, volume))
}

/**
 * Toca o som do jumpscare próprio. Devolve false quando não há som próprio
 * (aí toca o grito sintetizado). Vídeo sem arquivo de som usa o som dele.
 */
export function playCustomJumpscareSound(): boolean {
  const media = current
  if (media?.audio) {
    applyVolume(media.audio)
    media.audio.currentTime = 0
    void media.audio.play().catch(() => undefined)
    return true
  }
  return Boolean(media?.video)
}

/** Põe o vídeo já carregado dentro de `host` e toca do começo. Devolve quem tira. */
export function mountCustomVideo(host: HTMLElement): () => void {
  const media = current
  const video = media?.video
  if (!video) return () => undefined
  applyVolume(video, Boolean(media.audio))
  video.currentTime = 0
  host.appendChild(video)
  video.play().catch(() => {
    // Navegador barrou o som (ninguém clicou na TV ainda): assusta mudo mesmo.
    video.muted = true
    void video.play().catch(() => undefined)
  })
  return () => {
    video.pause()
    video.remove()
  }
}
