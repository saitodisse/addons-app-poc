# `@addons/addon-debug`

Provedor de `addons.debug.log` `1.0.0` para eventos estruturados.

## Por que existe

Permite observar o ciclo de vida dos add-ons sem criar uma API de logs específica no host. O host envia eventos validados ao serviço quando ele está ativo.

## O que oferece

O serviço expõe `record`, `list`, `clear` e `subscribe`, mantém eventos em memória e declara a capacidade opcional `logs`. O manifesto não declara I/O externo nem persistência.

## Como executar e testar

```bash
pnpm --filter @addons/addon-debug test
pnpm --filter @addons/addon-debug serve
```

O manifesto fica em `http://localhost:5310/manifest.json`. Os eventos são validados como logs estruturados pelo protocolo antes de serem registrados.
