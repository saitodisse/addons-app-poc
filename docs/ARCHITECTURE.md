# Arquitetura do addons-app-poc

**Status: Planejado** · **Versão: 1.0.0**

---

## 1. Visão Geral

A arquitetura segue o padrão de **inversão de controle via registry de serviços**. O host não conhece as implementações dos add-ons. Ele só conhece os IDs dos serviços. Os add-ons não conhecem o host — eles só conhecem o `HostAPI` que recebem no setup.

```
┌─────────────────────────────────────────────────────────┐
│                       Host App                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │               ServiceRegistry                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ greeter  │  │ counter  │  │  ...     │       │   │
│  │  │ [impl1]  │  │ [impl1]  │  │          │       │   │
│  │  │ [impl2]  │  │          │  │          │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘       │   │
│  └──────────────────────────────────────────────────┘   │
│                ▲                           ▲             │
│                │ setup(hostAPI)             │ get/getAll  │
│                ▼                           │             │
│  ┌──────────────────┐   ┌──────────────────┐│             │
│  │  addon-hello     │   │  addon-counter   ││             │
│  │  ┌────────────┐  │   │  ┌────────────┐  ││             │
│  │  │ manifest   │  │   │  │ manifest   │  ││             │
│  │  │ setup()    │──┼───┼──┤ setup()    │  ││             │
│  │  └────────────┘  │   │  └────────────┘  ││             │
│  └──────────────────┘   └──────────────────┘│             │
│                                              │             │
└──────────────────────────────────────────────┴─────────────┘
```

---

## 2. Camadas

### 2.1 Core (`@addons/core`)

O coração do sistema. Zero dependências externas. Organizado em três subcamadas seguindo Clean/Hexagonal leve:

```
packages/core/src/
├── domain/              # ← NÚCLEO. Regras de negócio PURAS.
│   ├── manifest.ts      #   AddonManifest, ServiceRegistration (value objects)
│   ├── instance.ts      #   AddonInstance (entity)
│   ├── registry.ts      #   ServiceRegistry (domain service)
│   ├── host-api.ts      #   HostAPI (port que o host implementa p/ o add-on)
│   └── validation.ts    #   validateManifest() — função pura, sem I/O
├── ports/               # ← Interfaces que o domínio espera do mundo externo
│   ├── addon-loader.ts  #   AddonLoaderPort
│   └── logger.ts        #   LoggerPort
└── adapters/            # ← Implementações concretas das portas
    ├── http-loader.ts   #   FetchAddonLoader (fetch + import())
    └── console-logger.ts
```

**Regra fundamental:** o `domain/` não importa nada de `ports/` ou `adapters/`. O domínio é puro. As portas são interfaces que o domínio espera. Os adapters são implementações que o mundo exterior fornece.

### 2.2 Add-ons (`@addons/addon-*`)

Módulos ESM independentes que exportam `manifest` e `setup`. Cada add-on:

1. Declara no manifesto quais serviços oferece
2. Implementa os serviços de acordo com as interfaces do domínio
3. No `setup`, registra os serviços no `HostAPI.services`

### 2.3 Host App (`@addons/host-app`)

Aplicação React que atua como **adaptador de UI**:

1. Instancia um `ServiceRegistry`
2. Injeta adaptadores concretos (FetchAddonLoader, ConsoleLogger) no loader
3. Carrega add-ons via `AddonLoaderPort`
4. Chama `setup` de cada add-on com o `HostAPI`
5. Usa os serviços registrados para interagir com o usuário
6. Exibe status dos add-ons na interface

---

## 3. Fluxo de Carregamento de um Add-on

```
1. Host obtém URL do manifesto
2. Host faz fetch do manifesto
3. Host valida o manifesto (validation.validateManifest())
4. Se inválido → loga erro, não carrega
5. Host faz import(entrypoint) do bundle
6. Se import falhar → loga erro, não carrega
7. Host verifica se o módulo exporta manifest e setup
8. Se faltar algo → loga erro, não carrega
9. Host chama setup(hostAPI)
10. Se setup lançar exceção → marca add-on como error, descarta registros
11. Se setup sucesso → add-on fica ready
```

---

## 4. Fluxo de Resolução de Serviço

```
1. Host chama registry.get("greeter")
2. Registry busca implementações registradas para "greeter"
3. Ordena por prioridade (decrescente)
4. Retorna a implementação de maior prioridade
   ─ ou ─
1. Host chama registry.getAll("greeter")
2. Registry retorna array ordenado por prioridade
3. Host itera e tenta cada uma até uma funcionar (fallback manual)
   ─ ou (Fase 2) ─
1. Registry tem fallback automático
2. Tenta a de maior prioridade
3. Se falhar, tenta a próxima
4. Se todas falharem, lança exceção
```

---

## 5. Modelo de Dados

### AddonManifest

