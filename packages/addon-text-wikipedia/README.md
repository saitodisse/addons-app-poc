# `@addons/addon-text-wikipedia`

Servidor HTTP de resumos da Wikipédia em português.

## Por que existe

Demonstra um add-on que declara múltiplos endpoints externos e os apresenta como recursos de texto compatíveis com o mesmo protocolo.

## O que oferece

Publica catálogo aleatório, busca, opções de texto e conteúdo em texto puro para o tipo `page`. A busca usa `list=search` em páginas de até 20 títulos, continua com `sroffset` e limita o total a 500 registros. Cada página completa os extratos em lote pela API da Wikipédia e devolve o conteúdo de cada artigo no campo `description` da meta. Assim, uma busca por `Bola` mostra o conteúdo de `Bola` diretamente na coluna **Descrição** do host; os controles **Página anterior** e **Próxima página** navegam entre páginas sem acumular linhas, e o link técnico `http://localhost:5294/text/page/Bola/content.txt` continua sendo usado para abrir o conteúdo no modal. O teto de 20 por página vem do limite de `exlimit` da API de extratos; o teto total de 500 vem do limite de `srlimit` da API de busca. Consulte [`API:Search`](https://www.mediawiki.org/wiki/API%3ASearch/en) e [`Extension:TextExtracts`](https://www.mediawiki.org/wiki/Extension%3ATextExtracts). `contract.http` registra as chamadas à busca paginada, aos lotes de extratos, à lista de páginas aleatórias e à API de resumo de `https://pt.wikipedia.org`.

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-wikipedia test
pnpm --filter @addons/addon-text-wikipedia serve
```

O manifesto fica em `http://localhost:5294/manifest.json`. A implementação está em [`src/handlers.js`](src/handlers.js) e [`src/manifest.js`](src/manifest.js), com o servidor comum [`@addons/addon-server`](../addon-server/README.md).
