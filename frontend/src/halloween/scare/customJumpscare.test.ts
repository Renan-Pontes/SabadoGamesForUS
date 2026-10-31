import { describe, expect, it } from 'vitest'
import { findJumpscareFiles, videoDurationMs } from './customJumpscare'

/** Servidor de mentira: só os arquivos listados existem; o resto vira index.html, como na Vercel. */
function host(files: Record<string, string>, offline: string[] = []) {
  const asked: string[] = []
  const fetcher = async (url: string, init: RequestInit) => {
    asked.push(`${init.method} ${url}`)
    if (offline.includes(url)) throw new Error('sem rede')
    const type = files[url] ?? 'text/html; charset=utf-8'
    return { ok: true, headers: new Headers({ 'content-type': type }) }
  }
  return { fetcher, asked }
}

describe('jumpscare próprio (public/jumpscare/)', () => {
  it('sem arquivo nenhum: o index.html que a hospedagem devolve não conta', async () => {
    const { fetcher, asked } = host({})
    expect(await findJumpscareFiles(fetcher)).toEqual({})
    expect(asked.every((line) => line.startsWith('HEAD /jumpscare/'))).toBe(true)
  })

  it('acha vídeo, imagem e som pelo tipo, preferindo a ordem da lista', async () => {
    const { fetcher } = host({
      '/jumpscare/jumpscare.mp4': 'video/mp4',
      '/jumpscare/jumpscare.webm': 'video/webm',
      '/jumpscare/jumpscare.png': 'image/png',
      '/jumpscare/jumpscare.ogg': 'application/ogg',
    })
    expect(await findJumpscareFiles(fetcher)).toEqual({
      video: '/jumpscare/jumpscare.webm',
      image: '/jumpscare/jumpscare.png',
      audio: '/jumpscare/jumpscare.ogg',
    })
  })

  it('arquivo com o tipo errado ou sem rede fica de fora', async () => {
    const { fetcher } = host(
      { '/jumpscare/jumpscare.gif': 'text/plain', '/jumpscare/jumpscare.mp3': 'audio/mpeg' },
      ['/jumpscare/jumpscare.mp3'],
    )
    expect(await findJumpscareFiles(fetcher)).toEqual({})
  })

  it('vídeo fica entre 0,8 e 6 s na tela', () => {
    expect(videoDurationMs(1.6)).toBe(1600)
    expect(videoDurationMs(0.2)).toBe(800)
    expect(videoDurationMs(42)).toBe(6000)
    expect(videoDurationMs(Number.NaN)).toBe(800)
    expect(videoDurationMs(Infinity)).toBe(800)
  })
})
