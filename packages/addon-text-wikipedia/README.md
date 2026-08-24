# `@addons/addon-text-wikipedia`

Servidor HTTP de resumos da Wikipédia em português.

## Por que existe

Demonstra um add-on que declara múltiplos endpoints externos e os apresenta como recursos de texto compatíveis com o mesmo protocolo.

## O que oferece

Publica catálogo aleatório, busca, opções de texto e conteúdo em texto puro para o tipo `page`. `contract.http` registra as chamadas ao OpenSearch, à lista de páginas aleatórias e à API de resumo de `https://pt.wikipedia.org`.

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-wikipedia test
pnpm --filter @addons/addon-text-wikipedia serve
```

O manifesto fica em `http://localhost:5294/manifest.json`. A implementação está em [`src/handlers.js`](src/handlers.js) e [`src/manifest.js`](src/manifest.js), com o servidor comum [`@addons/addon-server`](../addon-server/README.md).
