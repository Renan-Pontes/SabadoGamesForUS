/**
 * O conteúdo do "Retrato Assombrado": categorias de Halloween com palavras
 * fáceis de desenhar em 45 segundos no celular.
 *
 * Regras do conteúdo:
 * - toda palavra precisa caber num desenho rápido (nada abstrato);
 * - dentro de uma categoria, nenhuma palavra pode ser confundida com outra
 *   no chute do impostor (o teste confere com o `fuzzyMatch`);
 * - `also` são outros jeitos aceitos no chute ("drácula" para "Vampiro").
 *
 * O id da categoria é a posição na lista; não reordene no meio da festa.
 */
export type Word = { text: string; also?: readonly string[] }
export type Category = { name: string; icon: string; words: readonly Word[] }

export const CATEGORIES: readonly Category[] = [
  {
    name: 'Monstros',
    icon: '🧛',
    words: [
      { text: 'Vampiro', also: ['drácula', 'dracula'] },
      { text: 'Lobisomem', also: ['homem lobo', 'homem-lobo'] },
      { text: 'Múmia' },
      { text: 'Zumbi', also: ['morto-vivo', 'morto vivo', 'zombie'] },
      { text: 'Frankenstein', also: ['frank', 'monstro de frankenstein'] },
      { text: 'Fantasma', also: ['assombração', 'espírito'] },
      { text: 'Esqueleto', also: ['ossada'] },
      { text: 'Bruxa', also: ['feiticeira'] },
      { text: 'Ogro' },
      { text: 'Ciclope' },
      { text: 'Gárgula' },
      { text: 'Dragão' },
      { text: 'Alienígena', also: ['alien', 'et', 'extraterrestre', 'marciano'] },
      { text: 'Pé-grande', also: ['pe grande', 'bigfoot', 'yeti'] },
    ],
  },
  {
    name: 'Folclore brasileiro',
    icon: '🌳',
    words: [
      { text: 'Saci', also: ['saci-pererê', 'saci perere'] },
      { text: 'Curupira' },
      { text: 'Mula sem cabeça', also: ['mula'] },
      { text: 'Boitatá', also: ['cobra de fogo'] },
      { text: 'Iara', also: ['mãe d’água', 'mae dagua', 'sereia'] },
      { text: 'Cuca' },
      { text: 'Boto cor-de-rosa', also: ['boto'] },
      { text: 'Mapinguari' },
      { text: 'Loira do banheiro', also: ['loira', 'loura do banheiro'] },
      { text: 'Chupa-cabra', also: ['chupacabra', 'chupa cabra'] },
      { text: 'Bicho-papão', also: ['bicho papao'] },
      { text: 'Corpo-seco', also: ['corpo seco'] },
      { text: 'Caipora' },
    ],
  },
  {
    name: 'Cemitério',
    icon: '⚰️',
    words: [
      { text: 'Lápide', also: ['túmulo', 'tumba'] },
      { text: 'Caixão', also: ['esquife'] },
      { text: 'Sino' },
      { text: 'Pá' },
      { text: 'Cruz' },
      { text: 'Corvo' },
      { text: 'Vela' },
      { text: 'Coroa de flores', also: ['coroa'] },
      { text: 'Portão', also: ['grade'] },
      { text: 'Caveira', also: ['crânio'] },
      { text: 'Osso' },
      { text: 'Mausoléu', also: ['cripta', 'jazigo'] },
      { text: 'Estátua de anjo', also: ['anjo', 'estátua'] },
      { text: 'Cova', also: ['sepultura'] },
    ],
  },
  {
    name: 'Casa mal-assombrada',
    icon: '🏚️',
    words: [
      { text: 'Teia de aranha', also: ['teia'] },
      { text: 'Candelabro', also: ['castiçal'] },
      { text: 'Espelho', also: ['espelho quebrado'] },
      { text: 'Porta', also: ['porta rangendo'] },
      { text: 'Retrato', also: ['quadro', 'pintura'] },
      { text: 'Cortina' },
      { text: 'Cadeira de balanço', also: ['cadeira'] },
      { text: 'Escada', also: ['escadaria'] },
      { text: 'Janela' },
      { text: 'Boneca', also: ['boneca assombrada'] },
      { text: 'Relógio de pêndulo', also: ['relógio', 'pêndulo', 'relógio de parede'] },
      { text: 'Baú' },
      { text: 'Lustre' },
      { text: 'Piano' },
    ],
  },
  {
    name: 'Coisas de bruxa',
    icon: '🧙',
    words: [
      { text: 'Caldeirão' },
      { text: 'Vassoura' },
      { text: 'Chapéu de bruxa', also: ['chapéu', 'chapéu pontudo'] },
      { text: 'Varinha', also: ['varinha mágica'] },
      { text: 'Poção', also: ['frasco'] },
      { text: 'Gato preto', also: ['gato'] },
      { text: 'Livro de feitiços', also: ['livro', 'grimório'] },
      { text: 'Bola de cristal', also: ['bola'] },
      { text: 'Sapo' },
      { text: 'Cogumelo' },
      { text: 'Lua cheia', also: ['lua'] },
      { text: 'Coruja' },
      { text: 'Espantalho' },
      { text: 'Ampulheta' },
    ],
  },
  {
    name: 'Doces e festa',
    icon: '🍬',
    words: [
      { text: 'Abóbora', also: ['abóbora de halloween', 'jack o lantern', 'moranga'] },
      { text: 'Pirulito' },
      { text: 'Máscara' },
      { text: 'Saco de doces', also: ['sacola de doces', 'balde de doces', 'cesta de doces'] },
      { text: 'Chocolate', also: ['barra de chocolate'] },
      { text: 'Maçã do amor' },
      { text: 'Algodão-doce', also: ['algodao doce'] },
      { text: 'Bala', also: ['balinha', 'bala de goma'] },
      { text: 'Pipoca' },
      { text: 'Biscoito', also: ['bolacha'] },
      { text: 'Brigadeiro' },
      { text: 'Chiclete', also: ['chiclé'] },
      { text: 'Bolo' },
      { text: 'Sorvete' },
    ],
  },
  {
    name: 'Bichos da noite',
    icon: '🦇',
    words: [
      { text: 'Morcego' },
      { text: 'Aranha' },
      { text: 'Cobra', also: ['serpente'] },
      { text: 'Rato', also: ['ratazana'] },
      { text: 'Barata' },
      { text: 'Escorpião' },
      { text: 'Lobo' },
      { text: 'Lagartixa', also: ['lagarto'] },
      { text: 'Lesma' },
      { text: 'Mosca' },
      { text: 'Vaga-lume', also: ['vagalume', 'pirilampo'] },
      { text: 'Gambá' },
      { text: 'Mariposa' },
      { text: 'Polvo' },
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
    name: 'Laboratório maluco',
    icon: '🧪',
    words: [
      { text: 'Cérebro', also: ['cérebro no pote'] },
      { text: 'Tubo de ensaio', also: ['tubo'] },
      { text: 'Raio', also: ['relâmpago'] },
      { text: 'Alavanca' },
      { text: 'Microscópio' },
      { text: 'Olho', also: ['olho no pote'] },
      { text: 'Coração' },
      { text: 'Ímã' },
      { text: 'Explosão' },
      { text: 'Óculos de proteção', also: ['óculos'] },
      { text: 'Jaleco' },
      { text: 'Mão' },
      { text: 'Bateria', also: ['pilha'] },
      { text: 'Lâmpada' },
    ],
  },
  {
    name: 'Acampamento assombrado',
    icon: '🏕️',
    words: [
      { text: 'Fogueira' },
      { text: 'Barraca' },
      { text: 'Árvore seca', also: ['árvore'] },
      { text: 'Lago' },
      { text: 'Cabana' },
      { text: 'Canoa' },
      { text: 'Mochila' },
      { text: 'Saco de dormir' },
      { text: 'Marshmallow' },
      { text: 'Mapa' },
      { text: 'Bússola' },
      { text: 'Pegadas', also: ['pegada', 'rastro'] },
      { text: 'Lanterna' },
      { text: 'Estrela cadente', also: ['estrela'] },
    ],
  },
]

/** A categoria pelo id (posição), com uma de reserva para id estranho. */
export function categoryAt(id: number): Category {
  return CATEGORIES[id] ?? CATEGORIES[0]
}

/** Nome da categoria com o ícone ("🧙 Coisas de bruxa"). */
export function categoryLabel(id: number): string {
  const category = categoryAt(id)
  return `${category.icon} ${category.name}`
}

/** Tudo que vale como acerto para esta palavra da categoria (a própria e os apelidos). */
export function answersFor(categoryId: number, word: string): string[] {
  const entry = categoryAt(categoryId).words.find((candidate) => candidate.text === word)
  return [word, ...(entry?.also ?? [])]
}
