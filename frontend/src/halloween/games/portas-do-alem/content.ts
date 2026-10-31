/**
 * Conteúdo do "Portas do Além": os corredores de cada rodada, os monstros
 * que moram atrás das portas e as frases da salvação.
 *
 * Regras do conteúdo: original, curtinho (cabe numa linha da TV), humor
 * leve de Halloween e folclore brasileiro. O índice é a posição na lista;
 * não reordene no meio da festa (o estado guarda o texto, mas o baralho de
 * corredores guarda índices).
 */

/** Onde ficam as portas de cada rodada — um corredor novo por rodada. */
export const CORRIDORS: readonly string[] = [
  'Corredor do Hospital Abandonado',
  'Porão da Vovó',
  'Hotel Fim de Linha',
  'Escola à Meia-Noite',
  'Sótão das Bonecas',
  'Casarão da Rua Sem Saída',
  'Mausoléus do Cemitério',
  'Necrotério Municipal',
  'Pousada Última Parada',
  'Shopping Fechado às 3h',
  'Navio Fantasma',
  'Castelo do Conde',
  'Parque de Diversões Abandonado',
  'Biblioteca Proibida',
  'Fazenda do Saci',
  'Estação de Trem Desativada',
  'Elevador do Prédio Antigo',
  'Banheiro da Escola (cuidado com a Loira)',
  'Circo dos Palhaços Tristes',
  'Mansão da Família Esquisita',
]

export type Monster = { emoji: string; name: string }

/** Quem espera atrás da porta. Emojis simples, que qualquer TV desenha. */
export const MONSTERS: readonly Monster[] = [
  { emoji: '👹', name: 'o Cramunhão' },
  { emoji: '🧟', name: 'o Zumbi do RH' },
  { emoji: '🧛', name: 'o Vampiro Fominha' },
  { emoji: '🤡', name: 'o Palhaço do Sótão' },
  { emoji: '🕷️', name: 'a Aranha do Tamanho de um Sofá' },
  { emoji: '👻', name: 'a Noiva do Porão' },
  { emoji: '🐺', name: 'o Lobisomem de Sexta-Feira' },
  { emoji: '💀', name: 'o Esqueleto Dançarino' },
  { emoji: '🧙', name: 'a Bruxa da Vizinhança' },
  { emoji: '🔥', name: 'o Boitatá' },
  { emoji: '🦇', name: 'o Morcegão' },
  { emoji: '👽', name: 'o ET de Varginha' },
  { emoji: '🎃', name: 'o Cabeça de Abóbora' },
  { emoji: '🐴', name: 'a Mula sem Cabeça (achou uma)' },
  { emoji: '🧸', name: 'o Ursinho Possuído' },
  { emoji: '🐔', name: 'a Galinha Zumbi' },
  { emoji: '👵', name: 'a Vovó que Não Dorme' },
  { emoji: '🐙', name: 'o Polvo do Ralo' },
  { emoji: '🦷', name: 'a Fada do Dente do Mal' },
  { emoji: '🐍', name: 'a Cobra-Grande' },
]

/** Quando TODOS os vivos estão atrás de porta com monstro, ninguém morre. */
export const SALVATION_LINES: readonly string[] = [
  'O monstro tropeçou!',
  'O monstro tropeçou no tapete!',
  'O monstro escorregou numa casca de banana!',
  'O monstro tropeçou no próprio rabo!',
  'O monstro tropeçou e caiu de cara no chão!',
]

/** Faixa da TV quando o além perde a paciência (rodada 8 em diante). */
export const IMPATIENT_LINES: readonly string[] = [
  'O além está ficando impaciente…',
  'Os monstros cansaram de esperar…',
  'Mais um monstro entrou no corredor…',
  'O além quer acabar logo com isso…',
]
