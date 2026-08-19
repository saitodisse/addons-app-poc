# Planejamento — A Conversa Completa

Este documento registra **toda a conversa de planejamento** que levou à criação deste projeto. Cada seção representa uma etapa da discussão, desde o insight inicial até as decisões finais do *grilling*.

---

## 1. O Contexto Original

O projeto nasceu dentro do ecossistema **AC** — um monorepo de coordenação em `/home/saito/_git/ac` que reúne cinco repositórios Git independentes:

- **achorde** — pacotes públicos e contratos compartilhados (musical-domain, source-catalog, tab-renderer, svguitar-react, etc.)
- **ac15** — produto privado com apps/web, sync-engine, storage
- **artist-portal-base** — base pública para portais de artista
- **ac12-catalog-portal** — portal do acervo AC12
- **achorde-contribution-gateway** — API de contribuições (desativada)

A arquitetura atual desses projetos usa dependências diretas entre pacotes — `import` em tempo de compilação. Para trocar uma implementação por outra, é preciso modificar o código e rebuildar.

---

## 2. O Insight do Cordis

A conversa começou com uma pergunta: **"Como usar o Cordis para deixar todos os pacotes do AC intercambiáveis?"**

O Cordis é um framework IoC (Inversion of Control) usado pelo DeepSeek Harness. Ele permite que plugins se registrem por `id` + `name`, declarem dependências com `inject`, e sejam compostos via arquivos YAML de configuração. A ideia era aplicar esse mesmo padrão no AC — um container onde cada pacote se registra por um nome, e quem consome pede pelo nome, não pela implementação.

Isso já resolveria o problema de intercambialidade técnica. Mas a conversa foi além.

---

## 3. O Paralelo com o Stremio

O usuário trouxe o Stremio como metáfora, e rapidamente ficou claro que não era apenas uma metáfora — era um **padrão arquitetural completo**.

O Stremio tem quatro camadas independentes:

| Camada | O que é | No Stremio |
|--------|---------|------------|
| 1 | Player/UI | O aplicativo em si, open source, lojas oficiais |
| 2 | Add-ons | Torrentio, KnightCrawler — scripts independentes |
| 3 | Cache | Real-Debrid — cache gigante e rápido |
| 4 | Armazenamento distribuído | Rede BitTorrent + DHT — sem servidor central |

Cada camada é independente. Derrubar uma não afeta as outras. O código do Stremio é legal e está em lojas oficiais. Os add-ons são mantidos pela comunidade. O cache é comercial mas substituível. O armazenamento distribuído não tem ponto central de falha.

O que torna o sistema **indestrutível** não é uma tecnologia específica. É o **desenho das camadas**.

---

## 4. O Mapeamento para o AC

A conversa mapeou cada camada do Stremio para o ecossistema AC:

| Stremio | AC |
|---------|-----|
| Player | catalog-portal, ac15-web, artist-portal-base |
| IMDb IDs | `@achorde/musical-domain` — tipos e contratos |
| Add-ons (Torrentio, etc.) | Renderizadores, editores, provedores de catálogo |
| Real-Debrid | Dexie/IndexedDB, cache local |
| DHT | sync-engine (sincronização entre dispositivos) |

O insight fundamental: o que o AC precisa não é de um sistema de DI (injeção de dependência) mais sofisticado. O que o AC precisa é de um **sistema de add-ons** — porque um sistema de add-ons oferece três coisas que DI não oferece:

1. **Descoberta** — add-ons são encontrados via manifesto público, não via código
2. **Isolamento** — a falha de um add-on não quebra o core
3. **Escolha do usuário** — quem decide qual add-on está ativo é o usuário, não o desenvolvedor

---

## 5. As Interfaces de Extensão

Foram identificadas cinco famílias de add-ons no ecossistema AC:

1. **Renderização de diagramas** — SVGuitar, tab-renderer, interactive-fretboard, visualização 3D
2. **Editores de chord chart** — tab-editor, editor visual, editor Monaco
3. **Provedores de catálogo** — source-catalog, contribution-protocol, arquivo local, API remota
4. **Mecanismos de busca** — local, remota, difusa, por artista, por tom
5. **Armazenamento e cache** — IndexedDB, SQLite, API remota, IPFS

Cada família define uma **interface TypeScript pura**. Qualquer add-on que implemente a interface pode ser plugado.

---

## 6. A Estrutura do Manifesto

O manifesto de um add-on é um JSON que declara:

- **Identidade**: `id`, `version`, `name`, `description`, `author`, `icon`, `license`
- **Técnico**: `entrypoint` (URL do bundle), `services[]` (lista de serviços oferecidos)
- **Compatibilidade**: `hostVersion` (versão do host requerida), `dependencies` (dependências externas)

