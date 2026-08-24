# `@addons/addon-storage-local`

Provedor de `state-store` `1.0.0` usando `localStorage`.

## Por que existe

Oferece persistência de estado como add-on substituível. O host não escolhe um storage embutido; ele seleciona provedores pelo contrato e pela prioridade.

## O que oferece

Implementa `get`, `set`, `remove`, `listKeys` e `clear` para valores JSON sob o namespace físico `addons:state:`. A prioridade declarada é `10`, acima do provedor de sessão. O estado de cada consumidor continua limitado pelas chaves e operações declaradas no contrato do consumidor.

## Como executar e testar

```bash
pnpm --filter @addons/addon-storage-local test
pnpm --filter @addons/addon-storage-local serve
```

O manifesto fica em `http://localhost:5308/manifest.json`. A implementação do adaptador está em [`src/browser-state-store.ts`](src/browser-state-store.ts).
