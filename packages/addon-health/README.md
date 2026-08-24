# `@addons/addon-health`

Add-on em processo que fornece `addons.health.health-check` `1.0.0`.

## Por que existe

Torna observável o estado dos provedores HTTP sem acoplar o host a uma lista de serviços de texto.

## O que oferece

O método `check()` consulta os quatro manifestos HTTP locais, mede a resposta e retorna os estados. Essas chamadas `GET /manifest.json` estão declaradas em `contract.http`. O estado da aba é opcional e usa `state-store` quando disponível.

## Como executar e testar

```bash
pnpm --filter @addons/addon-health test
pnpm --filter @addons/addon-health serve
```

O manifesto fica em `http://localhost:5307/manifest.json`. O cliente de rede está em [`src/http-client.ts`](src/http-client.ts); a declaração do I/O está em [`src/index.ts`](src/index.ts).
