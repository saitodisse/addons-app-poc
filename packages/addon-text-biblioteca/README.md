# `@addons/addon-text-biblioteca`

Servidor HTTP de textos locais.

## Por que existe

É o provedor sem rede externa da demonstração de recursos de texto. Serve para testar catálogo, busca, seleção de versão e entrega sob demanda.

## O que oferece

O manifesto `text-biblioteca` declara recursos `text` e as quatro rotas do protocolo HTTP:

- catálogo `destaques`, `natureza` e `memoria`;
- busca por termo;
- opções em `{ texts: [{ id, url, lang, name }] }`;
- conteúdo em texto puro por `content.txt`.

Os dados vivem em [`src/texts.js`](src/texts.js) e os handlers em [`src/handlers.js`](src/handlers.js). `contract.http` declara somente rotas de entrada; não há chamada externa.

## Como executar e testar

```bash
pnpm --filter @addons/addon-text-biblioteca test
pnpm --filter @addons/addon-text-biblioteca serve
```

O manifesto fica em `http://localhost:5291/manifest.json`. O servidor usa [`@addons/addon-server`](../addon-server/README.md), que valida o manifesto com `@addons-poc/protocol` antes de escutar.
