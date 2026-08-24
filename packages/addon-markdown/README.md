# `@addons/addon-markdown`

Add-on em processo que fornece `addons.markdown.text-formatter` `1.0.0`.

## Por que existe

Mantém um helper de domínio dentro do próprio add-on e demonstra que formatação de texto não é uma API global do host.

## O que oferece

O método `format({ title, content })` produz Markdown e HTML localmente. A aba declara os campos e a ação no contrato; seu estado pode usar `state-store` e cai para memória quando o serviço não existe. Não há I/O externo.

## Como executar e testar

```bash
pnpm --filter @addons/addon-markdown test
pnpm --filter @addons/addon-markdown serve
```

O manifesto fica em `http://localhost:5304/manifest.json`. O serviço é obtido por `host.services.use` com o descritor `addons.markdown.text-formatter`.

Implementação e testes: [`src/index.ts`](src/index.ts) e [`src/formatting.ts`](src/formatting.ts).
