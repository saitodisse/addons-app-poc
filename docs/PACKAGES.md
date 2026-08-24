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
| [`@addons/addon-hello`](../packages/addon-hello/README.md) | add-on em processo | Saudação padrão | [`packages/addon-hello`](../packages/addon-hello/README.md) |
| [`@addons/addon-hello-pt`](../packages/addon-hello-pt/README.md) | add-on em processo | Saudação em português com prioridade maior | [`packages/addon-hello-pt`](../packages/addon-hello-pt/README.md) |
| [`@addons/addon-counter`](../packages/addon-counter/README.md) | add-on em processo | Contador com estado opcional | [`packages/addon-counter`](../packages/addon-counter/README.md) |
| [`@addons/addon-markdown`](../packages/addon-markdown/README.md) | add-on em processo | Formatação local em Markdown e HTML | [`packages/addon-markdown`](../packages/addon-markdown/README.md) |
| [`@addons/addon-aggregator`](../packages/addon-aggregator/README.md) | add-on em processo | Busca agregada em provedores HTTP | [`packages/addon-aggregator`](../packages/addon-aggregator/README.md) |
| [`@addons/addon-favorites`](../packages/addon-favorites/README.md) | add-on em processo | Inclusão, listagem e remoção de favoritos | [`packages/addon-favorites`](../packages/addon-favorites/README.md) |
| [`@addons/addon-health`](../packages/addon-health/README.md) | add-on em processo | Verificação dos provedores HTTP | [`packages/addon-health`](../packages/addon-health/README.md) |
| [`@addons/addon-storage-local`](../packages/addon-storage-local/README.md) | provedor em processo | `state-store` em `localStorage`, prioridade 10 | [`packages/addon-storage-local`](../packages/addon-storage-local/README.md) |
| [`@addons/addon-storage-session`](../packages/addon-storage-session/README.md) | provedor em processo | `state-store` em `sessionStorage`, prioridade 0 | [`packages/addon-storage-session`](../packages/addon-storage-session/README.md) |
| [`@addons/addon-debug`](../packages/addon-debug/README.md) | provedor em processo | `addons.debug.log` com eventos estruturados | [`packages/addon-debug`](../packages/addon-debug/README.md) |
| [`@addons/addon-text-biblioteca`](../packages/addon-text-biblioteca/README.md) | servidor HTTP | Textos locais e recursos de texto | [`packages/addon-text-biblioteca`](../packages/addon-text-biblioteca/README.md) |
| [`@addons/addon-text-citacoes`](../packages/addon-text-citacoes/README.md) | servidor HTTP | Citações carregadas da DummyJSON | [`packages/addon-text-citacoes`](../packages/addon-text-citacoes/README.md) |
| [`@addons/addon-text-poemas`](../packages/addon-text-poemas/README.md) | servidor HTTP | Poemas carregados da PoetryDB | [`packages/addon-text-poemas`](../packages/addon-text-poemas/README.md) |
| [`@addons/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) | servidor HTTP | Resumos e buscas na Wikipédia em português | [`packages/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) |

Todos os add-ons dependem diretamente de `@addons-poc/protocol`. Os quatro add-ons HTTP também dependem de `@addons/addon-server`; não há dependência entre add-ons de domínio.

## Como usar esta documentação

Comece pelo [README do protocolo](../packages/protocol/README.md) quando for criar ou revisar um manifesto. Consulte o [README do host](../packages/host-app/README.md) quando a mudança envolver instalação, negociação ou runtime. Para uma implementação específica, o README do pacote descreve o serviço, a porta local e o comando de teste.

As regras completas estão em [`docs/MANIFEST-SPEC.md`](MANIFEST-SPEC.md), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) e [`docs/DECISIONS.md`](DECISIONS.md).

## Portas da demonstração

| Porta | Pacote |
| --- | --- |
| 5280 | host web |
| 5291 | text-biblioteca |
| 5292 | text-citacoes |
| 5293 | text-poemas |
| 5294 | text-wikipedia |
| 5301 | `addon-hello` |
| 5302 | `addon-hello-pt` |
| 5303 | `addon-counter` |
| 5304 | `addon-markdown` |
| 5305 | `addon-aggregator` |
| 5306 | `addon-favorites` |
| 5307 | `addon-health` |
| 5308 | `addon-storage-local` |
| 5309 | `addon-storage-session` |
| 5310 | `addon-debug` |

As portas são convenções da demonstração local. Em instalação por URL, a identidade continua sendo a URL completa de `manifest.json`.
