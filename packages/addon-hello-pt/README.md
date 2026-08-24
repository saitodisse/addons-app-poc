# `@addons/addon-hello-pt`

Provedor em processo de `addons.hello.greeter` `1.0.0`, com mensagens em português.

## Por que existe

Demonstra que vários add-ons podem fornecer o mesmo serviço sem o host conhecer nenhum deles. A escolha é feita por prioridade declarada no contrato.

## O que oferece

O método `greet(name)` retorna uma saudação em português. A prioridade `10` é maior que a do [`addon-hello`](../addon-hello/README.md), então este provedor é escolhido primeiro. O contrato declara `state-store` como dependência opcional e não declara I/O externo.

## Como executar

```bash
pnpm --filter @addons/addon-hello-pt serve
```

O manifesto fica em `http://localhost:5302/manifest.json`. O host pode carregar os dois manifestos; quando a implementação de maior prioridade falha, o fallback tenta a próxima implementação compatível.

O manifesto canônico está em [`src/index.ts`](src/index.ts) e é validado pelo `@addons-poc/protocol`.
