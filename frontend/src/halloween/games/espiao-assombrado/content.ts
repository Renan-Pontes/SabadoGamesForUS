/**
 * Os lugares do "Espião Assombrado": metade assombrados, metade do dia a dia
 * com um pé no Halloween. Cada um tem ícone, 8+ papéis (quem sabe o lugar
 * recebe um deles) e apelidos aceitos no chute digitado do espião.
 *
 * Regras do conteúdo:
 * - nome curto (cabe em duas linhas no celular) e papéis que rendem
 *   perguntas engraçadas ("o que você estava fazendo antes de chegar?");
 * - apelido nunca pode bater com outro lugar — o teste confere, porque chute
 *   que acerta dois lugares de uma vez não vale (senão o espião digitaria a
 *   lista inteira);
 * - nada de apelido curtinho que vira palavra comum com uma letra errada.
 *
 * O id do lugar é a posição na lista: não reordene no meio da festa.
 */
export type Place = {
  name: string
  icon: string
  aliases: readonly string[]
  roles: readonly string[]
}

export const PLACES: readonly Place[] = [
  {
    name: 'Cemitério',
    icon: '🪦',
    aliases: ['campo santo', 'necrópole', 'cemitério assombrado'],
    roles: ['Coveiro', 'Viúva chorona', 'Zumbi recém-acordado', 'Vigia noturno', 'Padre', 'Vendedor de flores', 'Ladrão de túmulos', 'Gato preto', 'Fantasma do túmulo 13'],
  },
  {
    name: 'Castelo do Drácula',
    icon: '🏰',
    aliases: ['castelo', 'castelo do vampiro', 'castelo assombrado', 'transilvânia'],
    roles: ['Conde Drácula', 'Mordomo corcunda', 'Noiva vampira', 'Caçador de vampiros', 'Morcego de estimação', 'Turista perdido', 'Cozinheiro que odeia alho', 'Pintor de retratos', 'Fantasma da torre'],
  },
  {
    name: 'Hospital Abandonado',
    icon: '🏥',
    aliases: ['hospital', 'hospício', 'manicômio', 'sanatório', 'hospital psiquiátrico', 'hospital assombrado'],
    roles: ['Enfermeira sinistra', 'Médico sumido', 'Paciente do quarto 7', 'Caçador de fantasmas', 'Youtuber fazendo live', 'Faxineiro', 'Segurança', 'Maqueiro fantasma'],
  },
  {
    name: 'Circo dos Horrores',
    icon: '🎪',
    aliases: ['circo', 'circo do terror', 'circo assombrado'],
    roles: ['Palhaço assustador', 'Mágico', 'Mulher barbada', 'Domador de leões', 'Engolidor de espadas', 'Trapezista', 'Bilheteiro', 'Atirador de facas', 'Criança perdida'],
  },
  {
    name: 'Navio Fantasma',
    icon: '🏴‍☠️',
    aliases: ['navio', 'navio pirata', 'barco', 'barco pirata', 'barco fantasma', 'navio assombrado'],
    roles: ['Capitão sem cabeça', 'Marinheiro esqueleto', 'Papagaio falante', 'Cozinheiro de bordo', 'Clandestino', 'Sereia', 'Prisioneiro do porão', 'Vigia do mastro'],
  },
  {
    name: 'Laboratório do Cientista Maluco',
    icon: '🧪',
    aliases: ['laboratório', 'laboratório maluco', 'laboratório do cientista', 'laboratório do frankenstein'],
    roles: ['Cientista maluco', 'Assistente corcunda', 'Monstro costurado', 'Rato de laboratório', 'Estagiário', 'Fiscal da vigilância sanitária', 'Cobaia voluntária', 'Investidor desconfiado'],
  },
  {
    name: 'Floresta Sombria',
    icon: '🌲',
    aliases: ['floresta', 'floresta assombrada', 'bosque', 'mata', 'mata fechada', 'selva'],
    roles: ['Lenhador', 'Lobo mau', 'Caçador', 'Escoteiro perdido', 'Chapeuzinho Vermelho', 'Coruja', 'Guarda-florestal', 'Curupira'],
  },
  {
    name: 'Escola à Meia-Noite',
    icon: '🏫',
    aliases: ['escola', 'colégio', 'escola assombrada', 'escola à noite'],
    roles: ['Diretor', 'Professora de química', 'Aluno de recuperação', 'Zelador', 'Inspetor', 'Merendeira', 'Loira do Banheiro', 'Esqueleto da aula de biologia'],
  },
  {
    name: 'Festa à Fantasia',
    icon: '🎭',
    aliases: ['festa', 'festa de halloween', 'baile', 'baile à fantasia', 'baile de máscaras', 'festa fantasiada'],
    roles: ['DJ', 'Fantasma de lençol', 'Dono da casa', 'Vampiro de farmácia', 'Penetra', 'Quem bebeu demais', 'Fotógrafo', 'Vizinho reclamando do som', 'Jurado do concurso de fantasia'],
  },
  {
    name: 'Trem Fantasma',
    icon: '🎢',
    aliases: ['trem', 'trem do terror', 'parque de diversões', 'parque de diversão', 'montanha-russa'],
    roles: ['Operador do brinquedo', 'Ator vestido de monstro', 'Criança apavorada', 'Casal de namorados', 'Vendedor de algodão-doce', 'Segurança do parque', 'Técnico de manutenção', 'Boneco que se mexe sozinho'],
  },
  {
    name: 'Mansão Mal-Assombrada',
    icon: '🏚️',
    aliases: ['mansão', 'mansão assombrada', 'casa assombrada', 'casa mal-assombrada', 'casarão'],
    roles: ['Mordomo', 'Herdeira da fortuna', 'Fantasma da escada', 'Médium', 'Corretor de imóveis', 'Detetive', 'Governanta', 'Retrato que segue com os olhos'],
  },
  {
    name: 'Necrotério',
    icon: '🧊',
    aliases: ['morgue', 'iml', 'instituto médico legal'],
    roles: ['Legista', 'Assistente que desmaia', 'Defunto que se mexe', 'Policial', 'Estudante de medicina', 'Faxineiro do turno da noite', 'Parente reconhecendo o corpo', 'Fotógrafo forense'],
  },
  {
    name: 'Igreja Abandonada',
    icon: '⛪',
    aliases: ['igreja', 'capela', 'catedral', 'igreja assombrada'],
    roles: ['Padre exorcista', 'Freira misteriosa', 'Coroinha', 'Sineiro', 'Fiel arrependido', 'Gárgula', 'Morcego do campanário', 'Organista'],
  },
  {
    name: 'Cabana da Bruxa',
    icon: '🧹',
    aliases: ['casa da bruxa', 'cabana', 'casinha de doces', 'casa de doces'],
    roles: ['Bruxa', 'Gato preto falante', 'Corvo', 'Aprendiz de feiticeira', 'João perdido', 'Maria perdida', 'Sapo que já foi príncipe', 'Cliente querendo poção do amor', 'Vassoura falante'],
  },
  {
    name: 'Pirâmide do Egito',
    icon: '🔺',
    aliases: ['pirâmide', 'egito', 'tumba do faraó', 'tumba'],
    roles: ['Múmia', 'Faraó', 'Arqueóloga', 'Guia turístico', 'Ladrão de tesouros', 'Camelo', 'Sacerdote', 'Escorpião', 'Turista com protetor solar'],
  },
  {
    name: 'Esgoto da Cidade',
    icon: '🐀',
    aliases: ['esgoto', 'bueiro', 'galeria de esgoto'],
    roles: ['Palhaço com balão vermelho', 'Rato gigante', 'Encanador', 'Jacaré perdido', 'Agente de saneamento', 'Fugitivo', 'Explorador urbano', 'Barata voadora'],
  },
  {
    name: 'Cinema à Meia-Noite',
    icon: '🍿',
    aliases: ['cinema', 'sala de cinema', 'sessão de terror', 'sessão da meia-noite'],
    roles: ['Pipoqueiro', 'Projecionista', 'Lanterninha', 'Casal que não para de falar', 'Quem assiste de olho tapado', 'Crítico de cinema', 'Criança que entrou escondida', 'Quem dorme no filme'],
  },
  {
    name: 'Delegacia',
    icon: '🚔',
    aliases: ['distrito policial', 'delegacia de polícia', 'polícia', 'cadeia', 'prisão', 'presídio'],
    roles: ['Delegado', 'Escrivão', 'Lobisomem preso', 'Testemunha assustada', 'Advogado', 'Policial novato', 'Perito', 'Suspeito inocente'],
  },
  {
    name: 'Fazenda Assombrada',
    icon: '🌽',
    aliases: ['fazenda', 'sítio', 'milharal', 'fazendinha'],
    roles: ['Fazendeiro', 'Espantalho', 'Saci', 'Mula sem cabeça', 'Vaca que encara', 'Peão', 'Cozinheira do fogão a lenha', 'Visitante da cidade grande'],
  },
  {
    name: 'Ônibus da Madrugada',
    icon: '🚌',
    aliases: ['ônibus', 'busão', 'ônibus noturno', 'coletivo'],
    roles: ['Motorista', 'Cobrador', 'Passageiro dormindo', 'Fantasma que pede parada', 'Estudante voltando da festa', 'Vendedor de bala', 'Fiscal', 'Senhora cheia de sacolas'],
  },
  {
    name: 'Supermercado 24h',
    icon: '🛒',
    aliases: ['supermercado', 'mercado', 'hipermercado', 'mercadinho'],
    roles: ['Operador de caixa', 'Repositor', 'Segurança', 'Cliente das 3 da manhã', 'Gerente', 'Açougueiro', 'Moça da degustação', 'Carrinho que anda sozinho'],
  },
  {
    name: 'Academia',
    icon: '🏋️',
    aliases: ['academia de ginástica', 'crossfit', 'ginásio', 'musculação'],
    roles: ['Personal trainer', 'Marombeiro', 'Recepcionista', 'Quem só tira selfie', 'Professora de zumba', 'Nutricionista', 'Iniciante perdido', 'Esqueleto fitness'],
  },
  {
    name: 'Casamento de Vampiros',
    icon: '💍',
    aliases: ['casamento', 'casamento vampiro', 'casório', 'festa de casamento'],
    roles: ['Noivo vampiro', 'Noiva fantasma', 'Padrinho', 'Madrinha', 'Padre nervoso', 'Fotógrafo', 'Tia que chora', 'Garçom', 'DJ do casamento'],
  },
  {
    name: 'Hotel Assombrado',
    icon: '🛎️',
    aliases: ['hotel', 'pousada', 'hotel mal-assombrado'],
    roles: ['Recepcionista', 'Camareira', 'Hóspede do quarto 237', 'Gêmeas do corredor', 'Mensageiro', 'Gerente da noite', 'Fantasma do elevador', 'Turista perdido'],
  },
  {
    name: 'Avião em Pleno Voo',
    icon: '✈️',
    aliases: ['avião', 'aeronave', 'avião em voo', 'voo noturno'],
    roles: ['Piloto', 'Comissária de bordo', 'Passageiro com medo de avião', 'Criança chutando a poltrona', 'Gremlin na asa', 'Copiloto', 'Passageiro da janela', 'Turista de pescoço travado'],
  },
  {
    name: 'Estação Espacial',
    icon: '🚀',
    aliases: ['nave espacial', 'nave', 'espaço', 'foguete', 'espaçonave'],
    roles: ['Astronauta', 'Comandante', 'Alienígena clandestino', 'Robô de bordo', 'Cientista', 'Turista bilionário', 'Engenheiro', 'Cachorro astronauta'],
  },
  {
    name: 'Zoológico',
    icon: '🦁',
    aliases: ['zoo', 'zoológico à noite', 'jardim zoológico', 'zoológico assombrado'],
    roles: ['Tratador', 'Veterinária', 'Leão com insônia', 'Macaco fujão', 'Vigia noturno', 'Visitante que ficou trancado', 'Bióloga', 'Pinguim'],
  },
  {
    name: 'Luau na Praia',
    icon: '🏖️',
    aliases: ['praia', 'luau', 'beira-mar', 'praia à noite', 'festa na praia'],
    roles: ['Salva-vidas', 'Surfista', 'Vendedor de milho', 'Sereia', 'Pescador', 'Turista queimado de sol', 'Tocador de violão', 'Caranguejo'],
  },
  {
    name: 'Shopping Fechado',
    icon: '🛍️',
    aliases: ['shopping', 'shopping center', 'centro comercial', 'shopping à noite'],
    roles: ['Segurança', 'Manequim que se mexe', 'Vendedora', 'Faxineiro', 'Cliente que dormiu no provador', 'Papai Noel fora de época', 'Gerente da loja', 'Criança perdida'],
  },
  {
    name: 'Biblioteca Proibida',
    icon: '📚',
    aliases: ['biblioteca', 'biblioteca assombrada', 'sala de leitura'],
    roles: ['Bibliotecária brava', 'Estudante desesperado', 'Fantasma leitor', 'Livro que morde', 'Pesquisador', 'Faxineiro', 'Coruja', 'Leitor que dormiu'],
  },
  {
    name: 'Museu de Cera',
    icon: '🗿',
    aliases: ['museu', 'museu à noite', 'museu assombrado'],
    roles: ['Estátua de cera', 'Guarda noturno', 'Escultor', 'Visitante', 'Guia', 'Restauradora', 'Ladrão de arte', 'Dono do museu'],
  },
  {
    name: 'Pizzaria Animatrônica',
    icon: '🍕',
    aliases: ['pizzaria', 'pizzaria dos animatrônicos', 'buffet infantil', 'festa infantil', 'aniversário', 'festa de aniversário'],
    roles: ['Animatrônico de coelho', 'Pizzaiolo', 'Segurança do turno da noite', 'Aniversariante', 'Garçom', 'Mascote fantasiado', 'Mãe organizando a festa', 'Técnico de manutenção'],
  },
  {
    name: 'Velório',
    icon: '🕯️',
    aliases: ['funeral', 'enterro', 'funerária'],
    roles: ['Defunto que acordou', 'Viúva', 'Padre', 'Parente distante', 'Tia que só veio pela comida', 'Agente funerário', 'Florista', 'Primo que conta piada'],
  },
  {
    name: 'Acampamento no Lago',
    icon: '⛺',
    aliases: ['acampamento', 'camping', 'lago', 'acampamento de verão'],
    roles: ['Monitor do acampamento', 'Campista', 'Cozinheiro', 'Mascarado do lago', 'Guarda-florestal', 'Contador de histórias', 'Pescador', 'Urso curioso'],
  },
  {
    name: 'Mina Abandonada',
    icon: '⛏️',
    aliases: ['mina', 'mina de ouro', 'caverna', 'gruta'],
    roles: ['Minerador', 'Capataz', 'Fantasma de capacete', 'Morcego', 'Geólogo', 'Explorador', 'Carrinho desgovernado', 'Turista de lanterna'],
  },
  {
    name: 'Farol Assombrado',
    icon: '🗼',
    aliases: ['farol', 'farol abandonado', 'ilha do farol'],
    roles: ['Faroleiro', 'Fantasma do naufrágio', 'Gaivota', 'Pescador', 'Guarda costeiro', 'Marinheiro perdido', 'Fotógrafa', 'Turista de barco'],
  },
  {
    name: 'Show de Rock',
    icon: '🎸',
    aliases: ['show de metal', 'festival de rock', 'show da banda', 'rock'],
    roles: ['Vocalista', 'Baterista', 'Roadie', 'Fã na grade', 'Segurança', 'Técnico de som', 'Vendedor de cerveja', 'Quem só filma o show'],
  },
  {
    name: 'Churrasco de Família',
    icon: '🍖',
    aliases: ['churrasco', 'churras', 'almoço de domingo', 'churrasco da família'],
    roles: ['Tio do pavê', 'Churrasqueiro', 'Avó', 'Primo chato', 'Cachorro esperando osso', 'Vizinho penetra', 'Tia fofoqueira', 'Cunhado que não ajuda'],
  },
  {
    name: 'Set de Filme de Terror',
    icon: '🎬',
    aliases: ['set de filmagem', 'filmagem', 'gravação de filme', 'filme de terror'],
    roles: ['Diretor', 'Atriz que grita', 'Dublê', 'Maquiador de efeitos', 'Figurante zumbi', 'Produtor', 'Câmera', 'Ator do assassino mascarado'],
  },
  {
    name: 'Metrô Fantasma',
    icon: '🚇',
    aliases: ['metrô', 'trem do metrô', 'vagão do metrô', 'metropolitano'],
    roles: ['Maquinista', 'Passageiro atrasado', 'Fantasma da última estação', 'Músico do vagão', 'Segurança', 'Vendedor ambulante', 'Turista perdido', 'Rato dos trilhos'],
  },
  {
    name: 'Escape Room',
    icon: '🔐',
    aliases: ['sala de fuga', 'sala de enigmas', 'sala de escape', 'escape'],
    roles: ['Organizador', 'Ator que dá susto', 'Jogador nervoso', 'Jogador sabe-tudo', 'Técnico das câmeras', 'Recepcionista', 'Grupo de amigos', 'Fantasma do enigma final'],
  },
  {
    name: 'Pântano',
    icon: '🐊',
    aliases: ['brejo', 'mangue', 'lamaçal', 'pântano assombrado'],
    roles: ['Monstro do pântano', 'Jacaré', 'Pescador', 'Bruxa do brejo', 'Sapo cantor', 'Caçador', 'Turista de barquinho', 'Vaga-lume'],
  },
  {
    name: 'Doces ou Travessuras',
    icon: '🍬',
    aliases: ['gostosuras ou travessuras', 'travessuras', 'pedindo doces', 'pedir doces'],
    roles: ['Criança fantasiada', 'Mãe acompanhando', 'Vizinho que dá fruta', 'Vizinha do doce bom', 'Adolescente sem fantasia', 'Cachorro fantasiado', 'Velho rabugento', 'Ladrão de doces'],
  },
  {
    name: 'Elevador Parado',
    icon: '🛗',
    aliases: ['elevador', 'elevador quebrado', 'elevador do prédio'],
    roles: ['Ascensorista', 'Pessoa claustrofóbica', 'Técnico do elevador', 'Porteiro no interfone', 'Entregador de pizza', 'Executivo atrasado', 'Fantasma do 13º andar', 'Vizinho do 501'],
  },
  {
    name: 'Salão de Beleza',
    icon: '💇',
    aliases: ['salão', 'cabeleireiro', 'barbearia', 'salão de cabeleireiro'],
    roles: ['Cabeleireira', 'Manicure', 'Cliente fofoqueira', 'Medusa', 'Recepcionista', 'Noiva nervosa', 'Barbeiro', 'Maquiadora'],
  },
  {
    name: 'Programa de Auditório',
    icon: '📺',
    aliases: ['auditório', 'programa de tv', 'estúdio de tv', 'show de calouros'],
    roles: ['Apresentador', 'Assistente de palco', 'Plateia animada', 'Câmera', 'Calouro', 'Jurado', 'Produtor', 'Pessoa da claque'],
  },
]
