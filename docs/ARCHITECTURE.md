# Arquitetura do addons-app-poc

**Status: Parcial · Protocolo 1.0.0 pronto para publicação**

Os READMEs operacionais de cada pacote estão reunidos em [`PACKAGES.md`](PACKAGES.md). Este documento explica a fronteira; os READMEs explicam como executar cada implementação.

## Por que

O host precisa aceitar extensões independentes sem transformar cada exemplo em
uma dependência da aplicação. A solução é separar a fronteira pública de
compatibilidade do runtime que executa o host.

## O que

Há três áreas, com direção de dependência única:

```text
add-on em processo ─┐
add-on HTTP --------┼──► @addons-poc/protocol (contrato e SDK)
host-app/runtime ----┘
          host-app ──► protocolo
```

O host não importa, cataloga metadados embutidos nem declara nenhum `addon-*`.
Cada add-on declara seu contrato e publica uma URL de manifesto. A tela de
Configurações oferece uma lista de conveniência com URLs locais de
`manifest.json` e lê apenas `name` e `description` para apresentar cada linha;
ela não importa bundles nem conhece serviços específicos. Add-ons não importam
outros add-ons.

O pacote foi empacotado e testado em consumidor limpo; o envio ao npm aguarda
uma sessão autenticada com propriedade confirmada do escopo `@addons-poc`.

| Área | Responsabilidade | Pode depender de |
|---|---|---|
| `packages/protocol` | Tipos, JSON Schema, SemVer, validadores, descritores e SDK | somente regras puras |
| `packages/host-app/src/runtime` | Loader ESM, registry, status, negociação, prioridade e adaptadores | protocolo e APIs da plataforma |
| `packages/host-app/src/components` | Gestão, revisão e UI genérica | protocolo e runtime local |
| `packages/addon-*` | Implementações de domínio e exemplos | protocolo; HTTP também `addon-server` |

A API pública do protocolo é a entrada `packages/protocol/src/index.ts` e a
distribuição contém `dist`, schema, README, licença e `package.json`. Fontes auxiliares
mantidas no workspace para testes de migração não representam uma exportação
nem recolocam runtime ou helpers de domínio na fronteira pública.

## O contrato público

`AddonManifest` contém metadados, URL opcional de `entrypoint` e uma única
seção `contract` v1. O contrato registra:

- faixa de protocolo e capacidades obrigatórias/opcionais;
- serviços fornecidos ou consumidos com versão, métodos e schemas;
- UI declarativa (`ui.tab`), estado, HTTP e logs;
- classificação de dados: `public`, `personal` ou `secret`.

`validateManifest` recusa contrato ausente, capacidades inválidas, serviços
sem namespace, métodos incompatíveis e recursos HTTP não descritos. O JSON
Schema equivalente é empacotado em `@addons-poc/protocol/schema`.

## Runtime interno do host

### Loader e estados

`FetchAddonLoader` busca o manifesto, valida protocolo e capacidades, importa o
bundle ESM apenas depois dessa validação e confere que o `manifest` exportado
tem o mesmo fingerprint do manifesto remoto. Falha de import ou `setup` vira
uma instância `error`; registros parciais são limpos.

### Registry e prioridade

`ServiceRegistry` vive em `packages/host-app/src/runtime/registry.ts`. Ele
guarda implementações por identificador, add-on de origem e prioridade. A
ordenação é determinística (maior prioridade primeiro). O registry não conhece
React, HTTP ou domínio.

### Proxy de serviços

O SDK entrega `host.services.use({ id, version, methods })`. O host só entrega
um serviço que aparece no contrato do consumidor e aplica a guarda do
`state-store` às chaves declaradas. Chamadas obrigatórias sem provedor deixam a
instalação bloqueada e são reavaliadas após uma nova ativação. Dependências
obrigatórias em ciclo são bloqueadas; fallback é explícito no runtime.

### Revisão e persistência

Configurações guarda URLs, desativação e fingerprint aceito em
`addons:host-installations:v1`. A mesma URL com contrato alterado volta para
revisão. O host não mistura essa configuração com o armazenamento de estado
dos add-ons.

## Dois formatos de add-on

### Em processo

O manifesto aponta `entrypoint` HTTP(S). O bundle exporta `manifest`, `setup` e
`createTab`. O `HostAPI` é deliberadamente pequeno: `services`,
`registerService`, `onUnload` e `log`. O host renderiza a aba sem conhecer as
regras internas.

### HTTP

`@addons/addon-server` publica `manifest.json`, catálogo, busca, opções de
texto e conteúdo. O servidor e os quatro exemplos HTTP são ESM puro. Eles
validam com o protocolo público, mas não importam runtime TypeScript do host.
I/O externo deve constar em `contract.http`; a v1 torna a declaração visível,
mas não intercepta `fetch` direto.

## Capacidade oficial opcional

`state-store` é o serviço padrão de persistência. `storage-local` fornece
`localStorage` com prioridade 10; `storage-session` fornece `sessionStorage`
com prioridade 0. Consumidores declaram a dependência no contrato e continuam
em memória quando ela é opcional e não existe.

## Limites de confiança

Esta POC aceita plugins confiáveis no mesmo processo. O contrato é governança e
compatibilidade, não isolamento. Sandbox, iframe/Worker, proxy de rede,
assinatura criptográfica e bloqueio de APIs globais estão fora da v1.
