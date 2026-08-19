# As Fases do Projeto — Do Simples ao Complexo

*Cada fase é um degrau. No final de cada uma, o sistema já funciona e faz alguma coisa útil.*

---

## Fase 1 — O Núcleo (Entregue ✅)

**Objetivo:** Um aplicativo que carrega add-ons.

### O que vai ser construído

#### 1.1 — O Domínio (tipos, validation, registry)
Arquivos: `packages/core/src/domain/`

O coração puro, sem dependência externa:
- **manifest.ts** — tipos do manifesto (AddonManifest, ServiceRegistration)
- **instance.ts** — AddonInstance (um add-on carregado)
- **host-api.ts** — o que o host oferece pro add-on
- **validation.ts** — função que valida manifesto
- **registry.ts** — o ServiceRegistry, que guarda e resolve serviços

#### 1.2 — As Portas (interfaces)
Arquivos: `packages/core/src/ports/`

Interfaces que o domínio espera do mundo exterior:
- **addon-loader.ts** — "preciso de algo que carregue add-ons"
- **logger.ts** — "preciso de algo que logue mensagens"

#### 1.3 — Os Adaptadores (implementações)
Arquivos: `packages/core/src/adapters/`

Implementações concretas que conectam o domínio ao mundo real:
- **http-loader.ts** — FetchAddonLoader: faz fetch, import(), setup
- **console-logger.ts** — ConsoleLogger: loga no console

#### 1.4 — Testes do Core
Testes unitários pra tudo. O domínio é testado sem fetch, sem I/O — puro.

#### 1.5 — Add-on Hello
O primeiro add-on de exemplo. Faz uma coisa simples: registra um serviço de saudação.

#### 1.6 — Add-on Counter
Segundo add-on de exemplo. Registra um serviço de contador (incrementar, decrementar, mostrar valor).

#### 1.7 — Host App
O aplicativo que junta tudo:
- Cria o registry e os adaptadores
- Carrega os add-ons
- Mostra numa lista o que foi carregado
- Permite invocar os serviços

#### 1.8 — Teste Manual
Abrir no navegador, ver os add-ons carregados, testar se funcionam.

---

## Fase 2 — Fallback e Domínio (Entregue ✅)

**Objetivo:** Serviços com fallback automático.

### O que foi construído

#### 2.1 — Interfaces Tipadas
Em vez de `registry.get("greeter")` devolver `unknown`, agora devolve um tipo específico: `registry.get<Greeter>("greeter")`. As interfaces `Greeter` e `Counter` estão definidas em `@addons/core`.

#### 2.2 — Fallback Automático
Se o serviço de maior prioridade falhar, o `withFallback()` tenta o próximo automaticamente. O host nem percebe. Se todos falharem, um `AggregateFallbackError` é lançado com todos os erros.

#### 2.3 — Add-on Concorrente
O `addon-hello-pt` registra o mesmo serviço `greeter` mas com prioridade 10 (maior que o hello padrão, que é 0). O host troca de implementação sem saber. Se você passar o nome "error", o hello-pt lança um erro, e o fallback automático usa o hello padrão.

#### 2.4 — Testes de Fallback
5 testes que verificam: prioridade, fallback em ação, erro total, implementação única, e nenhuma implementação.

---

## Fase 3 — Add-ons de Texto por HTTP (Entregue ✅)

**Objetivo:** Add-ons que são servidores de internet, estilo Stremio/Torrentio.

Aí vem a parte mais legal. A gente usou a interface do **Torrentio** (aquele add-on famoso do Stremio, que busca filmes) como referência — mas em vez de vídeo, **texto** (busca e conteúdo).

### O que foi construído

#### 3.0 — Um novo jeito de add-on: o add-on é um servidor
- Antes, um add-on era um código que o app importava (formato em-processo).
- Agora, um add-on pode ser um **servidor na internet**: ele tem uma URL, responde a pedidos HTTP, e o app conversa com ele por essa URL — exatamente como o Torrentio funciona no Stremio.

#### 3.1 — Manifesto estilo Stremio
O manifesto agora pode declarar `resources` (recursos): `catalog` (catálogo), `search` (busca), `text` (conteúdo). Também tem `types` (que tipo de conteúdo, ex.: `text`, `quote`, `poem`) e `catalogs` (listas anunciadas).

#### 3.2 — Os endpoints (as "portas" do servidor)
Um add-on de texto responde em rotas estilo Stremio:
- `GET /manifest.json` — se apresenta
- `GET /catalog/<type>/<id>.json` — lista de itens
- `GET /search/<type>/<query>.json` — busca
- `GET /text/<type>/<id>.json` — versões de um texto
- `GET /text/<type>/<id>/content.txt` — o conteúdo, em texto puro

#### 3.3 — Formato "subtitles" para o conteúdo
O Stremio entrega legendas assim: uma lista onde cada item tem uma `url` apontando pro arquivo. A gente copiou isso: o add-on de texto devolve `{ texts: [{ id, url, lang, name }] }`, e a `url` aponta pro conteúdo. O app busca a URL e mostra o texto.

#### 3.4 — Processamento externo (buscar na internet)
Como o Torrentio busca em indexadores de torrent, nossos add-ons de texto buscam em **APIs públicas**:
- **Biblioteca** (5291) — acervo de textos guardados dentro do próprio add-on
- **Citações** (5292) — busca na API DummyJSON
- **Poemas** (5293) — busca na API PoetryDB (cidades reais, busca de verdade)

#### 3.5 — Ferramentas novas
- `packages/addon-server` — um "mini-servidor" pronto, que o add-on de texto usa pra responder as rotas. Zero dependências.
- `HttpTextAddonClient` no core — a "central de chamadas" que o app usa pra falar com os add-ons remotos.
- Aba **📄 Textos** no app — lista os add-ons, navega catálogos, busca e lê.

#### 3.6 — Testes
77 testes no total: core (41), addon-server (7), biblioteca (8), citações (9), poemas (12).

#### 3.7 — Ainda falta (por enquanto)
- Cache do manifesto (pra não buscar toda hora)
- Version negotiation (combinar versão do host com a do add-on)

---

## Fase 4 — Resiliência (Planejado)

**Objetivo:** Nenhum add-on quebra o host.

### O que vai ser construído

#### 4.1 — Error Boundary
Cada chamada de serviço é isolada. Se um add-on falha, ele não leva os outros junto.

#### 4.2 — Preferências do Usuário
O usuário pode:
- Ligar/desligar add-ons
- Reordenar prioridade (arrastar na lista)
- As preferências são salvas

#### 4.3 — Sandbox (Investigação)
Estudo sobre usar Web Worker ou Iframe pra isolar completamente o add-on do host. Comunicação via mensagens.

---

## Resumo Visual

```
Fase 1: [████████████████░░] 80% — Núcleo funcionando
Fase 2: [████████████████░░] 80% — Fallback automático
Fase 3: [████████████████░░] 80% — Add-ons de texto por HTTP
Fase 4: [░░░░░░░░░░░░░░░░░░] 0%  — Resiliência
```

Cada fase depende da anterior. Mas cada uma é funcional por si só — no final de cada fase você já tem algo que roda.