Cada serviço declarado tem `id`, `version`, `name`, `description`.

---

## 7. O Mecanismo de Descoberta

Quatro formas de um add-on ser descoberto:

1. **Catálogo central** — repositório público de manifests
2. **Instalação direta** — usuário cola a URL do manifesto
3. **Escopo de npm** — pacotes com keyword `ac-addon`
4. **Registro federado** — múltiplos catálogos independentes

---

## 8. O Carregamento Dinâmico

O add-on é um bundle JavaScript ESM. O host faz:

```
const module = await import(url)
module.setup(hostAPI)
```

Se o carregamento falhar, o add-on é ignorado. Se o setup falhar, o add-on é desativado. Se o serviço falhar em uso, o fallback assume.

---

## 9. A Cadeia de Fallback

Cada serviço tem uma lista ordenada de implementações. Quando o host precisa de um serviço:

1. Tenta a primeira implementação (maior prioridade)
2. Se falhar, tenta a segunda
3. Se falhar, tenta a terceira
4. No final da cadeia, sempre tem uma implementação padrão

O usuário pode reordenar a lista de preferências.

---

## 10. O Cenário Concreto (Add-on do Joaquim)

Joaquim é um desenvolvedor que criou um visualizador de acordes em 3D. Ele:

1. Cria um pacote que depende apenas de `@achorde/musical-domain`
2. Implementa a interface `ChordDiagramRenderer`
3. Publica o manifesto num GitHub Pages
4. Publica o bundle num CDN gratuito
5. Avisa num fórum da comunidade

Um usuário cola a URL do manifesto no gerenciador de add-ons. O portal carrega, valida, registra. Pronto. Joaquim não precisou de permissão de ninguém.

---

## 11. As Quatro Camadas de Indestrutibilidade do AC

Aplicando o padrão Stremio ao AC:

| Camada | O que é | Resiliente porque |
|--------|---------|-------------------|
| 1 | Portais (catalog-portal, ac15-web) | Código aberto, qualquer um deploya |
| 2 | Add-ons (renderizadores, editores, provedores) | Independentes, fallback automático |
| 3 | Tipos e interfaces (`@achorde/musical-domain`) | Só TypeScript, sem servidor, distribuído via npm |
| 4 | Armazenamento (IndexedDB, servidor AC12, IPFS) | Múltiplas fontes, configurável por add-on |

---

## 12. A Decisão de Criar um POC

Depois de toda a discussão arquitetural, a decisão foi: **não tentar implementar isso dentro do AC existente**. Em vez disso, criar um projeto separado — uma prova de conceito — que pudesse validar o protocolo antes de qualquer migração.

Nasceu o `addons-app-poc`.

---

## 13. O Grilling — 13 Perguntas, 13 Decisões

Antes de implementar, cada aspecto do design foi questionado e resolvido:

### Pergunta 1 — Identidade
**Decisão:** A URL do manifesto é a identidade única do add-on.

### Pergunta 2 — Ciclo de Vida
**Decisão:** Add-on exporta `manifest` (declaração) + `setup` (inicialização). O host lê o manifesto antes de executar o setup.

### Pergunta 3 — HostAPI
**Decisão:** `HostAPI` contém `services` (registry), `onUnload` (cleanup), `log` (debugging). Sem acesso ao DOM ou router na Fase 1.

### Pergunta 4 — Resolução de Serviços
**Decisão:** Prioridade explícita no registro + reordenação pelo usuário. `get()` retorna o de maior prioridade. `getAll()` retorna todos ordenados para fallback.

### Pergunta 5 — Erro no Setup
**Decisão:** Add-on é marcado como `error`, registros parciais descartados, host continua.

### Pergunta 6 — Erro no Serviço
**Decisão:** Fallback automático — registry tenta o próximo da lista. O host não vê o erro.

### Pergunta 7 — Formato do Manifesto
**Decisão:** Completo com metadados de exibição (nome, descrição, autor, ícone, licença).

### Pergunta 8 — Bundling
**Decisão:** ESM puro com Vite. `import()` nativo do navegador.

### Pergunta 9 — Localização dos Add-ons na Fase 1
**Decisão:** No mesmo workspace, Vite resolve os imports entre pacotes automaticamente.

### Pergunta 10 — Testes
**Decisão:** Unitários no `core` (registry, validation, loader). Integração manual no host.

### Pergunta 11 — Estrutura de Diretórios
**Decisão:** `packages/core`, `packages/host-app`, `packages/addon-hello`, `packages/addon-counter`.

