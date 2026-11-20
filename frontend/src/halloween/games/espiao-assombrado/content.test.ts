import { describe, expect, it } from 'vitest'
import { normalizeText } from '../../engine/helpers'
import { PLACES } from './content'
import { GUESS_MAX, bestPlaces, cleanGuess, guessHits, matchCost, placesMatching } from './rules'

const id = (name: string) => {
  const found = PLACES.findIndex((place) => place.name === name)
  if (found < 0) throw new Error(`lugar não existe: ${name}`)
  return found
}

describe('conteúdo', () => {
  it('40+ lugares, nomes únicos, 8+ papéis e apelidos', () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(44)
    expect(new Set(PLACES.map((place) => normalizeText(place.name))).size).toBe(PLACES.length)
    for (const place of PLACES) {
      expect(place.name.length, place.name).toBeLessThanOrEqual(32)
      expect(place.icon.length, place.name).toBeGreaterThan(0)
      expect(place.roles.length, `${place.name}: papéis`).toBeGreaterThanOrEqual(8)
      expect(new Set(place.roles).size, `${place.name}: papel repetido`).toBe(place.roles.length)
      expect(place.aliases.length, `${place.name}: apelidos`).toBeGreaterThanOrEqual(2)
      for (const role of place.roles) expect(role.length, role).toBeLessThanOrEqual(34)
    }
  })

  it('nada de Halloween nos lugares e papéis', () => {
    const spooky = /assombrad|terror|fantasma|abóbora|bruxa|caveira|zumbi|vampir|múmia|susto|👻|🎃|🦇|🕷|💀|🪦/i
    for (const place of PLACES) {
      for (const text of [place.name, place.icon, ...place.aliases, ...place.roles]) expect(text, place.name).not.toMatch(spooky)
    }
  })

  it('nome e apelidos de cada lugar acertam aquele lugar e nenhum outro', () => {
    PLACES.forEach((place, placeId) => {
      for (const text of [place.name, ...place.aliases]) {
        expect(bestPlaces(text), `"${text}" (${place.name})`).toEqual([placeId])
        expect(guessHits(text, placeId), `"${text}" (${place.name})`).toBe(true)
      }
    })
  }, 30_000)
})

describe('custo do casamento', () => {
  it('igual < letra errada < só um pedaço; null quando não bate', () => {
    expect(matchCost('o Presépio', 'Presépio')).toBe(0)
    expect(matchCost('presepo', 'Presépio')).toBe(1)
    expect(matchCost('acho que é o presépio', 'Presépio')).toBe(2.5)
    expect(matchCost('acho que é o presepo', 'Presépio')).toBeGreaterThan(matchCost('presepi', 'Presépio')!)
    expect(matchCost('banana', 'Presépio')).toBeNull()
    expect(matchCost('', 'Presépio')).toBeNull()
  })

  it('palavras parecidas de lugares diferentes ficam com o lugar mais parecido', () => {
    expect(bestPlaces('praia')).toEqual([id('Natal na Praia')])
    expect(bestPlaces('igreja')).toEqual([id('Missa do Galo')])
    expect(bestPlaces('cadeia')).toEqual([id('Delegacia')])
    expect(bestPlaces('escola')).toEqual([id('Apresentação da Escola')])
    expect(bestPlaces('centro comercial')).toEqual([id('Shopping Lotado')])
    expect(bestPlaces('virada')).toEqual([id('Réveillon em Copacabana')])
    expect(bestPlaces('mega da virada')).toEqual([id('Lotérica da Virada')])
    expect(bestPlaces('chocotone')).toEqual([id('Loja de Panetone')])
    expect(bestPlaces('chocolate')).toEqual([id('Fábrica de Chocolate')])
    // "praça" está a 1 letra de "praia": bate com os dois, mas o melhor é um só
    expect(bestPlaces('praça')).toEqual([id('Árvore de Natal da Praça')])
    expect(bestPlaces('praia')).toEqual([id('Natal na Praia')])
    expect(placesMatching('árvore da praça')).toEqual([id('Árvore de Natal da Praça'), id('Natal na Praia')])
  })
})

