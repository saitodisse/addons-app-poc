import { defineAddonManifest } from '@addons-poc/protocol';

/**
 * Manifesto do add-on Wikipédia, formato estilo Stremio.
 *
 * As schemas são deliberadamente detalhadas: o contrato mostra os campos que
 * viajam para a API externa e os campos que o add-on lê de cada resposta.
 */
const stringSchema = (description, classification = 'public', format) => ({
  type: 'string',
  description,
  classification,
  ...(format ? { format } : {}),
});

const integerSchema = (description, classification = 'public') => ({
  type: 'integer',
  description,
  classification,
});

const booleanSchema = (description, classification = 'public') => ({
  type: 'boolean',
  description,
  classification,
});

const objectSchema = (description, classification, properties, required = []) => ({
  type: 'object',
  description,
  classification,
  properties,
  ...(required.length ? { required } : {}),
});

const arraySchema = (description, classification, items) => ({
  type: 'array',
  description,
  classification,
  items,
});

const payload = (description, schema) => ({ description, schema });

const requestHeadersSchema = objectSchema('Cabeçalhos HTTP enviados pelo cliente do add-on.', 'public', {
  'User-Agent': stringSchema('Identifica este projeto perante a Wikipédia.'),
  Accept: stringSchema('Formato de resposta solicitado.'),
}, ['User-Agent', 'Accept']);

