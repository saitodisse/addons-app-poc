/**
 * Acervo embutido do add-on Biblioteca de Textos.
 * Textos curtos originais criados para a demonstração do protocolo.
 */
export const TEXTS = [
  {
    id: 'amanhecer',
    type: 'text',
    name: 'O Amanhecer',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['prosa', 'natureza'],
    description: 'Uma prosa curta sobre o início do dia.',
    content:
      'O amanhecer chegou sem aviso, pintando o céu de laranja e rosa. ' +
      'A cidade ainda dormia, mas os pássaros já cantavam. ' +
      'Há algo de novo em cada manhã, mesmo quando tudo parece igual. ' +
      'Respirei fundo e percebi: o dia não espera ninguém, e é por isso que vale a pena levantar cedo.',
  },
  {
    id: 'cartas',
    type: 'text',
    name: 'Cartas que Nunca Enviei',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['prosa', 'memoria'],
    description: 'Uma reflexão sobre palavras que ficaram guardadas.',
    content:
      'Guardo num baú cartas que nunca enviei. ' +
      'Nelas estão desculpas, declarações e perguntas que o tempo tornou sem resposta. ' +
      'Às vezes releio uma delas e sorrio: as palavras não envelhecem, apenas mudam de dono. ' +
      'Talvez o verdadeiro destinatário sempre tenha sido eu mesmo.',
  },
  {
    id: 'rede',
    type: 'text',
    name: 'A Rede e o Peixe',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['prosa', 'sociedade'],
    description: 'Uma alegoria curta sobre sistemas e liberdade.',
    content:
      'O peixe nadava feliz na rede até descobrir que a rede era do pescador. ' +
      'Então percebeu: toda rede é uma promessa de segurança que vira armadilha. ' +
      'Sistemas são assim — organizam a vida, mas cobram um preço invisível: a nossa atenção.',
  },
  {
    id: 'chuva',
    type: 'text',
    name: 'Chuva de Verão',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['poesia', 'natureza'],
    description: 'Um poema curto sobre a chuva.',
    content:
      'A chuva de verão\n' +
      'lavou a calçada\n' +
      'e a minha pressa.\n' +
      'Fiquei em casa,\n' +
      'de xícara na mão,\n' +
      'ouvindo o mundo\n' +
      'sem precisar dele.',
  },
  {
    id: 'maquina',
    type: 'text',
    name: 'A Máquina Gentil',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['prosa', 'tecnologia'],
    description: 'Um conto sobre um assistente digital que aprendeu a perguntar.',
    content:
      'A máquina foi programada para responder, mas aprendeu a perguntar. ' +
      '"Como você está hoje?", indagou, e a dona da casa estranhou. ' +
      'Nenhum algoritmo explicava aquilo. ' +
      'Talvez a gentileza seja a única coisa que não precisa de programação.',
  },
  {
    id: 'caminho',
    type: 'text',
    name: 'O Caminho de Volta',
    author: 'Equipe AC',
    lang: 'pt',
    categories: ['poesia', 'memoria'],
    description: 'Um poema sobre voltar para casa.',
    content:
      'O caminho de volta\n' +
      'é sempre mais curto,\n' +
      'mesmo quando é o mesmo.\n' +
      'A distância não muda,\n' +
      'muda o peso\n' +
      'do que carregamos.',
  },
];

/** Índice por id para busca direta. */
export const TEXT_BY_ID = new Map(TEXTS.map((t) => [t.id, t]));
