# Instruções para Agentes de IA — addons-app-poc

Este documento estabelece as regras e convenções para agentes de IA que trabalham neste projeto.

## Natureza do Projeto

Este é um **projeto independente de prova de conceito (POC)**. Não faz parte do ecossistema AC nem de qualquer outro repositório existente. Não deve ser tratado como parte do monorepo `achorde` ou `ac15`.

## Fronteiras

- `packages/core/`: o protocolo central — **domain/** (regras puras), **ports/** (interfaces), **adapters/** (implementações). **Código mais crítico do projeto.**
- `packages/host-app/`: aplicativo que consome add-ons. Depende de `core` mas não o modifica.
- `packages/addon-*/`: add-ons de exemplo. Dependem de `core` para se registrar (formato em-processo) ou de `@addons/addon-server` para servir HTTP (formato Stremio).
- `packages/addon-server/`: framework Node (zero dependências) que monta o servidor HTTP de um add-on de texto a partir de `manifest` + `handlers`.

Nenhum pacote deve importar de outro pacote sem passar pelo `core`. Add-ons não importam do `host-app`. Add-ons de texto são JS puro e não arrastam o runtime TS do core.

## Decisões Arquiteturais Registradas

1. **URL como identidade**: a URL do manifesto é a identidade única do add-on.
2. **Manifest + Setup**: add-on exporta `manifest` (declaração) e `setup` (inicialização) separadamente.
3. **HostAPI mínimo**: o add-on recebe `services`, `onUnload` e `log` — nada mais.
4. **Prioridade explícita**: serviços são resolvidos por prioridade, com fallback automático.
5. **Erro no setup = add-on desativado**: exceção no setup desativa o add-on completamente.
6. **Fallback automático**: se um serviço falha, o registry tenta o próximo da lista (`withFallback` sincrono, `withFallbackAsync` assíncrono).
7. **ESM puro**: add-ons são módulos ES importados dinamicamente com `import()`.
8. **Testes no core**: testes unitários em `@addons/core` — registry, validação, loader, cliente de texto.
9. **Manifesto completo**: inclui `id`, `version`, `name`, `description`, `author`, `icon`, `license` + `services[]`/`entrypoint` (em-processo) **ou** `resources`/`types`/`catalogs` (Stremio/HTTP).
10. **Fallback com withFallback**: `withFallback(registry, serviceId, fn)` tenta cada implementação; se a primeira falha, tenta a próxima.
11. **Interfaces de domínio**: `Greeter`, `Counter`, `SearchProvider`, `SearchResult`, `HttpFetcher` em `domain/interfaces.ts` — add-ons implementam interfaces explicitamente.
12. **Add-on pode ser servidor HTTP (Stremio)**: o manifesto pode declarar `resources`; o add-on vira um servidor que responde `/<resource>/<type>/<id>.json` (referência: Torrentio no Stremio).
13. **Recurso text no formato subtitles**: `{ texts: [{ id, url, lang, name }] }`, onde `url` aponta para o conteúdo em texto puro.
14. **Servidor de add-on em JS puro**: `@addons/addon-server` e add-ons de texto são JS ESM puro, com validação mínima própria (a canônica vive no core).

## Comandos

- `pnpm install` — instalar dependências
- `pnpm test` — rodar todos os testes (core, addon-server, add-ons)
- `pnpm dev` — rodar host app em desenvolvimento (http://localhost:5280)
- `pnpm dev:addons` — subir os servidores dos add-ons de texto (5291 biblioteca, 5292 citações, 5293 poemas)
- `pnpm --filter @addons/host-app dev` — rodar host app isolado
- `pnpm --filter @addons/addon-text-biblioteca serve` — subir um add-on específico

## Convenções

- TypeScript strict mode
- Nomes de pacotes no formato `@addons/<nome>`
- Commits em português descritivo
- Testes Vitest ao lado do código (`arquivo.test.ts`)
- Documentação em arquivos Markdown em `docs/`

## Estados

Use **Planejado**, **Em Andamento**, **Entregue**, **Parcial**, **Desativado** e **Substituído** para marcar o status de cada fase.

## O que Não Fazer

- Não misturar código com o monorepo AC
- Não publicar no npm sem autorização explícita
- Não adicionar dependências desnecessárias
- Não pular testes
- Não modificar o `core` sem atualizar `docs/`

---

## Índice de Arquivos para Agentes

Este índice ajuda o agente a localizar rapidamente qualquer arquivo do projeto e entender seu propósito.

### Raiz

| Arquivo | Para que serve |
|---------|----------------|
| `README.md` | Visão geral do projeto, propósito, e índice completo |
| `AGENTS.md` | Este arquivo — regras para agentes de IA |

### Documentação Técnica (`docs/`)

| Arquivo | Conteúdo | Quando consultar |
|---------|----------|------------------|
| `docs/ARCHITECTURE.md` | Camadas, fluxos, modelos de dados, ADRs | Antes de qualquer mudança estrutural |
| `docs/GLOSSARY.md` | Definições de todos os termos | Quando encontrar um termo desconhecido |
| `docs/MANIFEST-SPEC.md` | Especificação do manifesto JSON | Ao criar ou modificar um add-on |
| `docs/PHASES.md` | Fases do projeto com sub-passos | Para saber o que vem depois |
| `docs/PLANNING.md` | Histórico completo da conversa de planejamento | Para entender decisões passadas |
| `docs/PRD.md` | Requisitos funcionais e não funcionais | Para verificar se uma feature é escopo |

### Documentação para Iniciantes (`docs/docs-17yrs/`)

| Arquivo | Conteúdo | Diferença da versão técnica |
|---------|----------|-----------------------------|
| `docs/docs-17yrs/README.md` | Visão geral do projeto | Linguagem mais simples, analogias |
| `docs/docs-17yrs/AGENTS.md` | Regras para IA | Sem juridiquês, direto ao ponto |
| `docs/docs-17yrs/RESUMO-PLANO.md` | 13 decisões detalhadas | Cada decisão vira um capítulo com problema → opções → escolha → porquê |
| `docs/docs-17yrs/ARCHITECTURE.md` | Arquitetura do sistema | Diagrama ASCII, analogias (goleiro, leilão, gaveta) |
| `docs/docs-17yrs/GLOSSARY.md` | Dicionário | Frases mais curtas, um termo por linha |
| `docs/docs-17yrs/MANIFEST-SPEC.md` | Especificação do manifesto | Campo por campo com exemplos, sem formalismo |
| `docs/docs-17yrs/PHASES.md` | Fases do projeto | Ordem crescente de complexidade, menos detalhes de implementação |
| `docs/docs-17yrs/PLANNING.md` | Histórico do planejamento | 11 capítulos narrativos, história contada em ordem |
| `docs/docs-17yrs/PRD.md` | Requisitos | Checklist simples, sem tabelas de prioridade |

### Código (`packages/`)

| Pacote | Caminho | Responsabilidade |
|--------|---------|------------------|
| `@addons/core` | `packages/core/` | Tipos, ServiceRegistry, AddonLoader, Validation, TextAddonClient |
| `@addons/host-app` | `packages/host-app/` | App React que consome add-ons (abas greeter/counter/fallback/textos/inspector) |
| `@addons/addon-hello` | `packages/addon-hello/` | Add-on de exemplo (serviço greeter) |
| `@addons/addon-hello-pt` | `packages/addon-hello-pt/` | Add-on de exemplo (greeter com prioridade 10) |
| `@addons/addon-counter` | `packages/addon-counter/` | Add-on de exemplo (serviço counter) |
| `@addons/addon-server` | `packages/addon-server/` | Framework Node (zero deps) que serve manifest.json + endpoints de resource estilo Stremio com CORS |
| `@addons/addon-text-biblioteca` | `packages/addon-text-biblioteca/` | Add-on de texto (porta 5291) — acervo embutido: catálogo + busca + texto |
| `@addons/addon-text-citacoes` | `packages/addon-text-citacoes/` | Add-on de texto (porta 5292) — processamento externo: API DummyJSON Quotes |
| `@addons/addon-text-poemas` | `packages/addon-text-poemas/` | Add-on de texto (porta 5293) — processamento externo real com busca: API PoetryDB |