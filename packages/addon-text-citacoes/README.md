# `@addons/addon-text-citacoes`

Servidor HTTP de citações.

## Por que existe

Demonstra um add-on remoto que declara uma origem externa e normaliza o resultado antes de oferecer recursos de texto ao host e ao agregador.

## O que oferece

Publica catálogo, busca, opções de texto e conteúdo em texto puro para o tipo `quote`. O manifesto declara em `contract.http` as chamadas de saída para `https://dummyjson.com` (`/quotes` e `/quotes/{id}`); elas são executadas pelos handlers e não são interceptadas pelo host.

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-citacoes test
pnpm --filter @addons/addon-text-citacoes serve
```

O manifesto fica em `http://localhost:5292/manifest.json`. As rotas e a transformação dos dados estão em [`src/manifest.js`](src/manifest.js) e [`src/handlers.js`](src/handlers.js). O servidor é fornecido por [`@addons/addon-server`](../addon-server/README.md).
