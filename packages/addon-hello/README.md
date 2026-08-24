# `@addons/addon-hello`

Add-on em processo que fornece `addons.hello.greeter` na versão `1.0.0`.

## Por que existe

É o provedor base usado para demonstrar um serviço namespaceado, uma aba declarativa e fallback entre implementações compatíveis.

## O que oferece

O método `greet(name)` retorna uma saudação. O contrato também declara a capacidade opcional `state-store` para salvar a aba; sem um provedor de estado, a experiência continua em memória. Não há I/O externo.

## Como executar

```bash
pnpm --filter @addons/addon-hello serve
```

O servidor local publica `http://localhost:5301/manifest.json` e um bundle ESM no mesmo endereço. O host instala pela URL completa do manifesto e valida o contrato antes do `setup`.

O manifesto canônico está em [`src/index.ts`](src/index.ts) e usa `defineAddonManifest` de `@addons-poc/protocol`.

Consulte a [especificação de manifesto](../../docs/MANIFEST-SPEC.md) e o [índice dos pacotes](../../docs/PACKAGES.md).