describe('chute digitado', () => {
  const nativity = id('Presépio Vivo')

  it('aceita acento, maiúscula, artigo e erro de digitação', () => {
    for (const guess of ['presepio', 'o presépio', 'presepo', 'PRESÉPIO', 'Presépio!', '  no   presépio ', 'prezepio', 'acho que é o presépio']) {
      expect(guessHits(guess, nativity), guess).toBe(true)
    }
  })

  it('apelidos e nomes compostos', () => {
    expect(guessHits('ceia', id('Ceia na Casa da Vó'))).toBe(true)
    expect(guessHits('casa da vo', id('Ceia na Casa da Vó'))).toBe(true)
    expect(guessHits('amigo oculto', id('Amigo Secreto da Firma'))).toBe(true)
    expect(guessHits('fabrica do papai noel', id('Fábrica do Papai Noel'))).toBe(true)
    expect(guessHits('oficina dos duendes', id('Fábrica do Papai Noel'))).toBe(true)
    expect(guessHits('treno', id('Trenó em Pane'))).toBe(true)
    expect(guessHits('polo norte', id('Polo Norte'))).toBe(true)
    expect(guessHits('artico', id('Polo Norte'))).toBe(true)
    expect(guessHits('patinacao', id('Pista de Patinação'))).toBe(true)
    expect(guessHits('reveillon', id('Réveillon em Copacabana'))).toBe(true)
    expect(guessHits('ônibus', id('Rodoviária Lotada'))).toBe(true)
    expect(guessHits('onibus', id('Rodoviária Lotada'))).toBe(true)
    expect(guessHits('supermercado', id('Supermercado na Véspera'))).toBe(true)
    expect(guessHits('acougue', id('Açougue na Véspera'))).toBe(true)
    expect(guessHits('gramado', id('Natal Luz de Gramado'))).toBe(true)
    expect(guessHits('confraternizacao', id('Festa da Firma'))).toBe(true)
  })

  it('palavras do dia a dia que o espião digitaria', () => {
    const cases: [string, string][] = [
      ['missa', 'Missa do Galo'],
      ['shopping', 'Shopping Lotado'],
      ['mercado', 'Supermercado na Véspera'],
      ['navio', 'Cruzeiro de Fim de Ano'],
      ['trem', 'Expresso Polar'],
      ['avião', 'Aeroporto no Feriado'],
      ['polícia', 'Delegacia'],
      ['prisão', 'Delegacia'],
      ['hospital', 'Hospital de Plantão'],
      ['sogra', 'Casa da Sogra'],
      ['cinema', 'Sessão de Filme de Natal'],
      ['churrasco', 'Churrasco no Quintal'],
      ['renas', 'Estábulo das Renas'],
      ['feira', 'Feira de Natal'],
      // Com "natal" em vários nomes, cada festa continua com o seu lugar.
      ['ceia de natal', 'Ceia na Casa da Vó'],
      ['árvore de natal', 'Árvore de Natal da Praça'],
      ['praia no natal', 'Natal na Praia'],
      ['missa de natal', 'Missa do Galo'],
      ['filme de natal', 'Sessão de Filme de Natal'],
      ['trem de natal', 'Expresso Polar'],
      ['troca de presentes', 'Fila da Troca'],
      ['abrindo presentes', 'Abertura dos Presentes'],
    ]
    for (const [guess, name] of cases) {
      expect(bestPlaces(guess).map((placeId) => PLACES[placeId].name), guess).toEqual([name])
    }
  })

  it('letra errada no nome inteiro vale mais que acertar só um pedaço', () => {
    const cases: [string, string][] = [
      ['mega da virda', 'Lotérica da Virada'],
      ['ceia de natl', 'Ceia na Casa da Vó'],
      ['praia no natl', 'Natal na Praia'],
      ['trem de natl', 'Expresso Polar'],
      ['salao', 'Salão de Beleza'],
      ['shoping', 'Shopping Lotado'],
    ]
    for (const [guess, name] of cases) {
      expect(bestPlaces(guess).map((placeId) => PLACES[placeId].name), guess).toEqual([name])
    }
  })

  it('uma letra a menos num nome composto nunca acerta OUTRO lugar', () => {
    PLACES.forEach((place, placeId) => {
      for (const text of [place.name, ...place.aliases]) {
        const base = normalizeText(text)
        if (!base.includes(' ')) continue
        for (let i = 0; i < base.length; i += 1) {
          if (base[i] === ' ') continue
          const typo = base.slice(0, i) + base.slice(i + 1)
          const best = bestPlaces(typo)
          if (best.length === 1) expect(best, `"${typo}" (${text})`).toEqual([placeId])
        }
      }
    })
  }, 30_000)

  it('erra o que não é o lugar', () => {
    expect(guessHits('hospital', nativity)).toBe(false)
    expect(guessHits('presépio', id('Missa do Galo'))).toBe(false)
    expect(guessHits('banana', nativity)).toBe(false)
    expect(guessHits('a', nativity)).toBe(false)
  })

  it('chutar vários lugares de uma vez não vale', () => {
    expect(guessHits('presépio shopping praia', nativity)).toBe(false)
    expect(guessHits('presepio ou escola', nativity)).toBe(false)
    // "natal" sozinho é ambíguo (praia, árvore, feira, caravana...)
    expect(guessHits('natal', id('Natal na Praia'))).toBe(false)
  })

  it('cleanGuess: vazio vira null, gigante é cortado', () => {
    expect(cleanGuess('')).toBeNull()
    expect(cleanGuess('   ')).toBeNull()
    expect(cleanGuess('o de da')).toBeNull()
    expect(cleanGuess(42)).toBeNull()
    expect(cleanGuess(null)).toBeNull()
    expect(cleanGuess('  presépio  ')).toBe('presépio')
    const huge = cleanGuess('x'.repeat(5000))
    expect(huge?.length).toBe(GUESS_MAX)
  })
})
