# `@addons/addon-favorites`

Add-on em processo que fornece `addons.favorites` `1.0.0`.

## Por que existe

Mantém favoritos como regra de domínio do próprio add-on, sem transformar favoritos em serviço global do protocolo.

## O que oferece

O serviço expõe `list`, `add({ title, url? })` e `remove(id)`. A coleção e o estado visual são declarados em `contract.state`. O provedor `state-store` é opcional; na ausência dele, o add-on usa um armazenamento em memória.

## Como executar e testar

```bash
pnpm --filter @addons/addon-favorites test
pnpm --filter @addons/addon-favorites serve
```

O manifesto fica em `http://localhost:5306/manifest.json`. A mediação de estado passa por `host.services.use`; os helpers de favoritos estão em [`src/bookmarks.ts`](src/bookmarks.ts) e [`src/memory-bookmark-store.ts`](src/memory-bookmark-store.ts).
