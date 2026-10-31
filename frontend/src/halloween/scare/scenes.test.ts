import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RARE_SCARE, SCARE_KINDS } from './bus'
import type { ConcreteScare } from './bus'
import { PENETRA_CUT_MS, SCARE_DURATION_MS, scareCaption } from './config'
import ScareScene from './scenes'

function render(kind: ConcreteScare, reduced: boolean) {
  return renderToString(
    createElement(ScareScene, { kind, name: 'Ana', reduced, duration: SCARE_DURATION_MS[kind] }),
  )
}

describe('cenas dos sustos', () => {
  const all: ConcreteScare[] = [...SCARE_KINDS, RARE_SCARE]

  it.each(all)('%s: desenha a versão animada e a calma, com legenda', (kind) => {
    expect(render(kind, false)).toContain('hws-out')
    expect(render(kind, true)).toContain('hws-calm')
    expect(scareCaption(kind).text).toBeTruthy()
  })

  it('o Penetra corta para a estática antes de a cena começar a sumir', () => {
    const html = render(RARE_SCARE, false)
    expect(html).toContain('hws-penetra-jaw')
    expect(html).toContain('hws-penetra-cut')
    // .hws-out apaga a cena nos últimos 320 ms.
    expect(PENETRA_CUT_MS).toBeLessThan(SCARE_DURATION_MS[RARE_SCARE] - 320)
  })
})
