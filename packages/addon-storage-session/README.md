# `@addons/addon-storage-session`

Provedor de `state-store` `1.0.0` usando `sessionStorage`.

## Por que existe

Demonstra fallback explícito de persistência: o mesmo contrato pode ser atendido por um armazenamento que dura somente enquanto a sessão da aba existir.

## O que oferece

Implementa `get`, `set`, `remove`, `listKeys` e `clear` no namespace `addons:state:`. A prioridade declarada é `0`, portanto o host prefere `addon-storage-local` quando os dois estão instalados. O fechamento da aba encerra a retenção.

## Como executar e testar

```bash
pnpm --filter @addons/addon-storage-session test
pnpm --filter @addons/addon-storage-session serve
```

O manifesto fica em `http://localhost:5309/manifest.json`. O adaptador está em [`src/browser-state-store.ts`](src/browser-state-store.ts).
