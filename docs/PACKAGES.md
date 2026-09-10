# Pacotes

Este índice explica o papel de cada pacote depois da separação entre o protocolo público e o runtime do host.

## Por que esta divisão existe

O host precisa instalar e revisar add-ons sem conhecer implementações concretas. Para isso, existe uma única fronteira compartilhada: `@addons-poc/protocol`. O host mantém loader, registro, estados e adaptadores internamente; cada add-on mantém seu próprio domínio.

## O que cada pacote faz

| Pacote | Formato | Responsabilidade | Documentação |
| --- | --- | --- | --- |
| [`@addons-poc/protocol`](../packages/protocol/README.md) | biblioteca pública | Contrato v1, schema JSON, SemVer, validadores e SDK | [`packages/protocol`](../packages/protocol/README.md) |
| [`@addons/host-app`](../packages/host-app/README.md) | aplicativo web | Loader, negociação, registro, status, persistência de instalação e UI genérica | [`packages/host-app`](../packages/host-app/README.md) |
| [`@addons/addon-server`](../packages/addon-server/README.md) | biblioteca Node.js ESM | Servidor HTTP sem dependências externas de runtime | [`packages/addon-server`](../packages/addon-server/README.md) |
| [`@addons/addon-markdown`](../packages/addon-markdown/README.md) | add-on em processo | Formatação local em Markdown e HTML | [`packages/addon-markdown`](../packages/addon-markdown/README.md) |
| [`@addons/addon-favorites`](../packages/addon-favorites/README.md) | add-on em processo | Inclusão, listagem e remoção de favoritos | [`packages/addon-favorites`](../packages/addon-favorites/README.md) |
| [`@addons/addon-health`](../packages/addon-health/README.md) | add-on em processo | Verificação dos provedores HTTP | [`packages/addon-health`](../packages/addon-health/README.md) |
| [`@addons/addon-storage-local`](../packages/addon-storage-local/README.md) | provedor em processo | `state-store` em `localStorage`, prioridade 10 | [`packages/addon-storage-local`](../packages/addon-storage-local/README.md) |
| [`@addons/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) | servidor HTTP | Resumos e buscas na Wikipédia em português | [`packages/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) |

Todos os add-ons e o host dependem diretamente de `@addons-poc/protocol@1.0.0`,
instalado do npm. O lockfile mantém a integridade do artefato publicado; não há
link local do protocolo durante a instalação do workspace. Os quatro add-ons
O add-on HTTP restante depende de `@addons/addon-server`; não há dependência entre add-ons
de domínio.

## Como usar esta documentação

Comece pelo [README do protocolo](../packages/protocol/README.md) quando for criar ou revisar um manifesto. Consulte o [README do host](../packages/host-app/README.md) quando a mudança envolver instalação, negociação ou runtime. Para uma implementação específica, o README do pacote descreve o serviço, a porta local e o comando de teste.

As regras completas estão em [`docs/MANIFEST-SPEC.md`](MANIFEST-SPEC.md), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) e [`docs/DECISIONS.md`](DECISIONS.md).

## Portas da demonstração

| Porta | Pacote |
| --- | --- |
| 5280 | host web |
| 5294 | text-wikipedia |
| 5304 | `addon-markdown` |
| 5306 | `addon-favorites` |
| 5307 | `addon-health` |
| 5308 | `addon-storage-local` |

As portas são convenções da demonstração local. Em instalação por URL, a identidade continua sendo a URL completa de `manifest.json`.