```typescript
interface AddonManifest {
  id: string;              // Identificador amigável, ex: "hello"
  version: string;         // Versão semântica, ex: "1.0.0"
  name: string;            // Nome para exibição
  description: string;     // Descrição do que o add-on faz
  author: string;          // Nome do autor
  icon?: string;           // URL do ícone
  license: string;         // Licença, ex: "MIT"
  // Formato em-processo (Fases 1–2):
  entrypoint?: string;     // URL do bundle ESM
  services?: ServiceRegistration[];
  // Formato Stremio/HTTP (Fase 3):
  resources?: AddonResource[];   // { name, types, idPrefixes? }
  types?: string[];              // ex.: ["text"], ["quote"]
  idPrefixes?: string[];
  catalogs?: AddonCatalog[];     // { type, id, name }
}
```

### AddonResource / AddonCatalog (formato Stremio)

```typescript
type AddonResourceName = 'catalog' | 'search' | 'text' | 'meta' | 'subtitles' | 'stream';

interface AddonResource {
  name: AddonResourceName;
  types: string[];       // tipos de conteúdo atendidos
  idPrefixes?: string[]; // ex.: ['tt'] como o IMDb no Torrentio
}

interface AddonCatalog {
  type: string;
  id: string;
  name: string;
}
```

### ServiceRegistration

```typescript
interface ServiceRegistration {
  id: string;              // ID do serviço, ex: "greeter"
  version: string;         // Versão do serviço
  name: string;            // Nome amigável
  description: string;     // Descrição do serviço
}
```

### ServiceEntry

```typescript
interface ServiceEntry<T = unknown> {
  serviceId: string;
  instance: T;
  addonId: string;         // URL do manifesto do add-on de origem
  priority: number;        // Prioridade (maior = mais preferido)
}
```

### AddonInstance

```typescript
interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;     // URL do manifesto (identidade)
  status: 'loading' | 'ready' | 'error';
  error?: Error;
  services: string[];      // IDs dos serviços registrados
}
```

### HostAPI

```typescript
interface HostAPI {
  services: ServiceRegistry;
  onUnload: (callback: () => void) => void;
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}
```

---

## 6. ServiceRegistry — API

```typescript
class ServiceRegistry {
  register<T>(serviceId: string, instance: T, addonId: string, priority?: number): void;
  unregister(serviceId: string, addonId: string): void;
  get<T>(serviceId: string): T | undefined;
  getAll<T>(serviceId: string): T[];
  has(serviceId: string): boolean;
  clear(): void;
  clearAddon(addonId: string): void;
}
```

---

## 7. Dependências entre Pacotes

```
@addons/host-app
    ↓ depende de
@addons/core
    ↑
    | (implementa interfaces)
    |
@addons/addon-hello    @addons/addon-counter
    ↓ depende de            ↓ depende de
@addons/core            @addons/core
```

Add-ons dependem de `@addons/core` para os tipos. O host-app depende de `@addons/core` para o registry e loader. Add-ons **não** dependem do host-app. O host-app **não** depende de add-ons em tempo de compilação.

---

## 7.1 Add-ons de Texto (formato Stremio/HTTP)

A partir da Fase 3, um add-on pode ser um **servidor HTTP** — inspirado no protocolo Stremio (referência: Torrentio), adaptado para compartilhamento de textos.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Host App (navegador)                          │
│                                                                      │
│   HttpTextAddonClient ── GET /manifest.json ──────────────────┐      │
│   HttpTextAddonClient ── GET /catalog/<type>/<id>.json ──────┼──┐   │
│   HttpTextAddonClient ── GET /search/<type>/<query>.json ────┼──┼─┐ │
│   HttpTextAddonClient ── GET /text/<type>/<id>.json ─────────┼──┼─┼>│
│   fetch(item.url) ────── GET /text/<type>/<id>/content.txt ──┼──┼─┼>│
└──────────────────────────────────────────────────────────────┼──┼──┼─┘
                                                               │  │  │
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │  │  │
        │ biblioteca   │   │ citacoes     │   │ poemas       │  │  │  │
        │ :5291        │   │ :5292        │   │ :5293        │  │  │  │
        │ (embutido)   │   │ (DummyJSON)  │   │ (PoetryDB)   │  │  │  │
        └──────────────┘   └──────────────┘   └──────────────┘  │  │  │
                                                               │  │  │
   Processamento externo: citacoes/poemas fazem fetch de APIs   │  │  │
   públicas (assim como o Torrentio busca em indexadores).      │  │  │
   Todos os add-ons servem CORS * para o host-app (:5280).      │  │  │
└───────────────────────────────────────────────────────────────┴──┴──┴─┘
```

**Fluxo:**

1. O host conhece a **URL base** de cada add-on de texto (URL = identidade)
2. `HttpTextAddonClient.getManifest(baseUrl)` busca e valida o manifesto (resources declarados)
3. O usuário navega catálogos ou busca: `catalog()` / `search()` retornam `{ metas: [...] }`
4. Ao abrir um item, `text()` retorna `{ texts: [...] }` — **formato subtitles**: cada item tem `url` apontando para o conteúdo
5. O host faz `fetch(item.url)` e exibe o texto puro

**Camadas novas no core:**

```
packages/core/src/
├── domain/
│   ├── manifest.ts   # + AddonResource, AddonCatalog (formato Stremio)
│   └── text.ts       # TextItem, TextMeta, TextCatalogPayload, TextPayload
├── ports/
│   └── text-addon-client.ts   # TextAddonClientPort
└── adapters/
    └── http-text-client.ts    # HttpTextAddonClient (fetch injetável)