const searchRequestSchema = objectSchema('Requisição GET integral enviada para a API MediaWiki.', 'personal', {
  method: { type: 'string', description: 'Método HTTP efetivamente usado.', classification: 'public', enum: ['GET'] },
  url: stringSchema('URL final, incluindo todos os parâmetros já codificados.', 'personal', 'uri'),
  path: stringSchema('Caminho HTTP enviado à API.', 'public'),
  queryString: stringSchema('Query string enviada sem alterações.', 'personal'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'Esta API é consultada sem corpo HTTP.', classification: 'public' },
  query: objectSchema('Parâmetros semânticos enviados na URL.', 'personal', {
    action: stringSchema('Ação MediaWiki executada.'),
    list: stringSchema('Lista consultada.', 'public'),
    srsearch: stringSchema('Termo digitado para a busca.', 'personal'),
    srnamespace: stringSchema('Namespace pesquisado como valor textual; 0 representa artigos.'),
    srlimit: stringSchema('Quantidade solicitada nesta página, como aparece na URL.'),
    sroffset: stringSchema('Deslocamento usado para a página atual, como aparece na URL.'),
    srinfo: stringSchema('Informação adicional solicitada sobre o total.'),
    srprop: stringSchema('Campos adicionais solicitados para cada resultado.'),
    format: stringSchema('Formato da resposta.', 'public'),
    origin: stringSchema('Parâmetro de CORS da API.', 'public'),
  }, ['action', 'list', 'srsearch', 'srnamespace', 'srlimit', 'sroffset', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const extractsRequestSchema = objectSchema('Requisição GET integral usada para completar os extratos.', 'public', {
  method: { type: 'string', description: 'Método HTTP efetivamente usado.', classification: 'public', enum: ['GET'] },
  url: stringSchema('URL final com o lote de títulos codificado.', 'public', 'uri'),
  path: stringSchema('Caminho HTTP enviado à API.', 'public'),
  queryString: stringSchema('Query string enviada sem alterações.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'Esta API é consultada sem corpo HTTP.', classification: 'public' },
  query: objectSchema('Parâmetros do lote de extratos.', 'public', {
    action: stringSchema('Ação MediaWiki executada.'),
    titles: stringSchema('Títulos públicos separados por |.'),
    prop: stringSchema('Propriedade solicitada.'),
    exlimit: stringSchema('Limite de páginas do lote, como aparece na URL.'),
    explaintext: stringSchema('Solicita texto sem HTML.'),
    exintro: stringSchema('Solicita somente a introdução.'),
    redirects: stringSchema('Permite seguir redirecionamentos.'),
    format: stringSchema('Formato da resposta.'),
    origin: stringSchema('Parâmetro de CORS da API.'),
  }, ['action', 'titles', 'prop', 'exlimit', 'explaintext', 'exintro', 'redirects', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const randomRequestSchema = objectSchema('Requisição GET integral de títulos aleatórios.', 'public', {
  method: { type: 'string', description: 'Método HTTP efetivamente usado.', classification: 'public', enum: ['GET'] },
  url: stringSchema('URL final, incluindo rncontinue quando houver paginação.', 'public', 'uri'),
  path: stringSchema('Caminho HTTP enviado à API.', 'public'),
  queryString: stringSchema('Query string enviada sem alterações.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'Esta API é consultada sem corpo HTTP.', classification: 'public' },
  query: objectSchema('Parâmetros da consulta aleatória.', 'public', {
    action: stringSchema('Ação MediaWiki executada.'),
    list: stringSchema('Lista consultada.'),
    rnnamespace: stringSchema('Namespace consultado, como aparece na URL.'),
    rnlimit: stringSchema('Quantidade solicitada, como aparece na URL.'),
    rncontinue: stringSchema('Cursor opaco recebido da página anterior.'),
    format: stringSchema('Formato da resposta.'),
    origin: stringSchema('Parâmetro de CORS da API.'),
  }, ['action', 'list', 'rnnamespace', 'rnlimit', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const summaryRequestSchema = objectSchema('Requisição GET integral para o resumo de um artigo.', 'personal', {
  method: { type: 'string', description: 'Método HTTP efetivamente usado.', classification: 'public', enum: ['GET'] },
  url: stringSchema('URL final com o título codificado no caminho.', 'personal', 'uri'),
  path: stringSchema('Caminho HTTP enviado à API.', 'public'),
  queryString: stringSchema('Query string enviada sem alterações; vazia neste endpoint.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'Esta API é consultada sem corpo HTTP.', classification: 'public' },
  query: objectSchema('Parâmetros enviados na URL; este endpoint não envia parâmetros de query.', 'public', {}),
  pathParameters: objectSchema('Parâmetros do caminho REST.', 'personal', {
    title: stringSchema('Título solicitado ao endpoint de resumo.', 'personal'),
  }, ['title']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query', 'pathParameters']);

const searchMetaSchema = objectSchema('Um item de resultado normalizado pelo add-on.', 'public', {
  id: stringSchema('Título usado como identificador.'),
  type: stringSchema('Tipo fixo page.'),
  name: stringSchema('Título exibido.'),
  description: stringSchema('Título e extrato introdutório, quando disponível.'),
});

const paginationSchema = objectSchema('Continuação da listagem.', 'public', {
  limit: integerSchema('Quantidade efetiva da página.'),
  total: integerSchema('Total conhecido, limitado a 500.'),
  next: stringSchema('Deslocamento da próxima página.'),
}, ['limit']);

const incomingRequestSchema = (description, properties, required) => payload(
  description,
  objectSchema(description, 'personal', properties, required),
);

const incomingSearchRequest = incomingRequestSchema('Parâmetros que o host envia ao add-on para buscar artigos.', {
  type: stringSchema('Tipo solicitado pelo host.'),
  query: stringSchema('Termo digitado pela pessoa.', 'personal'),
  limit: integerSchema('Máximo solicitado para esta página.'),
  cursor: stringSchema('Cursor opaco recebido da página anterior.', 'personal'),
}, ['type', 'query']);

const incomingCatalogRequest = incomingRequestSchema('Parâmetros que o host envia ao add-on para obter artigos aleatórios.', {
  type: stringSchema('Tipo solicitado pelo host.'),
  catalogId: stringSchema('Identificador do catálogo.'),
  limit: integerSchema('Máximo solicitado para esta página.'),
  cursor: stringSchema('Cursor opaco recebido da página anterior.'),
}, ['type', 'catalogId']);

const incomingTextRequest = incomingRequestSchema('Parâmetros que o host envia ao add-on para obter a opção de texto.', {
  type: stringSchema('Tipo solicitado pelo host.'),
  id: stringSchema('Identificador ou título do artigo.', 'personal'),
}, ['type', 'id']);

const incomingContentRequest = incomingRequestSchema('Parâmetros que o host envia ao add-on para obter o conteúdo textual.', {
  type: stringSchema('Tipo solicitado pelo host.'),
  id: stringSchema('Identificador ou título do artigo.', 'personal'),
}, ['type', 'id']);

const searchResponseSchema = objectSchema('Resposta integral da busca MediaWiki.', 'public', {
  batchcomplete: booleanSchema('Indica se a consulta foi concluída.'),
  continue: objectSchema('Cursor de continuação da API.', 'public', {
    sroffset: integerSchema('Próximo deslocamento.'),
    continue: stringSchema('Cursor interno da API.'),
  }),
  query: objectSchema('Resultados e total aproximado.', 'public', {
    searchinfo: objectSchema('Informações sobre o total.', 'public', {
      totalhits: integerSchema('Quantidade aproximada de resultados.'),
    }),
    search: arraySchema('Resultados brutos da busca.', 'public', objectSchema('Resultado bruto da Wikipédia.', 'public', {
      ns: integerSchema('Namespace do resultado.'),
      title: stringSchema('Título do resultado.'),
      pageid: integerSchema('ID numérico da página.'),
      size: integerSchema('Tamanho aproximado da página.'),
      wordcount: integerSchema('Quantidade aproximada de palavras.'),
      snippet: stringSchema('Trecho HTML devolvido pela API.'),
      timestamp: stringSchema('Data da última revisão.', 'public', 'date-time'),
    }, ['ns', 'title', 'pageid'])),
  }),
});

const extractsResponseSchema = objectSchema('Resposta integral da consulta de extratos.', 'public', {
  batchcomplete: booleanSchema('Indica se a consulta foi concluída.'),
  query: objectSchema('Mapa de páginas retornado pela API.', 'public', {
    pages: objectSchema('Chaves dinâmicas por pageid; cada valor contém título e extrato.', 'public', {
      pageid: integerSchema('ID numérico da página quando a chave é materializada.'),
      ns: integerSchema('Namespace da página.'),
      title: stringSchema('Título efetivo após redirecionamento.'),
      extract: stringSchema('Introdução em texto puro.'),
      missing: booleanSchema('Indica uma página ausente.'),
    }),
  }),
});

const randomResponseSchema = objectSchema('Resposta integral da consulta de páginas aleatórias.', 'public', {
  batchcomplete: booleanSchema('Indica se a consulta foi concluída.'),
  continue: objectSchema('Cursor de continuação da API.', 'public', {
    rncontinue: stringSchema('Cursor opaco para a próxima consulta.'),
    continue: stringSchema('Cursor interno da API.'),
  }),
  query: objectSchema('Lista de páginas aleatórias.', 'public', {
    random: arraySchema('Títulos retornados.', 'public', objectSchema('Página aleatória.', 'public', {
      id: integerSchema('ID numérico da página.'),
      ns: integerSchema('Namespace da página.'),
      title: stringSchema('Título público.'),
    }, ['id', 'ns', 'title'])),
  }),
});

const namespaceSchema = objectSchema('Namespace do artigo.', 'public', {
  id: integerSchema('ID do namespace.'),
  text: stringSchema('Nome do namespace.'),
});

const titlesSchema = objectSchema('Variações de título fornecidas pela Wikipédia.', 'public', {
  canonical: stringSchema('Título canônico.'),
  normalized: stringSchema('Título normalizado.'),
  display: stringSchema('Título pronto para exibição.'),
});

const contentUrlsSchema = objectSchema('Links públicos para o artigo.', 'public', {
  desktop: objectSchema('Links para a versão desktop.', 'public', {
    page: stringSchema('URL da página.', 'public', 'uri'),
    revisions: stringSchema('URL das revisões.', 'public', 'uri'),
    edit: stringSchema('URL de edição.', 'public', 'uri'),
    talk: stringSchema('URL da página de discussão.', 'public', 'uri'),
  }),
  mobile: objectSchema('Links para a versão móvel.', 'public', {
    page: stringSchema('URL da página.', 'public', 'uri'),
    revisions: stringSchema('URL das revisões.', 'public', 'uri'),
    edit: stringSchema('URL de edição.', 'public', 'uri'),
    talk: stringSchema('URL da página de discussão.', 'public', 'uri'),
  }),
});

const imageSchema = (description) => objectSchema(description, 'public', {
  source: stringSchema('URL da imagem.', 'public', 'uri'),
  width: integerSchema('Largura em pixels.'),
  height: integerSchema('Altura em pixels.'),
});

const summaryResponseSchema = objectSchema('Resposta integral do endpoint REST de resumo.', 'public', {
  type: stringSchema('Tipo da resposta REST.'),
  title: stringSchema('Título efetivo do artigo.'),
  displaytitle: stringSchema('Título formatado para apresentação.'),
  namespace: namespaceSchema,
  wikibase_item: stringSchema('ID Wikidata relacionado.'),
  pageid: integerSchema('ID numérico da página.'),
  lang: stringSchema('Idioma do artigo.'),
  dir: stringSchema('Direção do texto.'),
  revision: stringSchema('ID da revisão.'),
  tid: stringSchema('Identificador da resposta REST.'),
  timestamp: stringSchema('Data da revisão.', 'public', 'date-time'),
  description: stringSchema('Descrição curta do artigo.'),
  description_source: stringSchema('Origem da descrição curta.'),
  titles: titlesSchema,
  content_urls: contentUrlsSchema,
  extract: stringSchema('Resumo em texto puro.'),
  extract_html: stringSchema('Resumo em HTML.'),
  thumbnail: imageSchema('Miniatura, quando disponível.'),
  originalimage: imageSchema('Imagem original, quando disponível.'),
});

const contentJsonResponseSchema = objectSchema('Conteúdo estruturado com metadados e proveniência da coleta.', 'public', {
  id: stringSchema('Identificador efetivo do artigo.'),
  type: stringSchema('Tipo do recurso.'),
  title: stringSchema('Título efetivo do artigo.'),
  displaytitle: stringSchema('Título formatado para apresentação.'),
  description: stringSchema('Descrição curta do artigo.'),
  description_source: stringSchema('Origem da descrição curta.'),
  extract: stringSchema('Resumo em texto puro.'),
  extract_html: stringSchema('Resumo em HTML.'),
  pageid: integerSchema('ID numérico da página.'),
  wikibase_item: stringSchema('ID Wikidata relacionado.'),
  namespace: namespaceSchema,
  lang: stringSchema('Idioma do artigo.'),
  dir: stringSchema('Direção do texto.'),
  revision: stringSchema('ID da revisão.'),
  timestamp: stringSchema('Data da revisão.', 'public', 'date-time'),
  tid: stringSchema('Identificador da resposta REST.'),
  titles: titlesSchema,
  content_urls: contentUrlsSchema,
  thumbnail: imageSchema('Miniatura, quando disponível.'),
  originalimage: imageSchema('Imagem original, quando disponível.'),
  content: objectSchema('Conteúdo textual e suas métricas.', 'public', {
    text: stringSchema('Título seguido do extrato em texto puro.'),
    charCount: integerSchema('Quantidade de caracteres Unicode do conteúdo.'),
    wordCount: integerSchema('Quantidade de palavras separadas por espaços.'),
    contentType: stringSchema('Tipo MIME do conteúdo textual.'),
    encoding: stringSchema('Codificação do conteúdo textual.'),
  }, ['text', 'charCount', 'wordCount', 'contentType', 'encoding']),
  source: objectSchema('Fonte consultada e cabeçalhos recebidos da Wikipédia.', 'public', {
    name: stringSchema('Nome do endpoint consultado.'),
    provider: stringSchema('Provedor da informação.'),
    origin: stringSchema('Origem HTTP da fonte.', 'public', 'uri'),
    url: stringSchema('URL exata consultada.', 'public', 'uri'),
    headers: objectSchema('Cabeçalhos relevantes da resposta da fonte.', 'public', {
      ETag: stringSchema('ETag da resposta externa.'),
      'Last-Modified': stringSchema('Data de modificação da resposta externa.'),
      'Content-Language': stringSchema('Idioma informado pela fonte.'),
      'Content-Length': stringSchema('Tamanho em bytes da resposta externa.'),
    }, ['ETag', 'Last-Modified', 'Content-Language', 'Content-Length']),
    responseHeaders: objectSchema('Todos os cabeçalhos não sensíveis recebidos da fonte.', 'public', {}),
  }, ['provider', 'origin', 'url', 'headers']),
  observability: objectSchema('Identificadores e tempos da coleta.', 'public', {
    requestId: stringSchema('ID que correlaciona a requisição com o debug.'),
    durationMs: integerSchema('Duração da consulta em milissegundos.'),
    collectedAt: stringSchema('Horário em que a coleta foi concluída.', 'public', 'date-time'),
  }, ['requestId', 'durationMs', 'collectedAt']),
}, ['id', 'type', 'title', 'extract', 'content', 'source', 'observability']);

const trafficEntrySchema = objectSchema('Uma troca HTTP observada pelo servidor.', 'public', {
  sequence: integerSchema('Número sequencial no processo.'),
  recordedAt: stringSchema('Instante em que a entrada foi registrada.', 'public', 'date-time'),
  source: stringSchema('Componente que observou a troca.'),
  requestId: stringSchema('Identificador que correlaciona tentativa e resposta.'),
  direction: stringSchema('Direção em relação ao add-on.'),
  phase: stringSchema('Fase request ou response.'),
  operation: stringSchema('Operação da API externa.'),
  attempt: integerSchema('Número da tentativa, incluindo retries.'),
  method: stringSchema('Método HTTP.'),
  url: stringSchema('URL observada.', 'public', 'uri'),
  path: stringSchema('Rota local observada.'),
  request: objectSchema('Tudo que foi enviado na requisição.', 'public', {
    method: stringSchema('Método enviado.'),
    url: stringSchema('URL enviada.', 'public', 'uri'),
    path: stringSchema('Rota local.'),
    queryString: stringSchema('Query string sem alterações.'),
    query: objectSchema('Parâmetros separados.', 'personal', {}),
    headers: objectSchema('Cabeçalhos enviados.', 'public', {}),
    body: { type: 'null', description: 'Corpo enviado; as operações observadas atualmente são GET e não enviam payload.', classification: 'public' },
  }),
  status: integerSchema('Status HTTP retornado.'),
  ok: booleanSchema('Indica resposta HTTP bem-sucedida.'),
  response: objectSchema('Tudo que retornou na resposta.', 'public', {
    status: integerSchema('Status HTTP.'),
    ok: booleanSchema('Indica sucesso.'),
    headers: objectSchema('Cabeçalhos retornados.', 'public', {}),
    body: objectSchema('Corpo retornado, preservado integralmente.', 'public', {}),
    bodyText: stringSchema('Representação textual enviada no fio HTTP.'),
  }),
  retry: objectSchema('Retry agendado após uma falha transitória.', 'public', {
    scheduled: booleanSchema('Indica que haverá nova tentativa.'),
    delayMs: integerSchema('Atraso antes da nova tentativa.'),
  }),
  durationMs: integerSchema('Duração da operação em milissegundos.'),
  error: objectSchema('Erro local quando a resposta não pôde ser obtida.', 'public', {
    name: stringSchema('Tipo do erro.'),
    message: stringSchema('Mensagem do erro.'),
  }),
});

const trafficResponseSchema = objectSchema('Histórico local das últimas trocas HTTP.', 'public', {
  addon: stringSchema('Identificador do add-on.'),
  generatedAt: stringSchema('Instante em que o histórico foi lido.', 'public', 'date-time'),
  retainedEntries: integerSchema('Quantidade de entradas atualmente retidas.'),
  maxEntries: integerSchema('Limite de retenção do processo.'),
  entries: arraySchema('Eventos completos, sem truncar os corpos retidos.', 'public', trafficEntrySchema),
}, ['addon', 'generatedAt', 'retainedEntries', 'maxEntries', 'entries']);

const debugLogDetails = payload('Dados da observabilidade HTTP no console do servidor.', objectSchema('Detalhes completos da troca observada.', 'public', {
  requestId: stringSchema('Identificador da troca.'),
  operation: stringSchema('Operação executada.'),
  request: trafficEntrySchema.properties.request,
  response: trafficEntrySchema.properties.response,
  retry: trafficEntrySchema.properties.retry,
  error: trafficEntrySchema.properties.error,
  durationMs: integerSchema('Duração em milissegundos.'),
}));

export const manifest = defineAddonManifest({
  id: 'text-wikipedia',
  version: '1.0.0',
  name: 'Wikipédia (resumos)',
  description: 'Artigos e resumos da Wikipédia com inspeção completa do tráfego HTTP.',
  author: 'Equipe AC',
  license: 'MIT',
  ui: { title: '🌐 Wikipédia', body: 'Busca e resumos consultados pela Wikipédia via HTTP. O painel abaixo mostra o manifesto e o tráfego real enviado e recebido.' },
  resources: [
    { name: 'catalog', types: ['page'], idPrefixes: [] },
    { name: 'search', types: ['page'], idPrefixes: [] },
    { name: 'text', types: ['page'], idPrefixes: [] },
  ],
  types: ['page'],
  idPrefixes: [],
  catalogs: [
    { type: 'page', id: 'aleatorios', name: 'Artigos Aleatórios' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      {
        id: 'catalog',
        direction: 'incoming',
        method: 'GET',
        path: '/catalog/{type}/{catalogId}.json?limit={limit}&cursor={cursor}',
        purpose: 'Entrega títulos aleatórios ao host, repassando a paginação opcional.',
        resource: 'catalog',
        receives: incomingCatalogRequest,
        returns: payload('Metadados normalizados dos artigos aleatórios.', objectSchema('Objeto com metas e paginação.', 'public', {
          metas: arraySchema('Artigos encontrados.', 'public', searchMetaSchema),
          pagination: paginationSchema,
        }, ['metas'])),
      },
      {
        id: 'search',
        direction: 'incoming',
        method: 'GET',
        path: '/search/{type}/{query}.json?limit={limit}&cursor={cursor}',
        purpose: 'Busca artigos para o termo informado e devolve o extrato na descrição de cada meta.',
        resource: 'search',
        receives: incomingSearchRequest,
        returns: payload('Resultados normalizados e paginação.', objectSchema('Objeto com metas e paginação.', 'public', {
          metas: arraySchema('Resultados encontrados.', 'public', searchMetaSchema),
          pagination: paginationSchema,
        }, ['metas'])),
      },
      {
        id: 'text',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}.json',
        purpose: 'Lista a versão de resumo disponível para um artigo.',
        resource: 'text',
        receives: incomingTextRequest,
        returns: payload('Opções de conteúdo e seus links.', objectSchema('Objeto com texts.', 'public', {
          texts: arraySchema('Textos disponíveis.', 'public', objectSchema('Opção de texto.', 'public', {
            id: stringSchema('ID do texto.'),
            url: stringSchema('URL do conteúdo servido pelo add-on.', 'public', 'uri'),
            contentJsonUrl: stringSchema('URL do conteúdo estruturado servido pelo add-on.', 'public', 'uri'),
            lang: stringSchema('Idioma do texto.'),
            name: stringSchema('Nome exibido.'),
            displaytitle: stringSchema('Título formatado para apresentação.'),
            description: stringSchema('Descrição curta, quando disponível.'),
            pageid: integerSchema('ID numérico da página.'),
            wikibase_item: stringSchema('ID Wikidata relacionado.'),
            namespace: namespaceSchema,
            dir: stringSchema('Direção do texto.'),
            revision: stringSchema('ID da revisão.'),
            timestamp: stringSchema('Data da revisão.', 'public', 'date-time'),
            tid: stringSchema('Identificador da resposta REST.'),
            titles: titlesSchema,
            description_source: stringSchema('Origem da descrição curta.'),
            content_urls: contentUrlsSchema,
            thumbnail: imageSchema('Miniatura, quando disponível.'),
            originalimage: imageSchema('Imagem original, quando disponível.'),
          }, ['id', 'url', 'name'])),
        }, ['texts'])),
      },
      {
        id: 'content',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.txt',
        purpose: 'Entrega o título e o resumo em texto puro.',
        receives: incomingContentRequest,
        returns: payload('Conteúdo textual do artigo.', stringSchema('Título seguido pelo extrato introdutório.')),
      },
      {
        id: 'content-json',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.json',
        purpose: 'Entrega conteúdo estruturado, metadados, mídia, fonte e observabilidade da coleta sem alterar content.txt.',
        receives: incomingContentRequest,
        returns: payload('Conteúdo estruturado e metadados completos do artigo.', contentJsonResponseSchema),
      },
      {
        id: 'debug-traffic',
        direction: 'incoming',
        method: 'GET',
        path: '/debug/traffic.json',
        purpose: 'Expõe ao host o histórico local completo das requisições e respostas observadas.',
        returns: payload('Histórico de observabilidade da execução atual.', trafficResponseSchema),
      },
      {
        id: 'search-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&list=search&srsearch={query}&srnamespace=0&srlimit={limit}&sroffset={offset}&srinfo=totalhits&srprop=snippet&format=json&origin=*',
        purpose: 'Busca até 20 títulos por página, obtém total aproximado e cursor até o limite de 500 resultados.',
        receives: payload('Request integral enviada à API de busca.', searchRequestSchema),
        returns: payload('Resposta integral recebida da API de busca.', searchResponseSchema),
      },
      {
        id: 'extracts-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&titles={titles}&prop=extracts&exlimit=20&explaintext=1&exintro=1&redirects=1&format=json&origin=*',
        purpose: 'Completa em lote o conteúdo introdutório dos resultados da busca.',
        receives: payload('Request integral enviada à API de extratos.', extractsRequestSchema),
        returns: payload('Resposta integral recebida da API de extratos.', extractsResponseSchema),
      },
      {
        id: 'random-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&list=random&rnnamespace=0&rnlimit={count}&rncontinue={cursor}&format=json&origin=*',
        purpose: 'Obtém títulos aleatórios e cursor opcional para o catálogo.',
        receives: payload('Request integral enviada à API de páginas aleatórias.', randomRequestSchema),
        returns: payload('Resposta integral recebida da API aleatória.', randomResponseSchema),
      },
      {
        id: 'summary-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/api/rest_v1/page/summary/{title}',
        purpose: 'Obtém o resumo público completo de um artigo para a rota text e para o conteúdo.',
        receives: payload('Request integral enviada à API REST de resumo.', summaryRequestSchema),
        returns: payload('Resposta integral recebida da API REST de resumo.', summaryResponseSchema),
      },
    ],
    logs: [
      { id: 'http-request', level: 'info', message: 'Requisição HTTP observada', description: 'Registra método, URL, headers, query e corpo enviado.', details: debugLogDetails },
      { id: 'http-response', level: 'info', message: 'Resposta HTTP observada', description: 'Registra status, headers, corpo completo e duração.', details: debugLogDetails },
      { id: 'http-retry', level: 'warn', message: 'Retry da API externa', description: 'Registra uma nova tentativa após HTTP 429, 5xx ou falha de rede.', details: debugLogDetails },
      { id: 'http-error', level: 'error', message: 'Falha na API externa', description: 'Registra o erro e o corpo retornado quando disponível.', details: debugLogDetails },
    ],
  },
});
