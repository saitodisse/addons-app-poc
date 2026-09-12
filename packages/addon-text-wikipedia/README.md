# `@addons/addon-text-wikipedia`

Servidor HTTP de resumos da Wikipédia em português.

## Por que existe

Demonstra um add-on que declara múltiplos endpoints externos e os apresenta como recursos de texto compatíveis com o mesmo protocolo.

## O que oferece

Publica catálogo aleatório, busca, opções de texto e conteúdo em texto puro para o tipo `page`. A busca usa `list=search` em páginas de até 20 títulos, continua com `sroffset` e limita o total a 500 registros. Cada página completa os extratos em lote pela API da Wikipédia e devolve o conteúdo de cada artigo no campo `description` da meta. Assim, uma busca por `Bola` mostra o conteúdo de `Bola` diretamente na coluna **Descrição** do host; os controles **Página anterior** e **Próxima página** navegam entre páginas sem acumular linhas, e o link técnico `http://localhost:5294/text/page/Bola/content.txt` leva a uma página dedicada que busca também `content.json`, exibindo imagem, descrição, resumo e o link original. Os metadados, headers e observabilidade permanecem no JSON e no debug. O cliente identifica-se perante a API, repete falhas transitórias `429`/`5xx`, deduplica chamadas simultâneas e mantém cada página em cache por 60 segundos. O teto de 20 por página vem do limite de `exlimit` da API de extratos; o teto total de 500 vem do limite de `srlimit` da API de busca. Consulte [`API:Search`](https://www.mediawiki.org/wiki/API%3ASearch/en) e [`Extension:TextExtracts`](https://www.mediawiki.org/wiki/Extension:TextExtracts). `contract.http` registra as chamadas à busca paginada, aos lotes de extratos, à lista de páginas aleatórias e à API de resumo de `https://pt.wikipedia.org`.

O manifesto também declara exatamente os campos de cada request e response
externo. O servidor mantém as últimas 100 trocas com seus corpos completos em
`http://localhost:5294/debug/traffic.json` e imprime cada evento como JSON no
terminal do processo. Ao abrir a extensão no host, o mesmo histórico aparece
terminal do processo; no host, a seção mostra somente um link para esse
endpoint enquanto a página registra a troca completa no console do DevTools. O
próprio endpoint de debug fica fora do histórico para não se
autoalimentar. Corpos, URLs, query e headers não sensíveis são preservados;
cookies, autenticação, chaves e identificadores de IP aparecem como `[redacted]`.
A rota `content.txt` continua devolvendo somente texto puro e compatível. A rota
paralela `http://localhost:5294/text/page/Bola/content.json` devolve o título,
`displaytitle`, descrição, `extract`/`extract_html`, IDs, idioma e direção,
revisão, timestamp, links desktop/mobile de página/revisões/edição, thumbnail,
imagem original, métricas do texto, fonte consultada, headers relevantes e os
dados de observabilidade (`requestId`, duração e horário da coleta). Os headers
HTTP `ETag`, `Last-Modified`, `Content-Language` e `Content-Length` também são
entregues nessa rota. Um artigo inexistente responde 404 específico.

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-wikipedia test
pnpm --filter @addons/addon-text-wikipedia serve
```

O manifesto fica em `http://localhost:5294/manifest.json`. A implementação está em [`src/handlers.js`](src/handlers.js) e [`src/manifest.js`](src/manifest.js), com o servidor comum [`@addons/addon-server`](../addon-server/README.md).
