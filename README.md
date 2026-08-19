# addons-app-poc

**Uma prova de conceito de um sistema de add-ons universal, inspirada no ecossistema do Stremio e construída sobre TypeScript.**

Este projeto é uma demonstração prática de como construir um sistema de add-ons do zero — um protocolo onde qualquer desenvolvedor pode criar, publicar e distribuir extensões independentes para um aplicativo host, sem precisar de acesso ao repositório central.

---

## Por que isso existe?

A arquitetura tradicional de plugins depende de um ponto central de controle — um repositório oficial, um marketplace autorizado, uma API privada. O Stremio provou que existe uma alternativa melhor: um ecossistema onde **cada add-on é independente**, **descoberto por URL**, e **substituível sem quebrar o sistema**.

Este POC traduz essa lição para o universo do TypeScript e aplicações web modernas.

---

## O Que Este Projeto Contém

| Pacote | Descrição |
|--------|-----------|
| `@addons/core` | O protocolo central: **domain/** (regras puras), **ports/** (interfaces), **adapters/** (implementações) |
| `@addons/host-app` | Um aplicativo React mínimo que carrega e gerencia add-ons |
| `@addons/addon-hello` | Add-on de exemplo que registra um serviço de saudação |
| `@addons/addon-hello-pt` | Add-on de exemplo (saudação com prioridade 10) |
| `@addons/addon-counter` | Add-on de exemplo que registra um serviço de contador |
| `@addons/addon-server` | Framework Node (zero dependências) que serve um add-on de texto por HTTP, estilo Stremio |
| `@addons/addon-text-biblioteca` | Add-on de texto (porta 5291) — acervo embutido com catálogo, busca e leitura |
| `@addons/addon-text-citacoes` | Add-on de texto (porta 5292) — citações com **processamento externo** (API DummyJSON) |
| `@addons/addon-text-poemas` | Add-on de texto (porta 5293) — poemas com **processamento externo e busca** (API PoetryDB) |

---

## Como Rodar

```bash
pnpm install

# Sobe tudo de uma vez: host app (http://localhost:5280)
# + servidores dos add-ons de texto (5291 biblioteca, 5292 citações, 5293 poemas)
pnpm dev

# Encerra todos os processos do dev (host app + add-ons de texto)
pnpm kill-all
```

> **No WSL2:** o `pnpm dev` detecta WSL, não tenta abrir o navegador (o browser fica no Windows) e o Vite escuta em `0.0.0.0`. Abra manualmente **http://localhost:5280/** no navegador do Windows.

No host app, abra a aba **📄 Textos**: os três add-ons remotos aparecem automaticamente. Navegue catálogos, faça buscas (os add-ons de citações e poemas buscam em APIs públicas na web) e leia o conteúdo.

```bash
pnpm test   # todos os testes (core + addon-server + add-ons)
```

---

## Índice Completo do Projeto

| Caminho | O que é |
|---------|---------|
| `README.md` | Este arquivo — visão geral do projeto |
| `AGENTS.md` | Regras e convenções para agentes de IA que trabalham aqui |
| `packages/core/` | **`@addons/core`** — domain/ (regras), ports/ (interfaces), adapters/ (implementações) |
| `packages/host-app/` | **`@addons/host-app`** — aplicativo React mínimo que carrega add-ons |
| `packages/addon-hello/` | **`@addons/addon-hello`** — add-on de exemplo (serviço de saudação) |
| `packages/addon-hello-pt/` | **`@addons/addon-hello-pt`** — add-on de exemplo (saudação, prioridade 10) |
| `packages/addon-counter/` | **`@addons/addon-counter`** — add-on de exemplo (serviço de contador) |
| `packages/addon-server/` | **`@addons/addon-server`** — framework Node que serve manifest.json + endpoints de resource estilo Stremio |
| `packages/addon-text-biblioteca/` | **`@addons/addon-text-biblioteca`** — add-on de texto (5291): catálogo + busca + leitura |
| `packages/addon-text-citacoes/` | **`@addons/addon-text-citacoes`** — add-on de texto (5292): citações via API externa |
| `packages/addon-text-poemas/` | **`@addons/addon-text-poemas`** — add-on de texto (5293): poemas via API externa com busca |
| `docs/ARCHITECTURE.md` | Arquitetura do sistema — camadas, fluxos, modelos, ADRs |
| `docs/GLOSSARY.md` | Dicionário de todos os termos técnicos do projeto |
| `docs/MANIFEST-SPEC.md` | Especificação completa do formato do manifesto de add-on (em-processo + Stremio) |
| `docs/PHASES.md` | Divisão do projeto em fases, do simples ao complexo |
| `docs/PLANNING.md` | Histórico completo da conversa de planejamento |
| `docs/PRD.md` | Documento de requisitos do produto |
| `docs/docs-17yrs/README.md` | Visão geral do projeto em linguagem simples para iniciantes |
| `docs/docs-17yrs/AGENTS.md` | Regras para IA explicadas sem juridiquês |
| `docs/docs-17yrs/RESUMO-PLANO.md` | As 13 decisões do projeto explicadas uma a uma, passo a passo |
| `docs/docs-17yrs/ARCHITECTURE.md` | Arquitetura explicada com analogias e diagrama ASCII |
| `docs/docs-17yrs/GLOSSARY.md` | Dicionário em frases curtas, um termo por linha |
| `docs/docs-17yrs/MANIFEST-SPEC.md` | O manifesto campo por campo, com exemplos |
| `docs/docs-17yrs/PHASES.md` | Fases explicadas em ordem crescente de complexidade |
| `docs/docs-17yrs/PLANNING.md` | A história completa em 11 capítulos narrativos |
| `docs/docs-17yrs/PRD.md` | Requisitos em formato de checklist simples |

---

MIT