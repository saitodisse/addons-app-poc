# `@addons/addon-counter`

Add-on em processo que fornece `addons.counter` `1.0.0`.

## Por que existe

Mostra um serviço com vários métodos e estado opcional mediado pelo protocolo.

## O que oferece

O serviço expõe `increment`, `decrement`, `reset` e `getValue`. O valor e a última resposta da aba são declarados em `contract.state` e usam `state-store` quando houver provedor; o fallback local é memória. Não há chamadas HTTP.

## Como executar e testar

```bash
pnpm --filter @addons/addon-counter serve
```

O manifesto está em `http://localhost:5303/manifest.json`. A implementação usa `host.services.use({ id: 'state-store' })`, portanto não acessa armazenamento global diretamente.

Veja [`src/index.ts`](src/index.ts), a [especificação de manifesto](../../docs/MANIFEST-SPEC.md) e o [índice dos pacotes](../../docs/PACKAGES.md).
