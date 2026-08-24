# ADR 0001 — Separar protocolo público e runtime do host

**Status:** Entregue
**Data:** 2026-08-23

## Por que

O pacote privado de núcleo misturava contrato, exemplos de domínio, registro,
loader e adaptadores. Um add-on que só precisava declarar compatibilidade
acabava importando detalhes de execução do host, e a fronteira não podia ser
publicada com clareza.

## Decisão

O pacote publicado como `@addons-poc/protocol@1.0.0` sob MIT contém o contrato v1, o
JSON Schema, validadores SemVer/capacidades, descritores de serviço, tipos do
`HostAPI` e o SDK de autoria. O host mantém loader, registry, status e
adaptadores em `packages/host-app/src/runtime`. Helpers de domínio pertencem
aos add-ons que os usam.

Todo manifesto usa exclusivamente `contract`. O host valida a compatibilidade
antes de importar um bundle. Serviços próprios usam nomes namespaceados e são
consultados por `host.services.use(contrato)`.

## Consequências

- hosts e add-ons têm uma dependência direta e explícita do pacote público;
- o host não tem catálogo nem dependência de implementação de add-on;
- quebrar um método de serviço exige major nova;
- o contrato permite revisão humana e bloqueio de dependências obrigatórias,
  mas não é sandbox;
- o pacote pode ser instalado por consumidores sem levar o runtime do host.

## Evidência e validação

`pnpm check:host-boundary`, `pnpm test`, `pnpm build:host` e
`npm pack --dry-run` compõem a prova local. A versão publicada foi consultada
com `npm view` e instalada em um consumidor limpo depois de confirmar a
conta/propriedade do escopo `@addons-poc`.
