# `@addons/addon-aggregator`

Add-on em processo que fornece `addons.aggregator.search-provider` `1.0.0`.

## Por que existe

Demonstra um consumidor de vários add-ons HTTP sem criar dependências de pacote entre eles. Os endereços são I/O externo explícito no contrato, não catálogo embutido no host.

## O que oferece

O método `search(query)` consulta os quatro manifestos HTTP locais (portas 5291–5294) e combina os resultados. Histórico e estado visual são declarados em `contract.state` e usam `state-store` opcional. O contrato lista cada `GET` de saída, origem, rota, entrada e saída.

## Como executar e testar

Inicie primeiro os servidores de texto e então:

```bash
pnpm --filter @addons/addon-aggregator test
pnpm --filter @addons/addon-aggregator serve
```

O manifesto fica em `http://localhost:5305/manifest.json`. A comunicação HTTP está encapsulada em [`src/http-client.ts`](src/http-client.ts), enquanto o serviço e a aba estão em [`src/index.ts`](src/index.ts).

O add-on não importa nenhum pacote `addon-text-*`; a colaboração ocorre pelas URLs declaradas.
