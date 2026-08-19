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
| `@addons/core` | O protocolo central: tipos do manifesto, registry de serviços, loader dinâmico, validação |
| `@addons/host-app` | Um aplicativo React mínimo que carrega e gerencia add-ons |
| `@addons/addon-hello` | Add-on de exemplo que registra um serviço de saudação |
| `@addons/addon-counter` | Add-on de exemplo que registra um serviço de contador |

---

## Índice Completo do Projeto

| Caminho | O que é |
|---------|---------|
| `README.md` | Este arquivo — visão geral do projeto |
| `AGENTS.md` | Regras e convenções para agentes de IA que trabalham aqui |
| `packages/core/` | **`@addons/core`** — o protocolo central: tipos do manifesto, registry, loader, validação |
| `packages/host-app/` | **`@addons/host-app`** — aplicativo React mínimo que carrega add-ons |
| `packages/addon-hello/` | **`@addons/addon-hello`** — add-on de exemplo (serviço de saudação) |
| `packages/addon-counter/` | **`@addons/addon-counter`** — add-on de exemplo (serviço de contador) |
| `docs/ARCHITECTURE.md` | Arquitetura do sistema — camadas, fluxos, modelos, ADRs |
| `docs/GLOSSARY.md` | Dicionário de todos os termos técnicos do projeto |
| `docs/MANIFEST-SPEC.md` | Especificação completa do formato do manifesto de add-on |
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