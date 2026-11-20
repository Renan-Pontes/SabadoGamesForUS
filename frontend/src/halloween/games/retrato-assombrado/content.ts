/**
 * O conteúdo do "Retrato de Natal": categorias natalinas (com o Natal
 * brasileiro de 35 °C incluído) e algumas gerais, com palavras fáceis de
 * desenhar em 45 segundos no celular.
 *
 * Regras do conteúdo:
 * - toda palavra precisa caber num desenho rápido (nada abstrato);
 * - dentro de uma categoria, nenhuma palavra pode ser confundida com outra
 *   no chute do impostor (o teste confere com o `fuzzyMatch`);
 * - `also` são outros jeitos aceitos no chute ("elfo" para "Duende").
 *
 * O id da categoria é a posição na lista; não reordene no meio da festa.
 */
export type Word = { text: string; also?: readonly string[] }
export type Category = { name: string; icon: string; words: readonly Word[] }

export const CATEGORIES: readonly Category[] = [
  {
    name: 'Oficina do Papai Noel',
    icon: '🎅',
    words: [
      { text: 'Papai Noel', also: ['bom velhinho', 'santa claus'] },
      { text: 'Mamãe Noel' },
      { text: 'Duende', also: ['elfo', 'duendinho'] },
      { text: 'Rena', also: ['rudolph', 'rena do nariz vermelho'] },
      { text: 'Trenó', also: ['treno'] },
      { text: 'Saco de presentes', also: ['saco', 'sacola de presentes'] },
      { text: 'Gorro', also: ['touca', 'gorro de natal'] },
      { text: 'Chaminé' },
      { text: 'Lareira' },
      { text: 'Cartinha', also: ['carta', 'carta de natal'] },
      { text: 'Botas', also: ['bota'] },
      { text: 'Barba', also: ['barba branca'] },
      { text: 'Polo Norte', also: ['polo'] },
      { text: 'Leite com biscoito', also: ['leite e biscoito', 'copo de leite'] },
    ],
  },
  {
    name: 'Ceia de Natal',
    icon: '🍗',
    words: [
      { text: 'Peru', also: ['peru de natal'] },
      { text: 'Chester' },
      { text: 'Panetone', also: ['chocotone'] },
      { text: 'Rabanada' },
      { text: 'Farofa' },
      { text: 'Pernil' },
      { text: 'Bacalhau', also: ['bacalhoada'] },
      { text: 'Uva-passa', also: ['uva passa', 'passas', 'passa'] },
      { text: 'Pudim' },
      { text: 'Tender' },
      { text: 'Champanhe', also: ['espumante', 'champagne'] },
      { text: 'Nozes', also: ['noz', 'castanha'] },
      { text: 'Rocambole' },
      { text: 'Pavê', also: ['pave', 'pacomê'] },
    ],
  },
  {
    name: 'Enfeites de Natal',
    icon: '🎄',
    words: [
      { text: 'Árvore de Natal', also: ['pinheiro', 'árvore', 'pinheirinho'] },
      { text: 'Pisca-pisca', also: ['pisca pisca', 'luzinhas', 'luzes de natal'] },
      { text: 'Bola de Natal', also: ['bolinha', 'bolinha de natal'] },
      { text: 'Estrela', also: ['estrela de natal', 'estrela guia'] },
      { text: 'Sino', also: ['sininho', 'sino de natal'] },
      { text: 'Guirlanda', also: ['coroa de natal'] },
      { text: 'Presépio', also: ['manjedoura'] },
      { text: 'Meia na lareira', also: ['meia', 'meia de natal'] },
      { text: 'Laço', also: ['laço de fita', 'fita'] },
      { text: 'Quebra-nozes', also: ['quebra nozes', 'soldadinho'] },
      { text: 'Anjo', also: ['anjinho'] },
      { text: 'Festão' },
      { text: 'Visco', also: ['azevinho'] },
      { text: 'Globo de neve', also: ['globo'] },
    ],
  },
  {
    name: 'Natal brasileiro',
    icon: '☀️',
    words: [
      { text: 'Noel de bermuda', also: ['papai noel de bermuda'] },
      { text: 'Piscina', also: ['piscina de plástico', 'piscininha'] },
      { text: 'Ventilador' },
      { text: 'Praia' },
      { text: 'Picolé', also: ['sorvete de palito'] },
      { text: 'Chinelo', also: ['havaianas', 'chinelo de dedo'] },
      { text: 'Guarda-sol', also: ['guarda sol', 'sombrinha'] },
      { text: 'Melancia' },
      { text: 'Amigo secreto', also: ['amigo oculto'] },
      { text: 'Churrasco', also: ['churrasqueira'] },
      { text: 'Protetor solar', also: ['protetor', 'filtro solar'] },
      { text: 'Caixa de som', also: ['caixinha de som'] },
      { text: 'Ar-condicionado', also: ['ar condicionado'] },
      { text: 'Mangueira', also: ['mangueira de água'] },
    ],
  },
  {
    name: 'Presentes',
    icon: '🎁',
    words: [
      { text: 'Bicicleta', also: ['bike', 'bicicletinha'] },
      { text: 'Videogame', also: ['video game', 'console', 'controle'] },
      { text: 'Boneca' },
      { text: 'Carrinho', also: ['carrinho de brinquedo'] },
      { text: 'Bola', also: ['bola de futebol'] },
      { text: 'Ursinho de pelúcia', also: ['ursinho', 'urso de pelúcia', 'pelúcia'] },
      { text: 'Patinete' },
      { text: 'Skate' },
      { text: 'Celular', also: ['smartphone'] },
      { text: 'Fone de ouvido', also: ['fone', 'headphone'] },
      { text: 'Par de meias', also: ['meias', 'meia'] },
      { text: 'Pijama' },
      { text: 'Perfume' },
      { text: 'Quebra-cabeça', also: ['quebra cabeça'] },
    ],
  },
  {
    name: 'Doces de Natal',
    icon: '🍪',
    words: [
      { text: 'Bengala doce', also: ['bengala', 'bastão doce', 'bengalinha'] },
      { text: 'Biscoito de gengibre', also: ['boneco de gengibre', 'gingerbread'] },
      { text: 'Casinha de doce', also: ['casinha', 'casa de doce'] },
      { text: 'Brigadeiro' },
      { text: 'Bombom', also: ['caixa de bombom'] },
      { text: 'Pirulito' },
      { text: 'Sorvete' },
      { text: 'Cupcake' },
      { text: 'Torta' },
      { text: 'Algodão-doce', also: ['algodao doce'] },
      { text: 'Bolo' },
      { text: 'Rosquinha', also: ['donut', 'rosca'] },
      { text: 'Pipoca' },
      { text: 'Chocolate', also: ['barra de chocolate'] },
    ],
  },
  {
    name: 'Inverno e neve',
    icon: '⛄',
    words: [
      { text: 'Boneco de neve', also: ['boneco'] },
      { text: 'Floco de neve', also: ['floco', 'floquinho'] },
      { text: 'Iglu' },
      { text: 'Esqui', also: ['esquiador'] },
      { text: 'Patins de gelo', also: ['patins', 'patinação'] },
      { text: 'Cachecol' },
      { text: 'Luvas', also: ['luva'] },
      { text: 'Guerra de neve', also: ['bola de neve', 'guerra de bola de neve'] },
      { text: 'Pingente de gelo', also: ['estalactite'] },
      { text: 'Chocolate quente', also: ['caneca', 'chocolate'] },
      { text: 'Montanha', also: ['montanha nevada'] },
      { text: 'Cabana', also: ['chalé'] },
      { text: 'Snowboard', also: ['prancha de neve'] },
      { text: 'Casaco', also: ['jaqueta', 'casacão'] },
    ],
  },
  {
    name: 'Bichos do Polo Norte',
    icon: '🐧',
    words: [
      { text: 'Pinguim' },
      { text: 'Urso polar', also: ['urso branco', 'urso'] },
      { text: 'Foca' },
      { text: 'Coruja', also: ['coruja das neves'] },
      { text: 'Raposa', also: ['raposa do ártico'] },
      { text: 'Morsa' },
      { text: 'Lobo' },
      { text: 'Esquilo' },
      { text: 'Alce' },
      { text: 'Baleia' },
      { text: 'Orca' },
      { text: 'Coelho', also: ['coelhinho'] },
      { text: 'Husky', also: ['cachorro', 'cão de trenó'] },
      { text: 'Peixe' },
    ],
  },
  {
    name: 'Réveillon',
    icon: '🎆',
    words: [
      { text: 'Fogos de artifício', also: ['fogos', 'fogos de artificio', 'rojão'] },
      { text: 'Relógio', also: ['meia-noite', 'contagem regressiva'] },
      { text: 'Taça', also: ['brinde', 'taça de champanhe'] },
      { text: 'Sete ondas', also: ['pular ondas', 'onda'] },
      { text: 'Calendário' },
      { text: 'Roupa branca', also: ['roupa', 'vestido branco'] },
      { text: 'Romã' },
      { text: 'Uva', also: ['cacho de uva', 'uvas'] },
      { text: 'Confete' },
      { text: 'Balão', also: ['bexiga', 'bola de festa'] },
      { text: 'Língua de sogra' },
      { text: 'Chapéu de festa', also: ['chapeuzinho', 'chapéu de aniversário'] },
      { text: 'Lentilha' },
      { text: 'Globo espelhado', also: ['globo de discoteca', 'bola de discoteca'] },
    ],
  },
  {
    name: 'Fantasias',
    icon: '🎭',
    words: [
      { text: 'Pirata' },
      { text: 'Astronauta' },
      { text: 'Princesa' },
      { text: 'Super-herói', also: ['super heroi', 'herói'] },
      { text: 'Palhaço' },
      { text: 'Ninja' },
      { text: 'Caubói', also: ['cowboy', 'vaqueiro'] },
      { text: 'Robô' },
      { text: 'Dinossauro' },
      { text: 'Abelha' },
      { text: 'Unicórnio' },
      { text: 'Mágico' },
      { text: 'Policial' },
      { text: 'Fada' },
    ],
  },
  {
    name: 'Viagem de fim de ano',
    icon: '✈️',
    words: [
      { text: 'Avião' },
      { text: 'Mala', also: ['mala de viagem'] },
      { text: 'Carro' },
      { text: 'Ônibus' },
      { text: 'Passaporte' },
      { text: 'Mochila' },
      { text: 'Barraca', also: ['acampamento'] },
      { text: 'Câmera', also: ['máquina fotográfica', 'camera'] },
      { text: 'Óculos de sol', also: ['óculos'] },
      { text: 'Navio', also: ['cruzeiro', 'barco'] },
      { text: 'Trem' },
      { text: 'Hotel' },
      { text: 'Bússola' },
      { text: 'Engarrafamento', also: ['trânsito', 'congestionamento'] },
    ],
  },
]

/** A categoria pelo id (posição), com uma de reserva para id estranho. */
export function categoryAt(id: number): Category {
  return CATEGORIES[id] ?? CATEGORIES[0]
}

/** Nome da categoria com o ícone ("🎄 Enfeites de Natal"). */
export function categoryLabel(id: number): string {
  const category = categoryAt(id)
  return `${category.icon} ${category.name}`
}

/** Tudo que vale como acerto para esta palavra da categoria (a própria e os apelidos). */
export function answersFor(categoryId: number, word: string): string[] {
  const entry = categoryAt(categoryId).words.find((candidate) => candidate.text === word)
  return [word, ...(entry?.also ?? [])]
}
