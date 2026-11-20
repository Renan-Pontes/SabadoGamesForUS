/**
 * Os lugares do "Espião de Natal": o Natal brasileiro de verdade — ceia na
 * casa da vó, amigo secreto da firma, shopping lotado, praia no calor — e um
 * pouco do Natal de filme (Polo Norte, fábrica do Papai Noel, trenó). Cada um
 * tem ícone, 8+ papéis (quem sabe o lugar recebe um deles) e apelidos aceitos
 * no chute digitado do espião.
 *
 * Regras do conteúdo:
 * - nome curto (cabe em duas linhas no celular) e papéis que rendem
 *   perguntas engraçadas ("o que você trouxe pra ceia?");
 * - apelido nunca pode bater com outro lugar — o teste confere, porque chute
 *   que acerta dois lugares de uma vez não vale (senão o espião digitaria a
 *   lista inteira);
 * - nada de apelido curtinho que vira palavra comum com uma letra errada;
 * - "natal" sozinho não é apelido de ninguém (é de todo mundo!).
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
    name: 'Ceia na Casa da Vó',
    icon: '🍗',
    aliases: ['ceia', 'ceia de natal', 'casa da vó', 'ceia natalina'],
    roles: ['Vó que obriga a repetir o prato', 'Tio do pavê', 'Prima que chegou atrasada', 'Cunhado que só come o peru', 'Criança esperando o Papai Noel', 'Tia que pergunta do namoro', 'Avô dormindo no sofá', 'Quem trouxe só refrigerante', 'Cachorro embaixo da mesa'],
  },
  {
    name: 'Amigo Secreto da Firma',
    icon: '🎁',
    aliases: ['amigo secreto', 'amigo oculto', 'sorteio do amigo secreto'],
    roles: ['Quem tirou o chefe', 'Quem deu meia de presente', 'Estagiário que gastou demais', 'RH organizando tudo', 'Quem esqueceu o presente', 'Chefe com discurso pronto', 'Quem já sabe quem tirou', 'Quem só dá chocolate', 'Copeira'],
  },
  {
    name: 'Fábrica do Papai Noel',
    icon: '🏭',
    aliases: ['oficina do papai noel', 'oficina dos duendes', 'fábrica de presentes'],
    roles: ['Duende do controle de qualidade', 'Duende em greve', 'Papai Noel', 'Mamãe Noel', 'Rena estagiária', 'Gerente de logística', 'Pintor de soldadinho', 'Testador de brinquedos', 'Fiscal do trabalho'],
  },
  {
    name: 'Shopping Lotado',
    icon: '🛍️',
    aliases: ['shopping', 'shopping center', 'centro comercial', 'shopping na véspera'],
    roles: ['Papai Noel do shopping', 'Criança chorando na foto', 'Segurança', 'Vendedora exausta', 'Quem compra tudo na última hora', 'Embrulhador de presentes', 'Quem procura vaga há uma hora', 'Mãe com doze sacolas'],
  },
  {
    name: 'Missa do Galo',
    icon: '⛪',
    aliases: ['missa', 'igreja', 'missa de natal', 'missa da meia-noite'],
    roles: ['Padre', 'Coroinha', 'Coral desafinado', 'Beata da primeira fila', 'Quem dormiu no sermão', 'Sacristão', 'Quem só pensa na ceia', 'Tia que canta mais alto'],
  },
  {
    name: 'Presépio Vivo',
    icon: '🐑',
    aliases: ['presépio', 'manjedoura', 'presépio de natal'],
    roles: ['Menino Jesus de plástico', 'Maria', 'José', 'Rei Mago atrasado', 'Pastor', 'Ovelha que fugiu', 'Burrinho', 'Anjo pendurado no arame', 'Diretor da peça'],
  },
  {
    name: 'Agência dos Correios',
    icon: '📮',
    aliases: ['correios', 'correio', 'correio do noel'],
    roles: ['Carteiro', 'Atendente do guichê', 'Quem manda carta pro Noel', 'Quem adota uma cartinha', 'Idosa com a senha 347', 'Quem esqueceu o CEP', 'Motoboy das encomendas', 'Criança com carta de 3 páginas'],
  },
  {
    name: 'Pista de Patinação',
    icon: '⛸️',
    aliases: ['patinação', 'pista de gelo', 'rinque', 'patinação no gelo'],
    roles: ['Instrutor', 'Quem só se segura na borda', 'Criança que patina melhor', 'Casal fazendo pose', 'Quem caiu de bunda', 'Operador da máquina de gelo', 'Vendedor de chocolate quente', 'Fotógrafo'],
  },
  {
    name: 'Polo Norte',
    icon: '🐻‍❄️',
    aliases: ['polo', 'ártico', 'círculo polar'],
    roles: ['Urso-polar', 'Pinguim que errou de polo', 'Explorador congelado', 'Esquimó', 'Rena de folga', 'Cientista do clima', 'Turista de bermuda', 'Boneco de neve'],
  },
  {
    name: 'Trenó em Pane',
    icon: '🛷',
    aliases: ['trenó', 'trenó quebrado', 'trenó voador', 'trenó do noel'],
    roles: ['Rena de nariz queimado', 'Papai Noel sem GPS', 'Mecânico de trenó', 'Rena com preguiça', 'Duende copiloto', 'Controlador de voo', 'Presente que caiu no caminho', 'Piloto de avião assustado'],
  },
  {
    name: 'Loja de Panetone',
    icon: '🍞',
    aliases: ['panetone', 'padaria', 'chocotone'],
    roles: ['Padeiro', 'Quem tira as frutas cristalizadas', 'Fã de chocotone', 'Caixa', 'Moça da degustação', 'Cliente indeciso', 'Confeiteira', 'Quem compra dez pra dar a todos'],
  },
  {
    name: 'Festa da Firma',
    icon: '🥂',
    aliases: ['confraternização', 'festa da empresa', 'confra', 'festa de fim de ano'],
    roles: ['Chefe no karaokê', 'Estagiário que bebeu demais', 'Quem dança em cima da mesa', 'Garçom', 'RH preocupado', 'Quem só foi pela comida', 'DJ contratado', 'Quem posta tudo no story'],
  },
  {
    name: 'Natal na Praia',
    icon: '🏖️',
    aliases: ['praia', 'praia no natal', 'beira-mar', 'litoral'],
    roles: ['Papai Noel suando', 'Salva-vidas', 'Vendedor de milho', 'Turista vermelho de sol', 'Quem leva a ceia na marmita', 'Surfista de gorro', 'Vendedor de picolé', 'Criança fazendo boneco de areia'],
  },
  {
    name: 'Árvore de Natal da Praça',
    icon: '🎄',
    aliases: ['árvore de natal', 'árvore da praça', 'praça', 'árvore gigante'],
    roles: ['Prefeito na inauguração', 'Eletricista do pisca-pisca', 'Criança contando as luzes', 'Vendedor de pipoca', 'Coral da prefeitura', 'Casal tirando selfie', 'Guarda municipal', 'Pombo em cima da estrela'],
  },
  {
    name: 'Réveillon em Copacabana',
    icon: '🎆',
    aliases: ['réveillon', 'virada', 'ano novo', 'copacabana', 'virada do ano'],
    roles: ['Quem pula sete ondas', 'Vendedor de espumante', 'Quem veste branco', 'Turista gringo', 'Bombeiro', 'Quem perdeu a turma', 'Cantor do palco', 'Quem come lentilha'],
  },
  {
    name: 'Casa do Pisca-Pisca',
    icon: '💡',
    aliases: ['pisca-pisca', 'casa enfeitada', 'casa iluminada'],
    roles: ['Vizinho exibido', 'Eletricista desesperado', 'Conta de luz', 'Vizinha invejosa', 'Papai Noel inflável', 'Turista do bairro', 'Criança encantada', 'Fiscal da companhia elétrica'],
  },
  {
    name: 'Açougue na Véspera',
    icon: '🦃',
    aliases: ['açougue', 'fila do peru', 'casa de carnes'],
    roles: ['Açougueiro', 'Quem esqueceu de encomendar o peru', 'Senhora com a senha 99', 'Quem só quer chester', 'Caixa', 'Vegetariano perdido', 'Quem pede pra cortar fininho', 'Gerente'],
  },
  {
    name: 'Supermercado na Véspera',
    icon: '🛒',
    aliases: ['supermercado', 'mercado', 'hipermercado', 'mercadinho'],
    roles: ['Operador de caixa', 'Repositor', 'Quem briga pelo último tender', 'Gerente', 'Moça da degustação de vinho', 'Quem esqueceu a uva-passa', 'Segurança', 'Carrinho de roda torta'],
  },
  {
    name: 'Aeroporto no Feriado',
    icon: '✈️',
    aliases: ['aeroporto', 'avião', 'saguão do aeroporto', 'portão de embarque'],
    roles: ['Piloto', 'Comissária de gorro', 'Quem perdeu o voo', 'Família com dez malas', 'Fiscal da alfândega', 'Quem dorme no chão', 'Atendente do check-in', 'Vó que veio buscar o neto'],
  },
  {
    name: 'Rodoviária Lotada',
    icon: '🚌',
    aliases: ['rodoviária', 'ônibus', 'busão', 'terminal rodoviário'],
    roles: ['Motorista', 'Vendedor de passagem', 'Quem leva o peru no colo', 'Estudante voltando pra casa', 'Vendedor de pastel', 'Senhora cheia de sacolas', 'Fiscal', 'Quem perdeu o ônibus'],
  },
  {
    name: 'Engarrafamento na Estrada',
    icon: '🚗',
    aliases: ['engarrafamento', 'trânsito', 'estrada', 'congestionamento'],
    roles: ['Motorista impaciente', 'Criança perguntando se falta muito', 'Vendedor de biscoito', 'Cachorro com a cabeça pra fora', 'Policial rodoviário', 'Motorista do guincho', 'Quem precisa ir ao banheiro', 'Sogra no banco de trás'],
  },
  {
    name: 'Natal Luz de Gramado',
    icon: '🏔️',
    aliases: ['gramado', 'natal luz', 'serra gaúcha'],
    roles: ['Turista de casaco novo', 'Chocolateiro', 'Ator do desfile', 'Quem reclama do preço', 'Garçom do fondue', 'Guia de turismo', 'Criança com frio', 'Quem fotografa tudo'],
  },
  {
    name: 'Apresentação da Escola',
    icon: '🏫',
    aliases: ['escola', 'colégio', 'teatrinho da escola', 'auto de natal'],
    roles: ['Criança vestida de estrela', 'Professora regente', 'Pai filmando de pé', 'Avó chorando', 'Criança que esqueceu a fala', 'Diretora', 'Criança vestida de árvore', 'Pianista'],
  },
  {
    name: 'Casa da Sogra',
    icon: '👵',
    aliases: ['sogra', 'natal na sogra'],
    roles: ['Sogra', 'Genro que só elogia', 'Nora tensa', 'Cunhado folgado', 'Sogro no sofá', 'Neto mimado', 'Cachorro da sogra', 'Quem trouxe a sobremesa errada'],
  },
  {
    name: 'Loja de Brinquedos',
    icon: '🧸',
    aliases: ['brinquedos', 'loja de brinquedo', 'brinquedoteca'],
    roles: ['Vendedor vestido de duende', 'Pai caçando o boneco esgotado', 'Criança fazendo birra', 'Gerente', 'Avó perdida', 'Repositor', 'Quem testa todos os brinquedos', 'Segurança'],
  },
  {
    name: 'Sessão de Filme de Natal',
    icon: '🍿',
    aliases: ['cinema', 'sala de cinema', 'filme de natal'],
    roles: ['Pipoqueiro', 'Quem chora em todo filme', 'Criança que chuta a poltrona', 'Casal que não para de falar', 'Quem dorme no filme', 'Projecionista', 'Crítico de cinema', 'Fã do Esqueceram de Mim'],
  },
  {
    name: 'Hospital de Plantão',
    icon: '🏥',
    aliases: ['hospital', 'pronto-socorro', 'plantão', 'emergência'],
    roles: ['Médica de plantão', 'Enfermeiro de gorro', 'Quem engoliu caroço de azeitona', 'Quem queimou a mão no forno', 'Recepcionista', 'Tio que exagerou na ceia', 'Palhaço voluntário', 'Faxineiro'],
  },
  {
    name: 'Delegacia',
    icon: '🚔',
    aliases: ['distrito policial', 'polícia', 'cadeia', 'prisão'],
    roles: ['Delegado', 'Escrivão', 'Ladrão de enfeite de jardim', 'Papai Noel detido', 'Vizinha denunciando barulho', 'Advogado', 'Policial de gorro', 'Testemunha confusa'],
  },
  {
    name: 'Chaminé da Casa',
    icon: '🏠',
    aliases: ['chaminé', 'telhado', 'lareira'],
    roles: ['Papai Noel entalado', 'Gato no telhado', 'Rena estacionada', 'Bombeiro', 'Criança acordada espiando', 'Vizinho filmando', 'Ladrão confuso', 'Pai fingindo ser o Noel'],
  },
  {
    name: 'Especial do Roberto Carlos',
    icon: '🎤',
    aliases: ['especial de fim de ano', 'show do rei', 'especial de natal', 'roberto carlos'],
    roles: ['O Rei', 'Fã da primeira fila', 'Câmera', 'Maestro', 'Tia que assiste todo ano', 'Backing vocal', 'Produtor', 'Quem joga rosas no palco'],
  },
  {
    name: 'Caravana de Natal',
    icon: '🚚',
    aliases: ['caravana', 'caminhão iluminado', 'caravana iluminada'],
    roles: ['Motorista do caminhão', 'Criança na calçada', 'Papai Noel acenando', 'Vendedor ambulante', 'Guarda de trânsito', 'Quem filma em pé no carro', 'Duende dançarino', 'Policial da escolta'],
  },
  {
    name: 'Feira de Natal',
    icon: '🎪',
    aliases: ['feira', 'feirinha', 'feira de artesanato'],
    roles: ['Artesã', 'Vendedor de guirlanda', 'Quem pechincha tudo', 'Músico de rua', 'Vendedora de vela perfumada', 'Quem só prova as amostras', 'Organizador', 'Criança no carrossel'],
  },
  {
    name: 'Loja de Enfeites',
    icon: '🎀',
    aliases: ['enfeites', 'lojinha de enfeites', 'loja de decoração'],
    roles: ['Vendedora', 'Quem compra pisca-pisca quebrado', 'Quem leva 200 bolinhas', 'Dono da loja', 'Criança que quebrou a bolinha', 'Decoradora profissional', 'Caixa', 'Quem só olha'],
  },
  {
    name: 'Churrasco no Quintal',
    icon: '🍖',
    aliases: ['churrasco', 'churras', 'quintal', 'churrasqueira'],
    roles: ['Churrasqueiro', 'Quem só come pão de alho', 'Cachorro esperando osso', 'Vizinho penetra', 'Quem trouxe o gelo', 'Prima vegana', 'Cunhado que não ajuda', 'Tio de sunga e gorro'],
  },
  {
    name: 'Fazenda de Pinheiros',
    icon: '🌲',
    aliases: ['pinheiral', 'floresta de pinheiros', 'floresta', 'pinheiros'],
    roles: ['Lenhador', 'Família escolhendo a árvore', 'Esquilo', 'Guarda-florestal', 'Criança que quer a maior árvore', 'Vendedor', 'Coruja', 'Pai carregando a árvore'],
  },
  {
    name: 'Estábulo das Renas',
    icon: '🦌',
    aliases: ['renas', 'curral das renas', 'casa das renas'],
    roles: ['Rena do nariz vermelho', 'Rena que não voa', 'Veterinária', 'Tratador', 'Duende que limpa o chão', 'Rena fofoqueira', 'Treinador de voo', 'Papai Noel escalando o time'],
  },
  {
    name: 'Hospedaria de Belém',
    icon: '🌟',
    aliases: ['hospedaria', 'belém', 'estalagem', 'pousada'],
    roles: ['Dono sem quarto vago', 'Viajante cansado', 'Mago pedindo informação', 'Recenseador romano', 'Cozinheira', 'Burrinho no estacionamento', 'Pastor de passagem', 'Hóspede reclamão'],
  },
  {
    name: 'Fábrica de Chocolate',
    icon: '🍫',
    aliases: ['chocolate', 'chocolateria', 'loja de chocolate'],
    roles: ['Mestre chocolateiro', 'Provador oficial', 'Operário da esteira', 'Criança da excursão', 'Embaladora de bombom', 'Fiscal da qualidade', 'Quem come escondido', 'Dono da fábrica'],
  },
  {
    name: 'Abertura dos Presentes',
    icon: '🎉',
    aliases: ['hora dos presentes', 'embaixo da árvore', 'abrindo presentes'],
    roles: ['Criança que acordou às 5h', 'Quem ganhou meia de novo', 'Tia que guarda o papel', 'Quem finge que gostou', 'Pai montando o brinquedo', 'Gato dentro da caixa', 'Quem lê o cartão em voz alta', 'Tio fantasiado de Noel'],
  },
  {
    name: 'Cruzeiro de Fim de Ano',
    icon: '🛳️',
    aliases: ['cruzeiro', 'navio', 'transatlântico'],
    roles: ['Capitão', 'Animador da piscina', 'Quem enjoou', 'Garçom do bufê', 'Casal em lua de mel', 'Cantor do bar', 'Turista de pochete', 'Salva-vidas do navio'],
  },
  {
    name: 'Lotérica da Virada',
    icon: '🍀',
    aliases: ['lotérica', 'mega da virada', 'casa lotérica'],
    roles: ['Atendente', 'Quem joga a data de aniversário', 'Organizador do bolão', 'Aposentado otimista', 'Quem já planeja a mansão', 'Segurança', 'Quem perdeu o bilhete', 'Dono da lotérica'],
  },
  {
    name: 'Expresso Polar',
    icon: '🚂',
    aliases: ['trem', 'trem de natal', 'maria-fumaça', 'estação de trem'],
    roles: ['Maquinista', 'Cobrador do bilhete dourado', 'Criança de pijama', 'Garçom do chocolate quente', 'Passageiro dormindo', 'Vendedor de pipoca', 'Duende clandestino', 'Ursinho de pelúcia'],
  },
  {
    name: 'Casinha de Biscoito',
    icon: '🍪',
    aliases: ['casa de gengibre', 'casinha de gengibre', 'biscoito de gengibre'],
    roles: ['Biscoito de gengibre fugitivo', 'Confeiteira', 'Criança lambendo a cobertura', 'Fiscal da vigilância sanitária', 'Quem come o telhado', 'Formiga', 'Avó de avental', 'Jurado do concurso'],
  },
  {
    name: 'Salão de Beleza',
    icon: '💇',
    aliases: ['salão', 'cabeleireiro', 'barbearia', 'salão de cabeleireiro'],
    roles: ['Cabeleireira sem horário', 'Quem quer ficar igual à foto', 'Manicure', 'Quem marcou escova pra ceia', 'Barbeiro', 'Recepcionista', 'Cliente fofoqueira', 'Quem chegou sem hora marcada'],
  },
  {
    name: 'Motociata dos Noéis',
    icon: '🏍️',
    aliases: ['motociata', 'passeio de moto', 'noéis de moto'],
    roles: ['Noel motoqueiro', 'Noel de patinete', 'Guarda de trânsito', 'Criança acenando', 'Mecânico', 'Noel sem capacete', 'Fotógrafo do jornal', 'Vizinho reclamando do barulho'],
  },
  {
    name: 'Fila da Troca',
    icon: '🔁',
    aliases: ['troca de presente', 'troca de presentes', 'devolução de presente'],
    roles: ['Quem ganhou suéter feio', 'Atendente sem paciência', 'Quem perdeu a nota fiscal', 'Gerente', 'Quem trocou por algo pior', 'Segurança', 'Quem quer o dinheiro de volta', 'Tia que veio junto'],
  },
]
