# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2025-08-19

### Adicionado

- **Add-ons em-processo que compõem serviços** (Fase 3.4):
  - `addon-markdown` — serviço `textFormatter`: formata título + conteúdo em Markdown e HTML.
  - `addon-aggregator` — serviço `searchProvider`: meta-search entre os add-ons de texto remotos, com tolerância a falhas individuais.
  - `addon-favorites` — serviço `favorites`: favoritos persistidos via `bookmarkStore` (infra do host) com degradação a memória.
  - `addon-health` — serviço `healthCheck`: verifica disponibilidade e latência dos add-ons remotos.
- **Add-on de texto Wikipédia** (`addon-text-wikipedia`, porta 5294): busca (opensearch) e resumos
  de artigos (API REST v1) com processamento externo real.
- **Núcleo (`@addons/core`)**: interfaces e helpers puros de formatação
  (`domain/formatting.ts`, `TextFormatter`), domínio de favoritos (`domain/bookmarks`,
  `Bookmark`, `BookmarkStore`, `FavoritesService`) e adapters
  `MemoryBookmarkStore` + `LocalStorageBookmarkStore` (com degradação sem navegador).
- **Host-app**: serviços de infraestrutura registrados pelo host (`addonId: 'host'`),
  registro dos quatro add-ons novos, aba `🧪 Extras` com demos (markdown, busca agregada,
  favoritos, health check) e Wikipédia na aba Textos (porta 5294).
- **`pnpm dev`** agora sobe também o servidor da Wikipédia (5294).

### Alterado

- `scripts/dev-all.mjs`: inicia o `addon-text-wikipedia` junto com os demais add-ons de texto.
- `tsconfig.json` do host-app: `noEmit` (o `tsc` do build não gera mais `.js` ao lado dos `.ts`).
- Docs: README, AGENTS, `docs/PHASES.md` (seção 3.4) e `docs/GLOSSARY.md`.
