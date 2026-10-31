/**
 * As perguntas do "Quiz do Terror": filmes e séries de terror, monstros
 * clássicos, folclore brasileiro e o Halloween com suas superstições.
 *
 * Regras do conteúdo:
 * - Só fato verdadeiro e conhecido. Na dúvida, fica de fora.
 * - Pergunta curta (cabe em três linhas na TV) e alternativas curtinhas
 *   (cabem no botão do celular de 360 px).
 * - As três erradas são plausíveis, mas nunca "meio certas" (nada de outra
 *   versão da lenda que também valeria).
 * - O texto de uma pergunta não entrega a resposta de outra (podem cair na
 *   mesma partida).
 * - O id é a posição na lista; não reordene no meio da festa (a partida em
 *   andamento guarda os ids).
 */

export type QuizCategory = 'filmes' | 'monstros' | 'folclore' | 'halloween'

export type QuizItem = {
  category: QuizCategory
  text: string
  answer: string
  wrong: readonly [string, string, string]
}

export const CATEGORIES: Record<QuizCategory, { icon: string; label: string }> = {
  filmes: { icon: '🎬', label: 'Filmes e séries' },
  monstros: { icon: '🧛', label: 'Monstros clássicos' },
  folclore: { icon: '🌿', label: 'Folclore brasileiro' },
  halloween: { icon: '🎃', label: 'Halloween e superstições' },
}

