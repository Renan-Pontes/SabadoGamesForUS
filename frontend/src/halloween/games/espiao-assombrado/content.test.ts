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
    expect(PLACES.length).toBeGreaterThanOrEqual(40)
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
    expect(matchCost('o Cemitério', 'Cemitério')).toBe(0)
    expect(matchCost('cemitero', 'Cemitério')).toBe(1)
    expect(matchCost('acho que é o cemitério', 'Cemitério')).toBe(2.5)
    expect(matchCost('acho que é o cemiterio', 'Cemitério')).toBeGreaterThan(matchCost('cemitrio', 'Cemitério')!)
    expect(matchCost('banana', 'Cemitério')).toBeNull()
    expect(matchCost('', 'Cemitério')).toBeNull()
  })

  it('palavras parecidas de lugares diferentes ficam com o lugar mais parecido', () => {
    expect(bestPlaces('egito')).toEqual([id('Pirâmide do Egito')])
    expect(bestPlaces('esgoto')).toEqual([id('Esgoto da Cidade')])
    expect(bestPlaces('capela')).toEqual([id('Igreja Abandonada')])
    expect(bestPlaces('cadeia')).toEqual([id('Delegacia')])
    expect(bestPlaces('escola')).toEqual([id('Escola à Meia-Noite')])
    expect(bestPlaces('centro comercial')).toEqual([id('Shopping Fechado')])
    // "egito" está a 2 letras de "esgoto": bate com os dois, mas o melhor é um só
    expect(placesMatching('egito')).toEqual([id('Pirâmide do Egito'), id('Esgoto da Cidade')])
  })
})

describe('chute digitado', () => {
  const cemetery = id('Cemitério')

  it('aceita acento, maiúscula, artigo e erro de digitação', () => {
    for (const guess of ['cemiterio', 'o cemitério', 'cemitero', 'CEMITÉRIO', 'Cemitério!', '  no   cemitério ', 'cemiteiro', 'acho que é o cemitério']) {
      expect(guessHits(guess, cemetery), guess).toBe(true)
    }
  })

  it('apelidos e nomes compostos', () => {
    expect(guessHits('hospício', id('Hospital Abandonado'))).toBe(true)
    expect(guessHits('hospital', id('Hospital Abandonado'))).toBe(true)
    expect(guessHits('manicomio', id('Hospital Abandonado'))).toBe(true)
    expect(guessHits('castelo do dracula', id('Castelo do Drácula'))).toBe(true)
    expect(guessHits('o castelo', id('Castelo do Drácula'))).toBe(true)
    expect(guessHits('laboratorio do cientista maluco', id('Laboratório do Cientista Maluco'))).toBe(true)
    expect(guessHits('laboratorio', id('Laboratório do Cientista Maluco'))).toBe(true)
    expect(guessHits('navio', id('Navio Fantasma'))).toBe(true)
    expect(guessHits('trem fantasma', id('Trem Fantasma'))).toBe(true)
    expect(guessHits('parque de diversões', id('Trem Fantasma'))).toBe(true)
    expect(guessHits('ônibus', id('Ônibus da Madrugada'))).toBe(true)
    expect(guessHits('onibus', id('Ônibus da Madrugada'))).toBe(true)
    expect(guessHits('supermercado', id('Supermercado 24h'))).toBe(true)
    expect(guessHits('festa de casamento', id('Casamento de Vampiros'))).toBe(true)
    expect(guessHits('IML', id('Necrotério'))).toBe(true)
  })

  it('palavras do dia a dia que o espião digitaria', () => {
    const cases: [string, string][] = [
      ['festa', 'Festa à Fantasia'],
      ['baile', 'Festa à Fantasia'],
      ['halloween', 'Festa à Fantasia'],
      ['barco', 'Navio Fantasma'],
      ['barco pirata', 'Navio Fantasma'],
      ['trem', 'Trem Fantasma'],
      ['nave', 'Estação Espacial'],
      ['zoo', 'Zoológico'],
      ['prisão', 'Delegacia'],
      ['presídio', 'Delegacia'],
      ['polícia', 'Delegacia'],
      ['mata', 'Floresta Sombria'],
      // Com "festa" valendo, as festas dos outros lugares continuam com eles.
      ['festa de casamento', 'Casamento de Vampiros'],
      ['festa infantil', 'Pizzaria Animatrônica'],
      ['festa de aniversário', 'Pizzaria Animatrônica'],
      ['aniversário', 'Pizzaria Animatrônica'],
      ['festa na praia', 'Luau na Praia'],
      ['trem do metrô', 'Metrô Fantasma'],
      ['parque zoológico', 'Zoológico'],
      ['fantasia', 'Festa à Fantasia'],
    ]
    for (const [guess, name] of cases) {
      expect(bestPlaces(guess).map((placeId) => PLACES[placeId].name), guess).toEqual([name])
    }
  })

  it('letra errada no nome inteiro vale mais que acertar só um pedaço', () => {
    const cases: [string, string][] = [
      ['festa de casamnto', 'Casamento de Vampiros'],
      ['festa infantl', 'Pizzaria Animatrônica'],
      ['festa de aniversaro', 'Pizzaria Animatrônica'],
      ['festa na pria', 'Luau na Praia'],
      ['trem do metr', 'Metrô Fantasma'],
      ['salao', 'Salão de Beleza'],
      ['lgo', 'Acampamento no Lago'],
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
    expect(guessHits('hospital', cemetery)).toBe(false)
    expect(guessHits('cemitério', id('Velório'))).toBe(false)
    expect(guessHits('banana', cemetery)).toBe(false)
    expect(guessHits('a', cemetery)).toBe(false)
  })

  it('chutar vários lugares de uma vez não vale', () => {
    expect(guessHits('cemitério hospital castelo', cemetery)).toBe(false)
    expect(guessHits('cemiterio ou escola', cemetery)).toBe(false)
    // "fantasma" sozinho é ambíguo (trem, navio, metrô...)
    expect(bestPlaces('fantasma').length).toBeGreaterThan(1)
    expect(guessHits('fantasma', id('Trem Fantasma'))).toBe(false)
  })

  it('cleanGuess: vazio vira null, gigante é cortado', () => {
    expect(cleanGuess('')).toBeNull()
    expect(cleanGuess('   ')).toBeNull()
    expect(cleanGuess('o de da')).toBeNull()
    expect(cleanGuess(42)).toBeNull()
    expect(cleanGuess(null)).toBeNull()
    expect(cleanGuess('  cemitério  ')).toBe('cemitério')
    const huge = cleanGuess('x'.repeat(5000))
    expect(huge?.length).toBe(GUESS_MAX)
  })
})
