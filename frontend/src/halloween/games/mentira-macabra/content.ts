/**
 * Os fatos da "Mentira Macabra": verdadeiros, conhecidos e bizarros, cada um
 * com UMA lacuna (`___`) que a galera completa com mentiras.
 *
 * Regras do conteúdo:
 * - Só fato verdadeiro e bem documentado. Na dúvida, fica de fora.
 * - `answer` é a verdade como aparece na TV: curta (1 a 3 palavras).
 * - `accept` são outras formas da verdade. Mentira igual a qualquer uma delas
 *   (sem ligar para acento, maiúscula, artigo ou letra trocada) é recusada no
 *   celular ("Isso é verdade!") e ignorada pelo motor.
 * - `house` são as 3 mentiras da casa: completam as opções quando tem pouca
 *   gente ou alguém não escreveu. Precisam ser falsas e plausíveis.
 * - `exact`: resposta numérica — "26" e "27" são coisas diferentes, então a
 *   comparação não perdoa letra trocada (liste as formas por extenso em
 *   `accept`).
 *
 * O id é a posição na lista: não reordene no meio da festa.
 */
export type Fact = {
  text: string
  answer: string
  accept: string[]
  house: string[]
  exact?: boolean
}

export const FACTS: readonly Fact[] = [
  // --- Halloween ------------------------------------------------------------
  {
    text: 'O Halloween nasceu de um festival celta de fim de colheita chamado ___.',
    answer: 'Samhain',
    accept: ['Samain', 'Samhuinn', 'Samhein'],
    house: ['Beltane', 'Ostara', 'Yule'],
  },
  {
    text: 'Antes das abóboras, as lanternas de Halloween na Irlanda eram esculpidas em ___.',
    answer: 'nabos',
    accept: ['nabo', 'rutabaga', 'rutabagas', 'batatas', 'batata', 'beterrabas', 'beterraba'],
    house: ['melancias', 'cocos', 'repolhos'],
  },
  {
    text: 'Pela lenda irlandesa, a lanterna de abóbora é de ___, um sujeito que enganou o Diabo.',
    answer: 'Jack',
    accept: ['Stingy Jack', 'Jack Pão-Duro', 'Jack o Avarento', 'Jack da Lanterna'],
    house: ['Patrick', 'Billy', 'Connor'],
  },
  {
    text: 'Halloween vem de “All Hallows’ Eve”: a véspera do Dia de ___.',
    answer: 'Todos os Santos',
    accept: ['Todos Santos', 'All Saints'],
    house: ['Finados', 'São Jorge', 'Reis'],
  },
  {
    text: 'O mágico Harry Houdini, rei das fugas impossíveis, morreu justo no dia de ___.',
    answer: 'Halloween',
    accept: ['31 de outubro', '31/10', 'Dia das Bruxas', 'Haloween', 'Noite das Bruxas'],
    house: ['Natal', 'Carnaval', 'Ano-Novo'],
  },
  {
    text: 'Para fazer frente ao Halloween, 31 de outubro também é comemorado no Brasil como o Dia do ___.',
    answer: 'Saci',
    accept: ['Saci-Pererê', 'Saci Pererê', 'Pererê', 'Saci Perere'],
    house: ['Curupira', 'Boitatá', 'Lobisomem'],
  },
  {
    text: 'O bolo irlandês de Halloween “barmbrack” esconde um ___: quem acha, casa logo.',
    answer: 'anel',
    accept: ['aliança', 'anelzinho', 'anel de noivado', 'anel de ouro'],
    house: ['dente', 'osso', 'chave'],
  },
  {
    text: 'Na brincadeira de Halloween de pescar maçãs numa bacia d’água, só vale usar a ___.',
    answer: 'boca',
    accept: ['boca e os dentes', 'dentes', 'boca mesmo', 'bocarra'],
    house: ['testa', 'orelha', 'colher'],
  },
  {
    text: 'O medo exagerado do Halloween tem até nome: ___.',
    answer: 'samhainofobia',
    accept: ['samhainophobia', 'samainofobia', 'samhainfobia', 'samhain fobia'],
    house: ['halloweenfobia', 'abobrofobia', 'bruxofobia'],
  },
  {
    text: 'O medo de palhaços também tem nome: ___.',
    answer: 'coulrofobia',
    accept: ['coulrophobia', 'colrofobia', 'coulrofobia aguda'],
    house: ['palhaçofobia', 'circofobia', 'bozofobia'],
  },

  // --- Folclore brasileiro ----------------------------------------------------
  {
    text: 'Para dominar o Saci-Pererê, a lenda manda roubar o ___ dele.',
    answer: 'gorro',
    accept: ['gorro vermelho', 'gorrinho', 'carapuça', 'carapuça vermelha', 'barrete', 'touca', 'chapéu', 'chapéu vermelho', 'boné'],
    house: ['cachimbo', 'pião', 'chinelo'],
  },
  {
    text: 'Receita para prender um Saci: jogar uma ___ no redemoinho e trancar ele numa garrafa.',
    answer: 'peneira',
    accept: ['peneira de taquara', 'peneira de palha', 'peneirinha'],
    house: ['rede de pesca', 'panela', 'vassoura'],
  },
  {
    text: 'A Mula-sem-cabeça solta ___ pelo pescoço.',
    answer: 'fogo',
    accept: ['labaredas', 'labareda', 'chamas', 'chama', 'fogo azul', 'fogaréu'],
    house: ['sangue', 'morcegos', 'gosma verde'],
  },
  {
    text: 'Pela lenda, a Mula-sem-cabeça era uma mulher que namorou um ___.',
    answer: 'padre',
    accept: ['sacerdote', 'vigário', 'pároco', 'padreco', 'padre da cidade'],
    house: ['lobisomem', 'coveiro', 'vampiro'],
  },
  {
    text: 'O Curupira, protetor das matas, tem os pés virados para ___.',
    answer: 'trás',
    accept: ['atrás', 'para trás', 'pra trás', 'o contrário', 'o lado contrário', 'o avesso', 'as costas'],
    house: ['cima', 'dentro', 'o céu'],
  },
  {
    text: 'Em tupi, o nome “Boitatá” quer dizer ___.',
    answer: 'cobra de fogo',
    accept: ['cobra-de-fogo', 'serpente de fogo', 'cobra fogo', 'cobra flamejante', 'serpente flamejante', 'cobra de fogo azul'],
    house: ['boi bravo', 'olho da noite', 'espírito da mata'],
  },
  {
    text: 'O Corpo-Seco foi tão ruim em vida que, quando morreu, até a ___ rejeitou o corpo dele.',
    answer: 'terra',
    accept: ['própria terra', 'chão'],
    house: ['sogra', 'mãe dele', 'vizinhança'],
  },
  {
    // (Esta posição era a do Negrinho do Pastoreio: história de criança escravizada e torturada não
    // combina com mentira engraçada de festa. Trocado no mesmo lugar para os ids não andarem.)
    text: 'Em “Gremlins” (1984), a regra mais importante: nunca dar comida ao bichinho depois da ___.',
    answer: 'meia-noite',
    accept: ['meia noite', 'zero hora', '0h', '00h', '0 hora'],
    house: ['novela', 'janta', 'missa'],
  },
  {
    text: 'O Mapinguari, monstro peludo da Amazônia, tem uma boca enorme na ___.',
    answer: 'barriga',
    accept: ['pança', 'ventre', 'abdômen', 'abdome', 'estômago', 'umbigo', 'barrigona'],
    house: ['nuca', 'mão', 'costas'],
  },
  {
    text: 'Quando vira gente, o Boto-cor-de-rosa usa um ___ para esconder o furo na cabeça.',
    answer: 'chapéu',
    accept: ['chapéu branco', 'chapéu de palha', 'boné', 'gorro', 'chapeuzinho'],
    house: ['turbante', 'capacete', 'lenço'],
  },
  {
    text: 'A Iara, a sereia dos rios, leva os pescadores para o fundo com o seu ___.',
    answer: 'canto',
    accept: ['cantar', 'cantoria', 'voz', 'canção', 'música', 'melodia', 'canto bonito'],
    house: ['perfume', 'cheiro de peixe', 'dinheiro'],
  },
  {
    text: 'No Sítio do Picapau Amarelo, a bruxa Cuca é um ___.',
    answer: 'jacaré',
    accept: ['jacaré-bruxa', 'jacaré bruxa', 'jacarezão', 'crocodilo', 'aligátor'],
    house: ['sapo', 'morcego', 'coruja'],
  },

  // --- Filmes e livros de terror ---------------------------------------------
  {
    text: 'Em “O Iluminado”, Jack Nicholson arrebenta uma porta usando um ___.',
    answer: 'machado',
    accept: ['machadinha', 'machadão'],
    house: ['martelo', 'taco de golfe', 'serrote'],
  },
  {
    text: 'O sangue da cena do chuveiro de “Psicose” (1960) era, na verdade, ___.',
    answer: 'calda de chocolate',
    accept: ['chocolate', 'xarope de chocolate', 'cobertura de chocolate', 'chocolate Bosco', 'Bosco'],
    house: ['suco de groselha', 'ketchup', 'tinta vermelha'],
  },
  {
    text: 'O tubarão mecânico de “Tubarão” (1975) ganhou da equipe o apelido de ___.',
    answer: 'Bruce',
    accept: ['Bruce o tubarão', 'tubarão Bruce'],
    house: ['Steve', 'Dentinho', 'Bob'],
  },
  {
    text: 'O nome completo do Chucky, Charles Lee Ray, junta os nomes de três ___ famosos.',
    answer: 'assassinos',
    accept: ['assassino', 'criminosos', 'serial killers', 'assassinos em série', 'matadores', 'psicopatas', 'bandidos'],
    house: ['presidentes', 'cantores', 'palhaços'],
  },
  {
    text: 'O suéter listrado de Freddy Krueger é vermelho e ___.',
    answer: 'verde',
    accept: ['verde-escuro', 'verde escuro', 'verde musgo'],
    house: ['preto', 'amarelo', 'roxo'],
  },
  {
    text: 'A máscara de Michael Myers, em “Halloween” (1978), era uma máscara barata do ___ pintada de branco.',
    answer: 'Capitão Kirk',
    accept: ['Kirk', 'William Shatner', 'Shatner', 'Star Trek', 'Jornada nas Estrelas', 'Capitão Kirk de Star Trek'],
    house: ['Elvis Presley', 'Super-Homem', 'Papai Noel'],
  },
  {
    text: 'Em “O Exorcista”, o famoso vômito verde da menina era sopa de ___.',
    answer: 'ervilha',
    accept: ['ervilhas', 'sopa de ervilha', 'creme de ervilha', 'ervilha partida'],
    house: ['espinafre', 'abacate', 'brócolis'],
  },
  {
    text: 'A máscara do assassino de “Pânico” lembra o quadro “O Grito”, do pintor ___.',
    answer: 'Edvard Munch',
    accept: ['Munch', 'Edward Munch', 'Edvard Monch', 'Munk'],
    house: ['Van Gogh', 'Salvador Dalí', 'Picasso'],
  },
  {
    text: 'Jason, de “Sexta-Feira 13”, só aparece com a máscara de hóquei no ___ filme.',
    answer: 'terceiro',
    accept: ['3º', '3', 'três', 'terceira', 'parte 3', 'terceiro filme', 'parte três'],
    house: ['segundo', 'quinto', 'primeiro'],
  },
  {
    text: 'No primeiro “Sexta-Feira 13” (1980), quem mata a galera não é o Jason, e sim a ___ dele.',
    answer: 'mãe',
    accept: ['mamãe', 'mãezinha', 'Pamela', 'Pamela Voorhees', 'senhora Voorhees', 'própria mãe'],
    house: ['irmã', 'avó', 'namorada'],
  },
  {
    text: 'Em “It: A Coisa”, o palhaço Pennywise volta para aterrorizar a cidade a cada ___ anos.',
    answer: '27',
    accept: ['vinte e sete', '27 anos', 'vinte e sete anos'],
    house: ['13', '33', '66'],
    exact: true,
  },
  {
    text: 'Em “Poltergeist”, a menina olha para a TV chiando e avisa: “Eles estão ___”.',
    answer: 'aqui',
    accept: ['aí', 'aki'],
    house: ['com fome', 'na geladeira', 'acordados'],
  },
  {
    text: 'Em “O Chamado”, quem assiste à fita amaldiçoada morre em ___.',
    answer: 'sete dias',
    accept: ['7 dias', '7', 'sete', 'uma semana', '1 semana', 'semana', 'sete dia', '7 dia'],
    house: ['três dias', 'treze dias', 'trinta dias'],
    exact: true,
  },
  {
    text: 'Em “O Chamado”, a menina Samara foi jogada dentro de um ___.',
    answer: 'poço',
    accept: ['poço fundo', 'poço velho', 'poço abandonado', 'buraco'],
    house: ['lago', 'guarda-roupa', 'caixão'],
  },
  {
    text: 'Bela Lugosi, o Drácula de 1931, foi enterrado com a ___ do personagem.',
    answer: 'capa',
    accept: ['capa preta', 'capa de vampiro', 'capa do Drácula', 'roupa', 'fantasia', 'figurino', 'roupa do Drácula'],
    house: ['dentadura', 'peruca', 'cueca'],
  },
  {
    text: 'Mary Shelley começou a escrever “Frankenstein” com apenas ___ anos.',
    answer: '18',
    accept: ['dezoito', '18 anos', 'dezoito anos'],
    house: ['12', '45', '70'],
    exact: true,
  },
  {
    text: 'Na história, Frankenstein é o nome do ___, e não do monstro.',
    answer: 'cientista',
    accept: ['cientista maluco', 'médico', 'doutor', 'criador', 'Victor', 'Victor Frankenstein', 'estudante', 'inventor', 'pai'],
    house: ['castelo', 'mordomo', 'cachorro'],
  },
  {
    text: 'Em “Frankenstein” (1931), o monstro tem dois ___ saindo do pescoço.',
    answer: 'parafusos',
    accept: ['parafuso', 'pinos', 'eletrodos', 'eletrodo', 'pregos', 'bornes'],
    house: ['canudos', 'chifres', 'zíperes'],
  },
  {
    text: 'O Drácula foi inspirado em Vlad III, príncipe da Valáquia famoso por ___ os inimigos.',
    answer: 'empalar',
    accept: ['espetar', 'empalação', 'empalando', 'empalar em estacas', 'espetar em estacas', 'enfiar estacas em'],
    house: ['morder', 'enfeitiçar', 'hipnotizar'],
  },
  {
    text: 'Em “Nosferatu” (1922), para não pagar direitos, o Drácula virou o Conde ___.',
    answer: 'Orlok',
    accept: ['Orloc', 'Orlock', 'Orloff', 'Orlof'],
    house: ['Vladimir', 'Morcegão', 'Bram'],
  },
  {
    text: 'A viúva do autor de “Drácula” ganhou na Justiça o direito de mandar ___ as cópias de “Nosferatu”.',
    answer: 'destruir',
    accept: ['queimar', 'destruírem', 'apagar', 'eliminar', 'incinerar', 'sumir com'],
    house: ['dublar', 'colorir', 'legendar'],
  },
  {
    text: 'O autor de “Drácula”, Bram Stoker, nunca pisou na ___, terra do castelo do conde.',
    answer: 'Transilvânia',
    accept: ['Transylvania', 'Romênia', 'Romenia'],
    house: ['Irlanda', 'Inglaterra', 'Escócia'],
  },
  {
    text: 'A risada maligna no fim da música “Thriller”, de Michael Jackson, é do ator ___.',
    answer: 'Vincent Price',
    accept: ['Price', 'Vincent', 'Vincent Prince', 'Vicente Price'],
    house: ['Christopher Lee', 'Boris Karloff', 'Bela Lugosi'],
  },
  {
    text: 'Em “Alien, o 8º Passageiro”, o sangue da criatura é ___.',
    answer: 'ácido',
    accept: ['ácido corrosivo', 'ácido sulfúrico', 'corrosivo', 'ácido puro'],
    house: ['gasolina', 'mercúrio', 'veneno de cobra'],
  },
  {
    text: 'Johnny Depp estreou no cinema em “A Hora do Pesadelo”, num personagem engolido pela ___.',
    answer: 'cama',
    accept: ['própria cama', 'cama dele', 'colchão'],
    house: ['banheira', 'privada', 'geladeira'],
  },
  {
    text: 'Stephen King jogou o rascunho de ___ no lixo, e a esposa dele resgatou.',
    answer: 'Carrie',
    accept: ['Carrie a Estranha', 'Carrie, a Estranha'],
    house: ['It', 'O Iluminado', 'Cemitério Maldito'],
  },
  {
    text: 'Hitchcock comprou o máximo de exemplares do livro “Psicose” para ninguém descobrir o ___.',
    answer: 'final',
    accept: ['fim', 'desfecho', 'final do livro', 'fim da história', 'final da história', 'spoiler', 'segredo', 'assassino', 'reviravolta'],
    house: ['preço', 'título', 'autor'],
  },
  {
    text: 'Depois de “Psicose”, a atriz Janet Leigh passou a evitar ___.',
    answer: 'chuveiro',
    accept: ['chuveiros', 'banho de chuveiro', 'ducha', 'duchas'],
    house: ['facas', 'pássaros', 'espelhos'],
  },
  {
    text: 'Em “O Sexto Sentido”, o menino confessa: “Eu vejo ___”.',
    answer: 'gente morta',
    accept: ['pessoas mortas', 'pessoa morta', 'mortos', 'defuntos', 'gente morrida'],
    house: ['anjos', 'o futuro', 'cores'],
  },
  {
    text: 'A música-tema de “Tubarão”, que dá aflição até hoje, é basicamente ___ notas se alternando.',
    answer: 'duas',
    accept: ['2', 'dois', 'duas notas', '2 notas'],
    house: ['três', 'sete', 'doze'],
    exact: true,
  },
  {
    text: 'Em “Halloween” (1978), Michael Myers faz a primeira vítima aos 6 anos: a própria ___.',
    answer: 'irmã',
    accept: ['irmã mais velha', 'irmãzinha', 'Judith'],
    house: ['babá', 'professora', 'vizinha'],
  },
  {
    text: 'O Pinhead, de “Hellraiser”, tem a cabeça toda cravada de ___.',
    answer: 'pregos',
    accept: ['prego', 'alfinetes', 'pinos', 'agulhas', 'cravos', 'pregos de metal'],
    house: ['velas', 'botões', 'diamantes'],
  },
  {
    text: 'O filme “Atividade Paranormal” (2007) foi gravado na ___ do próprio diretor.',
    answer: 'casa',
    accept: ['própria casa', 'casa dele', 'residência', 'moradia', 'sala', 'quarto'],
    house: ['garagem', 'escola', 'igreja'],
  },
  {
    text: 'O vilão de “O Massacre da Serra Elétrica” usa uma máscara feita de ___.',
    answer: 'pele humana',
    accept: ['pele de gente', 'pele de pessoas', 'pele das vítimas', 'rosto humano', 'couro humano'],
    house: ['borracha', 'papelão', 'saco de pão'],
  },
  {
    text: 'A Annabelle verdadeira, que inspirou os filmes, é uma boneca de ___.',
    answer: 'pano',
    accept: ['trapo', 'tecido', 'retalhos', 'algodão', 'feltro', 'Raggedy Ann'],
    house: ['porcelana', 'cera', 'madeira'],
  },
  {
    text: 'O primeiro filme de terror da história, de 1896, foi dirigido pelo francês Georges ___.',
    answer: 'Méliès',
    accept: ['Melies', 'Mélies', 'Meliès', 'Meliés'],
    house: ['Lumière', 'Pathé', 'Gaumont'],
  },
  {
    text: 'Zé do Caixão, o mestre do terror brasileiro, era famoso pelas ___ enormes.',
    answer: 'unhas',
    accept: ['unha', 'unhas compridas', 'unhas longas', 'unhonas', 'garras'],
    house: ['sobrancelhas', 'orelhas', 'costeletas'],
  },
  {
    text: '“À Meia-Noite Levarei Sua Alma” (1964), do Zé do Caixão, é tido como o primeiro filme de terror do ___.',
    answer: 'Brasil',
    accept: ['cinema brasileiro', 'Brazil', 'país', 'cinema nacional'],
    house: ['México', 'Japão', 'mundo'],
  },
  {
    text: 'Edgar Allan Poe escreveu um poema famoso sobre um ___ que só repete “nunca mais”.',
    answer: 'corvo',
    accept: ['corvo negro', 'corvo preto', 'pássaro preto', 'raven'],
    house: ['papagaio', 'morcego', 'gato preto'],
  },

  // --- História esquisita ------------------------------------------------------
  {
    text: 'Para viajar até Paris, a múmia do faraó Ramsés II precisou tirar um ___.',
    answer: 'passaporte',
    accept: ['passaporte egípcio', 'passaporte próprio'],
    house: ['título de eleitor', 'atestado de óbito', 'visto de turista'],
  },
  {
    text: 'Na Idade Média, porcos e até ratos podiam ser levados a ___ por seus crimes.',
    answer: 'julgamento',
    accept: ['julgamentos', 'tribunal', 'júri', 'juízo', 'justiça', 'corte'],
    house: ['missa', 'casamento', 'escola'],
  },
  {
    text: 'No século 19, inventaram caixões com um ___ para quem fosse enterrado vivo pedir socorro.',
    answer: 'sino',
    accept: ['sininho', 'sinos', 'campainha', 'sineta', 'sino de alarme'],
    house: ['apito', 'tambor', 'trompete'],
  },
  {
    text: 'Os antigos egípcios tiravam o ___ das múmias pelo nariz, com um gancho.',
    answer: 'cérebro',
    accept: ['cérebros', 'miolo', 'miolos', 'massa cinzenta'],
    house: ['coração', 'olho', 'estômago'],
  },
  {
    text: 'Em 1518, na cidade de Estrasburgo, centenas de pessoas não conseguiam parar de ___.',
    answer: 'dançar',
    accept: ['dança', 'bailar', 'dançar sem parar', 'requebrar', 'sapatear', 'pular'],
    house: ['rir', 'espirrar', 'soluçar'],
  },
  {
    text: 'Na era vitoriana, muitas famílias tiravam foto posando com ___.',
    answer: 'parentes mortos',
    accept: ['mortos', 'defuntos', 'cadáveres', 'gente morta', 'pessoas mortas', 'familiares mortos', 'parente morto', 'o defunto', 'falecidos'],
    house: ['corujas', 'cobras', 'palhaços'],
  },
  {
    text: 'Na era vitoriana, havia festas em que os convidados assistiam ao ___ de múmias.',
    answer: 'desenrolar',
    accept: ['desembrulhar', 'desenfaixar', 'desenrolamento', 'desenfaixamento', 'desembrulho', 'desembalar'],
    house: ['casamento', 'batizado', 'desfile'],
  },
  {
    text: 'Por mais estranho que pareça, o animal nacional da Escócia é o ___.',
    answer: 'unicórnio',
    accept: ['unicórnios'],
    house: ['dragão', 'lobo', 'monstro do Lago Ness'],
  },
  {
    text: 'Diz a lenda que, se os ___ da Torre de Londres forem embora, o reino cai.',
    answer: 'corvos',
    accept: ['corvo', 'seis corvos', '6 corvos', 'corvos da torre'],
    house: ['gatos', 'morcegos', 'fantasmas'],
  },
  {
    text: 'A Casa Winchester, na Califórnia, tem escadas que terminam no ___.',
    answer: 'teto',
    accept: ['forro', 'nada', 'lugar nenhum', 'nenhum lugar'],
    house: ['porão', 'cemitério', 'cofre'],
  },
  {
    text: 'Diz a lenda que a viúva Sarah Winchester nunca parava de reformar a casa para confundir os ___.',
    answer: 'fantasmas',
    accept: ['fantasma', 'espíritos', 'espírito', 'almas', 'almas penadas', 'assombrações', 'mortos', 'espíritos dos mortos'],
    house: ['ladrões', 'vizinhos', 'cobradores'],
  },
  {
    text: 'Os morcegos-vampiros costumam ___ sangue com os colegas que passaram fome.',
    answer: 'dividir',
    accept: ['compartilhar', 'repartir', 'doar', 'dar', 'vomitar', 'regurgitar', 'trocar', 'emprestar'],
    house: ['vender', 'congelar', 'esconder'],
  },
  {
    text: 'Para a botânica, a abóbora é uma ___.',
    answer: 'fruta',
    accept: ['fruto', 'frutas', 'baga'],
    house: ['raiz', 'semente', 'flor'],
  },
  {
    text: 'No julgamento das bruxas de Salém, em 1692, ninguém foi queimado: os condenados foram ___.',
    answer: 'enforcados',
    accept: ['enforcadas', 'enforcado', 'enforcada', 'na forca', 'para a forca', 'mortos na forca', 'pendurados'],
    house: ['afogados', 'exilados', 'decapitados'],
  },
  {
    text: 'Na Irlanda, a “banshee” é um espírito que ___ quando alguém da família vai morrer.',
    answer: 'grita',
    accept: ['gritar', 'chora', 'chorar', 'uiva', 'berra', 'geme', 'lamenta', 'canta', 'urra', 'grita e chora'],
    house: ['dança', 'espirra', 'assobia'],
  },
  {
    text: 'O Chupa-Cabra ficou famoso em 1995, com ataques a animais em ___.',
    answer: 'Porto Rico',
    accept: ['Puerto Rico'],
    house: ['Texas', 'Argentina', 'Canadá'],
  },
  {
    text: 'O tabuleiro Ouija, de “falar com espíritos”, é vendido até hoje como ___ por uma fábrica de brinquedos.',
    answer: 'jogo de tabuleiro',
    accept: ['brinquedo', 'brincadeira', 'passatempo', 'jogo infantil', 'jogo de família', 'jogo de mesa'],
    house: ['artigo religioso', 'remédio', 'enfeite de parede'],
  },
  {
    text: 'Na Idade Média, muita gente acreditava que gatos pretos eram ___ disfarçadas.',
    answer: 'bruxas',
    accept: ['bruxa', 'feiticeiras', 'feiticeira', 'bruxas transformadas'],
    house: ['princesas', 'freiras', 'fadas'],
  },
  {
    text: 'No Dia dos Mortos mexicano, o pão especial da festa se chama “pan de ___”.',
    answer: 'muerto',
    accept: ['muertos', 'morto', 'mortos'],
    house: ['calavera', 'alma', 'fantasma'],
  },
  {
    text: 'A lenda dos zumbis, os mortos-vivos, nasceu nas crenças do vodu do ___.',
    answer: 'Haiti',
    accept: ['Haití', 'Haity'],
    house: ['Egito', 'México', 'Japão'],
  },
]

/** A lacuna dos fatos (uma por fato). */
export const BLANK = '___'

/** O fato pelo id; id inválido cai no primeiro (nunca quebra a partida). */
export function factById(id: number): Fact {
  return FACTS[id] ?? FACTS[0]
}