export const QUESTIONS: readonly QuizItem[] = [
  // --- 🎬 Filmes e séries ----------------------------------------------------
  { category: 'filmes', text: 'Qual vilão usa uma máscara de hóquei?', answer: 'Jason', wrong: ['Michael Myers', 'Ghostface', 'Leatherface'] },
  { category: 'filmes', text: 'Qual vilão ataca as vítimas dentro dos sonhos?', answer: 'Freddy Krueger', wrong: ['Jason', 'Chucky', 'Pinhead'] },
  { category: 'filmes', text: 'Como se chama o boneco de “Brinquedo Assassino”?', answer: 'Chucky', wrong: ['Billy', 'Slappy', 'Annabelle'] },
  { category: 'filmes', text: "Que ator grita “Here's Johnny!” em “O Iluminado”?", answer: 'Jack Nicholson', wrong: ['Anthony Hopkins', 'Robert De Niro', 'Al Pacino'] },
  { category: 'filmes', text: 'Quem dirigiu “Psicose”, de 1960?', answer: 'Alfred Hitchcock', wrong: ['Stanley Kubrick', 'John Carpenter', 'Steven Spielberg'] },
  { category: 'filmes', text: 'Em “Psicose”, como se chama o dono do motel?', answer: 'Norman Bates', wrong: ['Jack Torrance', 'Hannibal Lecter', 'Michael Myers'] },
  { category: 'filmes', text: 'Qual é o nome do palhaço de “It: A Coisa”?', answer: 'Pennywise', wrong: ['Art', 'Bozo', 'Krusty'] },
  { category: 'filmes', text: 'Quem escreveu o livro “It: A Coisa”?', answer: 'Stephen King', wrong: ['Edgar Allan Poe', 'H. P. Lovecraft', 'Anne Rice'] },
  { category: 'filmes', text: 'Em “O Exorcista”, como se chama a menina possuída?', answer: 'Regan', wrong: ['Carrie', 'Samara', 'Esther'] },
  { category: 'filmes', text: 'Em que filme uma menina sai de um poço e depois sai da TV?', answer: 'O Chamado', wrong: ['O Grito', 'Sobrenatural', 'Invocação do Mal'] },
  { category: 'filmes', text: 'Como se chama o mascarado de “Pânico”?', answer: 'Ghostface', wrong: ['Jigsaw', 'Leatherface', 'Pinhead'] },
  { category: 'filmes', text: 'Qual vilão ataca com uma serra elétrica?', answer: 'Leatherface', wrong: ['Freddy Krueger', 'Ghostface', 'Pinhead'] },
  { category: 'filmes', text: 'Qual é o apelido do assassino de “Jogos Mortais”?', answer: 'Jigsaw', wrong: ['Ghostface', 'Candyman', 'Pinhead'] },
  { category: 'filmes', text: 'Como se chama o boneco de triciclo de “Jogos Mortais”?', answer: 'Billy', wrong: ['Chucky', 'Slappy', 'Robert'] },
  { category: 'filmes', text: 'Quem é o mascarado de “Halloween”, de 1978?', answer: 'Michael Myers', wrong: ['Jason Voorhees', 'Freddy Krueger', 'Norman Bates'] },
  { category: 'filmes', text: 'Quem dirigiu “Halloween”, de 1978?', answer: 'John Carpenter', wrong: ['Wes Craven', 'Sam Raimi', 'George Romero'] },
  { category: 'filmes', text: 'Em “A Hora do Pesadelo”, a rua do título original é a…', answer: 'Elm Street', wrong: ['Main Street', 'Baker Street', 'Wall Street'] },
  { category: 'filmes', text: 'Quem dirigiu “Pânico” e “A Hora do Pesadelo”?', answer: 'Wes Craven', wrong: ['John Carpenter', 'James Wan', 'Sam Raimi'] },
  { category: 'filmes', text: 'Que casal de investigadores aparece em “Invocação do Mal”?', answer: 'Ed e Lorraine Warren', wrong: ['Gomez e Mortícia', 'Mulder e Scully', 'Jack e Sally'] },
  { category: 'filmes', text: 'Qual boneca de “Invocação do Mal” ganhou filme próprio?', answer: 'Annabelle', wrong: ['Chucky', 'M3GAN', 'Robert'] },
  { category: 'filmes', text: 'Quem dirigiu “Corra!”, de 2017?', answer: 'Jordan Peele', wrong: ['Ari Aster', 'James Wan', 'M. Night Shyamalan'] },
  { category: 'filmes', text: 'Em “O Sexto Sentido”, o menino diz que vê…', answer: 'Gente morta', wrong: ['Monstros', 'Palhaços', 'Alienígenas'] },
  { category: 'filmes', text: 'Em “Um Lugar Silencioso”, os monstros caçam guiados pelo…', answer: 'Som', wrong: ['Cheiro', 'Calor', 'Brilho'] },
  { category: 'filmes', text: 'Que filme de 1999 fingia ser a gravação real de jovens sumidos na mata?', answer: 'A Bruxa de Blair', wrong: ['Atividade Paranormal', '[REC]', 'Cloverfield'] },
  { category: 'filmes', text: 'Em “Gremlins”, depois de que hora o bichinho não pode comer?', answer: 'Meia-noite', wrong: ['Meio-dia', 'Seis da tarde', 'Dez da noite'] },
  { category: 'filmes', text: 'Como se chama o “bioexorcista” de “Os Fantasmas se Divertem”?', answer: 'Beetlejuice', wrong: ['Gasparzinho', 'Jack Esqueleto', 'Edward'] },
  { category: 'filmes', text: 'Quem é o “Rei das Abóboras” da Cidade do Halloween?', answer: 'Jack Esqueleto', wrong: ['Zero', 'Oogie Boogie', 'Papai Noel'] },
  { category: 'filmes', text: 'Qual família tem Wandinha, Feioso e Mortícia?', answer: 'Família Addams', wrong: ['Família Monstro', 'Família Warren', 'Família Torrance'] },
  { category: 'filmes', text: 'Qual é o nome da mão que anda sozinha, amiga da Wandinha?', answer: 'Mãozinha', wrong: ['Garrinha', 'Dedinho', 'Tampinha'] },
  { category: 'filmes', text: 'Em “Poltergeist”, o que a menina diz em frente à TV?', answer: 'Eles estão aqui', wrong: ['Tem alguém aí?', 'Venha brincar', 'Não olhe para trás'] },
  { category: 'filmes', text: 'Em que hotel se passa “O Iluminado”?', answer: 'Hotel Overlook', wrong: ['Hotel Califórnia', 'Hotel Cecil', 'Grande Hotel Budapeste'] },
  { category: 'filmes', text: 'Qual é o vilão canibal de “O Silêncio dos Inocentes”?', answer: 'Hannibal Lecter', wrong: ['Jack Torrance', 'Jigsaw', 'Freddy Krueger'] },
  { category: 'filmes', text: 'Quem dirigiu “Tubarão”, de 1975?', answer: 'Steven Spielberg', wrong: ['Alfred Hitchcock', 'John Carpenter', 'George Lucas'] },
  { category: 'filmes', text: 'Qual monstro ficou famoso com “A Noite dos Mortos-Vivos”, de 1968?', answer: 'Zumbi', wrong: ['Vampiro', 'Lobisomem', 'Múmia'] },
  { category: 'filmes', text: 'Qual cineasta brasileiro criou o Zé do Caixão?', answer: 'José Mojica Marins', wrong: ['Glauber Rocha', 'Walter Salles', 'Fernando Meirelles'] },
  { category: 'filmes', text: 'Em “Sexta-Feira 13”, de 1980, quem é o assassino?', answer: 'A mãe do Jason', wrong: ['O próprio Jason', 'O pai do Jason', 'O cozinheiro'] },
  { category: 'filmes', text: 'Qual demônio aparece como freira em “Invocação do Mal 2”?', answer: 'Valak', wrong: ['Pazuzu', 'Bughuul', 'Annabelle'] },
  { category: 'filmes', text: 'Quem faz a Wandinha na série da Netflix de 2022?', answer: 'Jenna Ortega', wrong: ['Christina Ricci', 'Millie Bobby Brown', 'Zendaya'] },
  { category: 'filmes', text: 'Em “Stranger Things”, como se chama o mundo paralelo?', answer: 'Mundo Invertido', wrong: ['Mundo Sombrio', 'Outro Lado', 'Mundo dos Mortos'] },
  { category: 'filmes', text: 'Qual é o monstro da 1ª temporada de “Stranger Things”?', answer: 'Demogorgon', wrong: ['Vecna', 'Devorador de Mentes', 'Pennywise'] },
  { category: 'filmes', text: 'Como se chama o cenobita com pregos na cabeça, de “Hellraiser”?', answer: 'Pinhead', wrong: ['Jigsaw', 'Candyman', 'Chucky'] },
  { category: 'filmes', text: 'Quantas vezes é preciso dizer “Candyman” no espelho?', answer: '5', wrong: ['3', '7', '13'] },
  { category: 'filmes', text: 'De que cor é o balão do palhaço de “It: A Coisa”?', answer: 'Vermelho', wrong: ['Preto', 'Verde', 'Roxo'] },
  { category: 'filmes', text: 'Em “Coraline”, a Outra Mãe tem o quê no lugar dos olhos?', answer: 'Botões', wrong: ['Moedas', 'Espelhos', 'Pedras'] },
  { category: 'filmes', text: 'Qual filme tem as bruxas irmãs Sanderson?', answer: 'Abracadabra', wrong: ['Convenção das Bruxas', 'Jovens Bruxas', 'Da Magia à Sedução'] },
  { category: 'filmes', text: 'Em que estado americano se passa “O Massacre da Serra Elétrica”?', answer: 'Texas', wrong: ['Califórnia', 'Flórida', 'Ohio'] },
  { category: 'filmes', text: 'Qual é o fantasminha camarada dos desenhos animados?', answer: 'Gasparzinho', wrong: ['Beetlejuice', 'Pernalonga', 'Pica-Pau'] },
  { category: 'filmes', text: 'Qual cachorro resolve mistérios com a turma da Mistério S.A.?', answer: 'Scooby-Doo', wrong: ['Snoopy', 'Pluto', 'Bidu'] },

  // --- 🧛 Monstros clássicos ---------------------------------------------------
  { category: 'monstros', text: 'Quem escreveu “Frankenstein”?', answer: 'Mary Shelley', wrong: ['Jane Austen', 'Agatha Christie', 'Emily Brontë'] },
  { category: 'monstros', text: 'No livro, “Frankenstein” é o nome de quem?', answer: 'Do cientista', wrong: ['Do monstro', 'Do castelo', 'Da cidade'] },
  { category: 'monstros', text: 'Quem escreveu “Drácula”, de 1897?', answer: 'Bram Stoker', wrong: ['Oscar Wilde', 'Charles Dickens', 'Arthur Conan Doyle'] },
  { category: 'monstros', text: 'De que região vem o Conde Drácula?', answer: 'Transilvânia', wrong: ['Escócia', 'Sibéria', 'Baviera'] },
  { category: 'monstros', text: 'Segundo as lendas, qual tempero espanta vampiros?', answer: 'Alho', wrong: ['Pimenta', 'Canela', 'Orégano'] },
  { category: 'monstros', text: 'Segundo a lenda, que tipo de bala mata um lobisomem?', answer: 'Bala de prata', wrong: ['Bala de ouro', 'Bala de cobre', 'Bala de chumbo'] },
  { category: 'monstros', text: 'O lobisomem se transforma em qual fase da Lua?', answer: 'Lua cheia', wrong: ['Lua nova', 'Minguante', 'Crescente'] },
  { category: 'monstros', text: 'Qual monstro não tem reflexo no espelho?', answer: 'Vampiro', wrong: ['Lobisomem', 'Múmia', 'Zumbi'] },
  { category: 'monstros', text: 'As múmias mais famosas do mundo são de qual país?', answer: 'Egito', wrong: ['Grécia', 'Índia', 'China'] },
  { category: 'monstros', text: 'No filme “Frankenstein”, de 1931, o que dá vida à criatura?', answer: 'Um raio', wrong: ['Uma poção', 'Um feitiço', 'Uma mordida'] },
  { category: 'monstros', text: 'Em que país fica o Lago Ness, do famoso monstro?', answer: 'Escócia', wrong: ['Irlanda', 'Noruega', 'Islândia'] },
  { category: 'monstros', text: 'O Godzilla nasceu em filmes de qual país?', answer: 'Japão', wrong: ['Coreia do Sul', 'China', 'Estados Unidos'] },
  { category: 'monstros', text: 'O Yeti, o “abominável homem das neves”, viveria onde?', answer: 'No Himalaia', wrong: ['Nos Andes', 'Nos Alpes', 'Na Groenlândia'] },
  { category: 'monstros', text: 'Qual filme mudo de 1922 trouxe o vampiro Conde Orlok?', answer: 'Nosferatu', wrong: ['Metrópolis', 'O Gabinete do Dr. Caligari', 'O Fantasma da Ópera'] },
  { category: 'monstros', text: 'Quem interpretou o Drácula no filme de 1931?', answer: 'Bela Lugosi', wrong: ['Boris Karloff', 'Christopher Lee', 'Vincent Price'] },
  { category: 'monstros', text: 'Na mitologia grega, quem olhava para a Medusa virava…', answer: 'Pedra', wrong: ['Ouro', 'Gelo', 'Sal'] },
  { category: 'monstros', text: 'Quantas cabeças tem Cérbero, o cão que guarda o mundo dos mortos?', answer: '3', wrong: ['2', '5', '7'] },
  { category: 'monstros', text: 'Em “O Médico e o Monstro”, como se chama o lado monstruoso?', answer: 'Mr. Hyde', wrong: ['Dr. Jekyll', 'Dr. Moreau', 'Mr. Holmes'] },
  { category: 'monstros', text: 'Quem escreveu “O Homem Invisível”, de 1897?', answer: 'H. G. Wells', wrong: ['Júlio Verne', 'Oscar Wilde', 'Arthur Conan Doyle'] },
  { category: 'monstros', text: 'O nome “Drácula” foi tirado de qual governante de verdade?', answer: 'Vlad, o Empalador', wrong: ['Ivan, o Terrível', 'Átila, o Huno', 'Nero'] },
  { category: 'monstros', text: 'Em que cidade se esconde o Fantasma da Ópera?', answer: 'Paris', wrong: ['Londres', 'Viena', 'Roma'] },
  { category: 'monstros', text: 'Em que animal o Drácula se transforma nos filmes?', answer: 'Morcego', wrong: ['Corvo', 'Gato preto', 'Coruja'] },
  { category: 'monstros', text: 'Que criatura, metade homem e metade touro, vivia num labirinto?', answer: 'Minotauro', wrong: ['Centauro', 'Ciclope', 'Grifo'] },
  { category: 'monstros', text: 'Que gigante de um olho só enfrentou Ulisses?', answer: 'Ciclope', wrong: ['Minotauro', 'Hidra', 'Golias'] },
  { category: 'monstros', text: 'Na lenda, o que acontece quando se corta uma cabeça da Hidra?', answer: 'Nascem duas', wrong: ['Ela morre', 'Ela explode', 'Nasce uma asa'] },
  { category: 'monstros', text: 'Quem escreveu o poema “O Corvo”?', answer: 'Edgar Allan Poe', wrong: ['Stephen King', 'Lord Byron', 'Charles Dickens'] },

  // --- 🌿 Folclore brasileiro --------------------------------------------------
  { category: 'folclore', text: 'Quantas pernas tem o Saci-Pererê?', answer: 'Uma', wrong: ['Duas', 'Três', 'Nenhuma'] },
  { category: 'folclore', text: 'O que o Saci usa na cabeça?', answer: 'Gorro vermelho', wrong: ['Chapéu de palha', 'Coroa de flores', 'Boné azul'] },
  { category: 'folclore', text: 'Segundo a lenda, o que se joga no redemoinho para pegar o Saci?', answer: 'Uma peneira', wrong: ['Uma rede', 'Um balde', 'Um laço'] },
  { category: 'folclore', text: 'O Saci adora fazer o quê?', answer: 'Travessuras', wrong: ['Faxina', 'Dever de casa', 'Jardinagem'] },
  { category: 'folclore', text: 'Qual criatura do folclore tem os pés virados para trás?', answer: 'Curupira', wrong: ['Saci', 'Boitatá', 'Iara'] },
  { category: 'folclore', text: 'O Curupira é o protetor de quê?', answer: 'Das matas', wrong: ['Das cidades', 'Dos tesouros', 'Das igrejas'] },
  { category: 'folclore', text: 'A Iara atrai os pescadores com…', answer: 'O seu canto', wrong: ['Ouro', 'Comida', 'Uma dança'] },
  { category: 'folclore', text: 'A Iara é metade mulher e metade…', answer: 'Peixe', wrong: ['Cobra', 'Pássaro', 'Onça'] },
  { category: 'folclore', text: 'Qual é a cobra de fogo do folclore brasileiro?', answer: 'Boitatá', wrong: ['Caipora', 'Curupira', 'Mapinguari'] },
  { category: 'folclore', text: 'Na lenda amazônica, que animal vira um moço bonito nas festas?', answer: 'Boto cor-de-rosa', wrong: ['Onça-pintada', 'Jacaré', 'Peixe-boi'] },
  { category: 'folclore', text: 'O que a Mula sem Cabeça solta no lugar da cabeça?', answer: 'Fogo', wrong: ['Água', 'Gelo', 'Raios'] },
  { category: 'folclore', text: 'Segundo a lenda, a Mula sem Cabeça era uma mulher que namorou um…', answer: 'Padre', wrong: ['Pirata', 'Cangaceiro', 'Rei'] },
  { category: 'folclore', text: 'Complete a cantiga: “Nana, neném, que a ___ vem pegar”', answer: 'Cuca', wrong: ['Iara', 'Mula', 'Saci'] },
  { category: 'folclore', text: 'Quem criou o Sítio do Picapau Amarelo?', answer: 'Monteiro Lobato', wrong: ['Ziraldo', 'Mauricio de Sousa', 'Ruth Rocha'] },
  { category: 'folclore', text: 'No folclore brasileiro, em que noite o lobisomem se transforma?', answer: 'Sexta-feira', wrong: ['Segunda-feira', 'Quarta-feira', 'Domingo'] },
  { category: 'folclore', text: 'A Caipora, protetora dos bichos, anda montada em quê?', answer: 'Porco-do-mato', wrong: ['Onça', 'Cavalo', 'Anta'] },
  { category: 'folclore', text: 'O Mapinguari é um monstro de qual região?', answer: 'Amazônia', wrong: ['Pampa', 'Sertão', 'Pantanal'] },
  { category: 'folclore', text: 'Onde aparece a Loira do Banheiro, segundo a lenda?', answer: 'Nas escolas', wrong: ['Nos hospitais', 'Nos cemitérios', 'Nos shoppings'] },
  { category: 'folclore', text: 'Em que data se comemora o Dia do Saci?', answer: '31 de outubro', wrong: ['22 de agosto', '2 de novembro', '1º de abril'] },
  { category: 'folclore', text: 'Qual é o Dia do Folclore no Brasil?', answer: '22 de agosto', wrong: ['31 de outubro', '12 de outubro', '2 de novembro'] },
  { category: 'folclore', text: 'A lenda do Negrinho do Pastoreio é de qual estado?', answer: 'Rio Grande do Sul', wrong: ['Bahia', 'Minas Gerais', 'Pará'] },
  { category: 'folclore', text: 'O Corpo-Seco foi tão malvado que nem a ___ quis o seu corpo.', answer: 'Terra', wrong: ['Água', 'Lua', 'Floresta'] },

  // --- 🎃 Halloween e superstições ---------------------------------------------
  { category: 'halloween', text: 'O Halloween nasceu de qual festival celta?', answer: 'Samhain', wrong: ['Beltane', 'Yule', 'Carnaval'] },
  { category: 'halloween', text: "“Halloween” vem de “All Hallows' Eve”, que quer dizer…", answer: 'Véspera de Todos os Santos', wrong: ['Noite dos Mortos-Vivos', 'Festa da Abóbora', 'Dia dos Doces'] },
  { category: 'halloween', text: 'Qual feriado brasileiro cai em 2 de novembro?', answer: 'Finados', wrong: ['Tiradentes', 'Consciência Negra', 'Corpus Christi'] },
  { category: 'halloween', text: 'Antes das abóboras, que legume se esculpia como lanterna?', answer: 'Nabo', wrong: ['Pepino', 'Chuchu', 'Berinjela'] },
  { category: 'halloween', text: 'Como se chama a abóbora-lanterna do Halloween?', answer: "Jack-o'-lantern", wrong: ['Jack-in-the-box', 'Pumpkin Pie', 'Jack Frost'] },
  { category: 'halloween', text: 'Em inglês, como as crianças pedem doces no Halloween?', answer: 'Trick or treat!', wrong: ['Boo!', 'Knock knock!', 'Merry Christmas!'] },
  { category: 'halloween', text: 'Imigrantes de qual país levaram o Halloween aos EUA no século 19?', answer: 'Irlanda', wrong: ['Itália', 'Alemanha', 'Rússia'] },
  { category: 'halloween', text: 'O Día de los Muertos é uma tradição famosa de qual país?', answer: 'México', wrong: ['Canadá', 'Itália', 'Japão'] },
  { category: 'halloween', text: 'No Día de los Muertos, o que se pinta no rosto?', answer: 'Uma caveira', wrong: ['Uma abóbora', 'Um morcego', 'Uma aranha'] },
  { category: 'halloween', text: 'Que flor enfeita os altares do Día de los Muertos?', answer: 'Cravo-de-defunto', wrong: ['Girassol', 'Orquídea', 'Tulipa'] },
  { category: 'halloween', text: 'Segundo a superstição, que bicho dá azar se cruzar seu caminho?', answer: 'Gato preto', wrong: ['Cavalo branco', 'Coelho', 'Pato'] },
  { category: 'halloween', text: 'Que fruta se pesca com a boca numa bacia d’água no Halloween?', answer: 'Maçã', wrong: ['Laranja', 'Banana', 'Uva'] },
  { category: 'halloween', text: 'Junto com o preto, qual é a cor clássica do Halloween?', answer: 'Laranja', wrong: ['Rosa', 'Azul', 'Branco'] },
  { category: 'halloween', text: 'Nas histórias, a bruxa voa montada em quê?', answer: 'Vassoura', wrong: ['Tapete', 'Dragão', 'Nuvem'] },
  { category: 'halloween', text: 'Como se chama o medo de palhaços?', answer: 'Coulrofobia', wrong: ['Aracnofobia', 'Claustrofobia', 'Necrofobia'] },
  { category: 'halloween', text: 'Qual é o nome do Halloween no Brasil?', answer: 'Dia das Bruxas', wrong: ['Dia dos Fantasmas', 'Noite do Saci', 'Dia dos Monstros'] },
  { category: 'halloween', text: 'Em que dia é o Halloween?', answer: '31 de outubro', wrong: ['1º de novembro', '13 de outubro', '30 de outubro'] },
  { category: 'halloween', text: 'Que cidade americana ficou famosa pelos julgamentos de bruxas de 1692?', answer: 'Salem', wrong: ['Boston', 'Nova York', 'Filadélfia'] },
  { category: 'halloween', text: 'Que ferramenta carrega a Morte, de capa preta?', answer: 'Foice', wrong: ['Machado', 'Tridente', 'Martelo'] },
  { category: 'halloween', text: 'Qual fantasia clássica de Halloween se faz com um lençol?', answer: 'Fantasma', wrong: ['Múmia', 'Bruxa', 'Vampiro'] },
  { category: 'halloween', text: 'Quebrar um espelho dá quantos anos de azar, segundo a superstição?', answer: '7', wrong: ['1', '3', '13'] },
  { category: 'halloween', text: 'Segundo a superstição, o que dá azar abrir dentro de casa?', answer: 'Guarda-chuva', wrong: ['Geladeira', 'Livro', 'Caixa de presente'] },
  { category: 'halloween', text: 'Segundo a superstição, passar embaixo de quê dá azar?', answer: 'Escada', wrong: ['Ponte', 'Mesa', 'Árvore'] },
  { category: 'halloween', text: 'Quantas patas tem uma aranha?', answer: '8', wrong: ['6', '10', '12'] },
  { category: 'halloween', text: 'Em que continente vivem os morcegos-vampiros?', answer: 'América', wrong: ['Europa', 'África', 'Ásia'] },
]