### Pergunta 12 — Nomes dos Pacotes
**Decisão:** `@addons/core`, `@addons/host-app`, `@addons/addon-hello`, `@addons/addon-counter`.

### Pergunta 13 — Ordem de Implementação
**Decisão:** manifest → validation → registry → testes → loader → testes → addon-hello → addon-counter → host-app → teste manual.

---

## 14. A Estrutura Final

```
addons-app-poc/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── AGENTS.md
├── docs/
│   ├── PLANNING.md          (este arquivo)
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── MANIFEST-SPEC.md
│   ├── PHASES.md
│   └── GLOSSARY.md
└── packages/
    ├── core/
    │   └── src/
    │       ├── index.ts
    │       ├── manifest.ts
    │       ├── registry.ts
    │       ├── loader.ts
    │       └── validation.ts
    ├── host-app/
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx
    │       └── components/
    │           ├── AddonList.tsx
    │           └── AddonViewer.tsx
    ├── addon-hello/
    │   └── src/index.ts
    └── addon-counter/
        └── src/index.ts
```

---

## 15. Status Atual

**Fase 1 — Planejamento Concluído** ✅

A documentação está completa. A implementação está prestes a começar, seguindo a ordem definida na Pergunta 13.

---

## 16. A Evolução Depois do Planejamento

O planejamento original (seções 1–15) cobria até a Fase 2. A conversa continuou e o projeto evoluiu em três movimentos, todos registrados aqui para o histórico.

### 16.1 Fase 2 Entregue (fallback + interfaces tipadas)

- `Greeter` e `Counter` em `domain/interfaces.ts` — add-ons implementam interfaces explicitamente
- `withFallback(registry, serviceId, fn)` — cadeia de fallback sincrona com `AggregateFallbackError`
- `addon-hello-pt` registra o mesmo serviço `greeter` com prioridade 10, criando concorrência real
- Vitest com `SilentLogger` para testes sem poluição de stdout/stderr

### 16.2 App Visual Interativo

- O host-app ganhou abas: Saudação, Contador, Fallback, Inspetor
- Add-ons são carregados por importação estática de pacotes do workspace (`@addons/addon-hello`, etc.)
- `AddonManager` permite instalar/remover add-ons do catálogo

### 16.3 A Virada para o Torrentio (add-ons de texto por HTTP)

O usuário pediu: **"crie um servidor para cada add-on"**, e em seguida: **"pense na interface do Torrentio para o Stremio, use como referência"** — mas adaptado para **compartilhamento de textos** (busca, conteúdo), não vídeo.

O paralelo ficou explícito:

| Torrentio no Stremio | Add-ons de texto no POC |
|----------------------|------------------------|
| Add-on = servidor HTTP | Add-on = servidor HTTP (portas 5291–5293) |
| Manifest declara `resources` (stream/meta) | Manifest declara `resources` (catalog/search/text) |
| Responde `GET /stream/<type>/<id>.json` | Responde `GET /text/<type>/<id>.json` |
| Devolve `{ streams: [...] }` | Devolve `{ texts: [...] }` (formato subtitles) |
| Busca em indexadores de torrent | Busca em APIs públicas (DummyJSON, PoetryDB) |
| Recurso `subtitles` devolve `url` para o arquivo SRT | Recurso `text` devolve `url` para o conteúdo em texto puro |

**Decisões desta etapa:**

1. O manifesto ganhou um segundo formato (Stremio): `resources` + `types` + `idPrefixes` + `catalogs`. O formato em-processo (`services` + `entrypoint`) continua válido — `validateManifest` aceita os dois.
2. `@addons/addon-server` — framework Node com zero dependências que monta o servidor do add-on a partir de `manifest` + `handlers` (catalog/search/text/content), com CORS habilitado.
3. `HttpTextAddonClient` no core — cliente que consome add-ons remotos (port + adapter com fetch injetável).
4. O recurso `text` espelha o formato `subtitles` do Stremio: `{ texts: [{ id, url, lang, name }] }` — a URL aponta para o conteúdo servido em texto puro, e o host busca separadamente.
5. Add-ons de texto são **JS puro** (não arrastam o runtime TS do core) — o servidor tem validação mínima própria.
6. Três add-ons de exemplo: biblioteca (acervo embutido), citações (API DummyJSON) e poemas (API PoetryDB com busca real — escolhida a partir do repositório `public-apis`).
7. Host-app ganhou a aba **Textos**: lista add-ons remotos, navega catálogos, busca e lê conteúdo.

**Status: Fase 3.0 Entregue** · 77 testes passando (core 41, addon-server 7, biblioteca 8, citações 9, poemas 12).

---

*Este documento foi gerado em 2025 como parte do addons-app-poc.*