/**
 * Conteúdo do "Duas Verdades, Uma Mentira" (pt-BR, original).
 *
 * PROMPTS são as ideias que aparecem como botõezinhos no celular: tocar num
 * deles começa a frase na cartinha, e a pessoa só completa. As de fim de ano
 * vêm primeiro (o celular mostra elas antes). BOT_FACTS são frases prontas
 * para os bots dos testes (e só para eles).
 */

/** Começos de frase de Natal e fim de ano. */
export const XMAS_PROMPTS: readonly string[] = [
  'Meu pior presente de amigo secreto foi',
  'Já passei o Réveillon',
  'Na ceia eu sempre',
  'Já me vesti de Papai Noel para',
  'Minha simpatia de Ano-Novo é',
  'O presente mais estranho que já ganhei foi',
  'Acreditei no Papai Noel até',
  'No amigo secreto da firma eu já',
  'Já pulei sete ondas e',
  'Na minha família, no Natal, a gente',
  'Já comi uva-passa',
  'O pavê lá de casa',
  'Já montei a árvore de Natal',
  'Minha promessa de Ano-Novo que nunca cumpri é',
]

/** Começos de frase para qualquer época. */
export const GENERAL_PROMPTS: readonly string[] = [
  'Meu talento secreto é',
  'Já conheci um famoso:',
  'Uma vez eu comi',
  'Já fui parar no hospital porque',
  'Tenho medo de',
  'Na escola eu era',
  'Meu primeiro emprego foi',
  'Já dormi em',
  'Já viajei para',
  'Já ganhei um prêmio de',
  'Eu nunca',
  'Já fui expulso(a) de',
  'Sei tocar',
  'Já quebrei',
]

/** Todas as ideias, Natal primeiro. */
export const PROMPTS: readonly string[] = [...XMAS_PROMPTS, ...GENERAL_PROMPTS]

/** Frases prontas dos bots (testes e simulação). */
export const BOT_FACTS: readonly string[] = [
  'Já ganhei um par de meias de amigo secreto três anos seguidos',
  'Passei um Réveillon inteiro dormindo no sofá',
  'Na ceia eu sempre como o arroz com uva-passa escondido',
  'Já me vesti de Papai Noel para a creche do bairro',
  'Acreditei no Papai Noel até os 12 anos',
  'Pulei sete ondas e perdi o chinelo na terceira',
  'Já montei a árvore de Natal em outubro',
  'Sei fazer rabanada de olho fechado',
  'Já comi um panetone inteiro sozinho(a)',
  'Tenho medo de rena',
  'Já cantei no coral da igreja de gorro piscando',
  'Meu primeiro emprego foi embrulhar presente no shopping',
  'Já conheci a Xuxa num aeroporto',
  'Sei tocar Jingle Bells no teclado',
  'Já dormi dentro de um carro numa praia',
  'Na escola eu era o(a) mais bagunceiro(a) da sala',
  'Já quebrei o braço caindo da cama',
  'Já ganhei um concurso de dança',
  'Uma vez eu comi formiga',
  'Nunca vi neve de verdade',
  'Tenho uma coleção de globos de neve',
  'Já fui expulso(a) de uma piscina de hotel',
]
