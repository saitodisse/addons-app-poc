# `@addons/addon-text-poemas`

Servidor HTTP de poemas.

## Por que existe

Mostra um provedor remoto que consulta uma API pública e ainda expõe a mesma superfície HTTP de texto, permitindo que consumidores dependam do contrato e não da origem.

## O que oferece

Publica catálogo, busca por autor ou título, opções de texto e conteúdo em texto puro para o tipo `poem`. `contract.http` registra as chamadas de saída para `https://poetrydb.org` (`author`, `title` e `random`).

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-poemas test
pnpm --filter @addons/addon-text-poemas serve
```

O manifesto fica em `http://localhost:5293/manifest.json`. Handlers e declarações estão em [`src/handlers.js`](src/handlers.js) e [`src/manifest.js`](src/manifest.js), usando [`@addons/addon-server`](../addon-server/README.md).