```

**Pacote novo:** `@addons/addon-server` — framework Node (zero dependências) que monta o servidor HTTP de um add-on a partir de `manifest` + `handlers` (`catalog`, `search`, `text`, `content`), com CORS habilitado. Os add-ons de texto são **JS puro** e não arrastam o runtime TS do core — apenas reusam o formato de endpoints.

**ADRs adicionais:**

### ADR-006: Add-on pode ser servidor HTTP (formato Stremio)
**Contexto:** O usuário pediu add-ons que respondem HTTP/API e fazem busca/processamento externo, usando como referência a interface do Torrentio no Stremio.
**Decisão:** O manifesto ganhou um segundo formato: `resources` + `types` + `catalogs`. O add-on é um servidor HTTP que atende `/<resource>/<type>/<id>.json`. O formato em-processo (`services`) permanece suportado.
**Consequência:** Add-ons podem ser implantados em qualquer lugar (como o Torrentio é), e o host os consome via HTTP sem importar código.

### ADR-007: Recurso text no formato subtitles
**Contexto:** Precisávamos de um padrão de resposta para conteúdo de texto.
**Decisão:** Espelhamos o recurso `subtitles` do Stremio: `{ texts: [{ id, url, lang, name }] }`, onde `url` aponta para o conteúdo servido em texto puro. O host busca a URL separadamente.
**Consequência:** O mesmo padrão já validado pelo ecossistema Stremio; o host controla quando baixar o conteúdo.

### ADR-008: Servidor de add-on em JS puro
**Contexto:** O core é TypeScript e não roda direto no Node sem build.
**Decisão:** `@addons/addon-server` e os add-ons de texto são JavaScript puro (ESM), com validação mínima de manifesto própria (a canônica vive no core).
**Consequência:** Add-ons implantados não dependem do toolchain TS do core.

---

## 8. Tratamento de Erros

| Onde | Erro | Comportamento |
|------|------|---------------|
| Fetch do manifesto | URL inválida / offline | Add-on não carrega, loga erro |
| Validação do manifesto | Campos faltando / tipos errados | Add-on não carrega, loga erro |
| `import()` do bundle | Bundle corrompido / URL inválida | Add-on não carrega, loga erro |
| `setup()` | Exceção no setup | Add-on marcado como `error`, registros descartados |
| Chamada de serviço | Exceção no serviço | Fallback para próxima implementação (Fase 2) |

Nenhum erro em nenhum desses pontos quebra o host. O host continua funcionando normalmente.

---

## 9. Considerações de Segurança

- Add-ons são executados no mesmo contexto que o host (sem sandbox na Fase 1)
- O `HostAPI` limita o que o add-on pode fazer
- O add-on não recebe acesso ao DOM, ao `window`, ou ao `document`
- A segurança real (sandbox em Web Worker/Iframe) é investigação futura

---

## 10. Decisões Arquiteturais (ADRs)

### ADR-001: URL como identidade
**Contexto:** Precisávamos de um identificador único para cada add-on.
**Decisão:** A URL do manifesto é a identidade. Não há namespace, não há ID único global.
**Consequência:** Dois manifests na mesma URL são o mesmo add-on. Mudar de URL = add-on diferente.

### ADR-002: Manifest + Setup separados
**Contexto:** Precisávamos inspecionar o add-on antes de executá-lo.
**Decisão:** O add-on exporta `manifest` (dados) e `setup` (função) separadamente.
**Consequência:** O host pode ler o manifesto sem executar código do add-on.

### ADR-003: Prioridade explícita no registro
**Contexto:** Precisávamos de uma forma determinística de resolver conflitos entre add-ons.
**Decisão:** Cada registro tem um número de prioridade. O usuário pode reordenar.
**Consequência:** Resolução previsível e controlável pelo usuário.

### ADR-004: Zero dependências no core
**Contexto:** O core deve ser portável para qualquer projeto.
**Decisão:** `@addons/core` não depende de React, Vite, ou qualquer framework.
**Consequência:** Qualquer aplicação TypeScript pode usar o protocolo.

### ADR-005: Clean/Hexagonal leve no core
**Contexto:** O core original misturava regras de negócio com detalhes de infraestrutura (loader, logger).
**Decisão:** Separar o core em `domain/` (regras, tipos, serviços puros), `ports/` (interfaces que o domínio espera), e `adapters/` (implementações concretas das portas).
**Consequência:** O domínio pode ser testado isoladamente sem mock de fetch, I/O, ou React. Trocas de implementação (ex: HTTP loader → cache loader) viram apenas um novo adapter.