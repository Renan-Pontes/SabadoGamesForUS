/**
 * Os temas da Abóbora-Bomba: metade de Halloween, metade do dia a dia.
 *
 * Regras do conteúdo: tema fácil, com MUITA resposta possível (a abóbora dá
 * várias voltas na mesa e ninguém pode travar na segunda), curtinho (cabe
 * numa linha do celular) e com um emoji que funcione em qualquer TV — nada
 * de bandeira nem emoji muito novo. O id é a posição na lista; não reordene
 * no meio da festa.
 */
export type Theme = { text: string; icon: string; spooky: boolean }

export const THEMES: readonly Theme[] = [
  // --- Halloween e terror -------------------------------------------------
  { text: 'Monstros', icon: '👹', spooky: true },
  { text: 'Coisas que tem num cemitério', icon: '⚰️', spooky: true },
  { text: 'Fantasias de Halloween', icon: '🎭', spooky: true },
  { text: 'Doces e guloseimas', icon: '🍬', spooky: true },
  { text: 'Coisas que uma bruxa usa', icon: '🧙', spooky: true },
  { text: 'Bichos que dão medo', icon: '🕷️', spooky: true },
  { text: 'Lendas do folclore brasileiro', icon: '🌳', spooky: true },
  { text: 'Filmes de terror', icon: '🎬', spooky: true },
  { text: 'Vilões de filme', icon: '🔪', spooky: true },
  { text: 'Coisas numa casa mal-assombrada', icon: '🏚️', spooky: true },
  { text: 'Coisas laranjas', icon: '🎃', spooky: true },
  { text: 'Coisas nojentas', icon: '🤢', spooky: true },
  { text: 'Ingredientes de poção', icon: '🧪', spooky: true },
  { text: 'Lugares que dão arrepio', icon: '🌫️', spooky: true },
  { text: 'Coisas que um vampiro odeia', icon: '🧛', spooky: true },
  { text: 'Barulhos assustadores', icon: '🔊', spooky: true },
  { text: 'Coisas que brilham no escuro', icon: '✨', spooky: true },
  { text: 'Superstições', icon: '🍀', spooky: true },
  { text: 'Coisas esquecidas no sótão', icon: '🕸️', spooky: true },
  { text: 'O que um zumbi comeria', icon: '🧟', spooky: true },
  { text: 'Nomes para um fantasma', icon: '👻', spooky: true },
  { text: 'Desculpas para não descer ao porão', icon: '🕯️', spooky: true },
  { text: 'Coisas que voam à noite', icon: '🦇', spooky: true },
  { text: 'Medos de criança', icon: '🛏️', spooky: true },
  { text: 'O que levar para fugir de um monstro', icon: '🏃', spooky: true },
  { text: 'Coisas de uma festa de Halloween', icon: '🥳', spooky: true },

  // --- Do dia a dia (fáceis) ----------------------------------------------
  { text: 'Frutas', icon: '🍎', spooky: false },
  { text: 'Animais', icon: '🐶', spooky: false },
  { text: 'Cores', icon: '🎨', spooky: false },
  { text: 'Times de futebol', icon: '⚽', spooky: false },
  { text: 'Comidas de aniversário', icon: '🎂', spooky: false },
  { text: 'Países', icon: '🌎', spooky: false },
  { text: 'Coisas da cozinha', icon: '🍳', spooky: false },
  { text: 'Marcas de carro', icon: '🚗', spooky: false },
  { text: 'Profissões', icon: '👷', spooky: false },
  { text: 'Esportes', icon: '🏀', spooky: false },
  { text: 'Instrumentos musicais', icon: '🎸', spooky: false },
  { text: 'Coisas que tem na praia', icon: '🏖️', spooky: false },
  { text: 'Partes do corpo', icon: '💪', spooky: false },
  { text: 'Coisas da escola', icon: '✏️', spooky: false },
  { text: 'Sabores de pizza', icon: '🍕', spooky: false },
  { text: 'Bebidas', icon: '🥤', spooky: false },
  { text: 'Coisas do banheiro', icon: '🚿', spooky: false },
  { text: 'Personagens de desenho animado', icon: '📺', spooky: false },
  { text: 'Meios de transporte', icon: '🚌', spooky: false },
  { text: 'Cidades do Brasil', icon: '🏙️', spooky: false },
  { text: 'Coisas geladas', icon: '🧊', spooky: false },
  { text: 'Roupas e acessórios', icon: '👕', spooky: false },
  { text: 'Legumes e verduras', icon: '🥕', spooky: false },
  { text: 'Coisas redondas', icon: '🔵', spooky: false },
  { text: 'Aplicativos de celular', icon: '📱', spooky: false },
  { text: 'Brinquedos', icon: '🧸', spooky: false },
  { text: 'Cantores e bandas', icon: '🎤', spooky: false },
  { text: 'Coisas que tem no mercado', icon: '🛒', spooky: false },
  { text: 'Nomes de cachorro', icon: '🐕', spooky: false },
]
