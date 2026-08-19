# Fases do Projeto

**Status: Planejado**

---

Este documento detalha cada fase do projeto, do mais simples ao mais complexo. Cada fase é **funcional por si só** — ao final de cada uma, você tem um sistema que roda e demonstra o que foi construído até ali.

---

## Fase 1 — Núcleo do Protocolo + App Base

**Status: Em Andamento** · **Objetivo: Um aplicativo que carrega add-ons**

### 1.1 Core — Domain (Manifest, Instance, HostAPI)

**Arquivos:** `packages/core/src/domain/manifest.ts`, `instance.ts`, `host-api.ts`

Criar os tipos Value Object e Entity do domínio:

- `AddonManifest` — value object com todos os campos do manifesto
- `ServiceRegistration` — value object com id, version, name, description
- `ServiceEntry<T>` — entrada no registry (instância, addonId, prioridade)
- `AddonInstance` — entity com identidade (manifestUrl), status, erro, serviços
- `HostAPI` — port que o host implementa: services, onUnload, log
- `AddonModule` — interface do que um add-on exporta (manifest + setup)

### 1.2 Core — Domain (Validation)

**Arquivo:** `packages/core/src/domain/validation.ts`

Função pura (sem I/O, sem efeito colateral):

- `validateManifest(data: unknown): { valid: boolean; errors: string[] }`
- Validar campos obrigatórios
- Validar formato de versão semântica
- Validar URL do entrypoint
- Validar estrutura dos serviços

### 1.3 Core — Domain (Registry)

**Arquivo:** `packages/core/src/domain/registry.ts`

Domain service — lógica de negócio pura:

- `class ServiceRegistry`
- `register<T>(serviceId, instance, addonId, priority?)` — registra um serviço
- `unregister(serviceId, addonId)` — remove um registro
- `get<T>(serviceId)` — retorna a implementação de maior prioridade
- `getAll<T>(serviceId)` — retorna todas ordenadas por prioridade
- `has(serviceId)` — verifica se há pelo menos uma implementação
- `clear()` — remove todos os registros
- `clearAddon(addonId)` — remove todos os registros de um add-on

### 1.4 Core — Ports

**Arquivos:** `packages/core/src/ports/addon-loader.ts`, `logger.ts`

Interfaces que o domínio espera do mundo externo:

- `AddonLoaderPort` — interface com `load(manifestUrl): Promise<AddonInstance>`
- `LoggerPort` — interface com `log(level, message): void`

### 1.5 Core — Adapters

**Arquivos:** `packages/core/src/adapters/http-loader.ts`, `console-logger.ts`

Implementações concretas das portas:

- `FetchAddonLoader` — faz fetch do manifesto + import() do bundle + validação + setup
- `ConsoleLogger` — implementa LoggerPort usando console.log

### 1.6 Core — Index

**Arquivo:** `packages/core/src/index.ts`

Re-exportar tudo que é público: domain, ports, adapters.

### 1.7 Testes do Core

**Arquivos:** `packages/core/src/**/*.test.ts`

- **Domain/Registry:** register, unregister, get, getAll, prioridade, fallback, limpeza
- **Domain/Validation:** manifesto válido, inválido, campos faltando, versão inválida
- **Adapters/Loader:** mock de fetch, mock de import(), erro não quebra
- **Domínio testado com mocks das portas** — sem fetch real, sem I/O real

### 1.8 Add-on Hello

**Arquivo:** `packages/addon-hello/src/index.ts`

- Exportar `manifest` com serviço `"greeter"`
- Exportar `setup` que registra um serviço `greeter`
- O serviço `greeter` tem um método `greet(name: string): string`

### 1.9 Add-on Counter

**Arquivo:** `packages/addon-counter/src/index.ts`

- Exportar `manifest` com serviço `"counter"`
- Exportar `setup` que registra um serviço `counter`
- O serviço `counter` tem métodos `increment()`, `decrement()`, `getValue(): number`

### 1.10 Host App

**Arquivos:** `packages/host-app/src/`

- App React que instancia ServiceRegistry, FetchAddonLoader, ConsoleLogger
- Injeta os adaptadores no loader
- Carrega add-ons de uma lista pré-configurada
- `AddonList.tsx` — mostra add-ons instalados com status
- `AddonViewer.tsx` — detalhes de um add-on e botão para invocar serviços
- UI simples, funcional, sem estilo elaborado

### 1.11 Teste Manual

- Abrir host-app no navegador
- Ver add-ons carregados
- Invocar greeter e ver resultado
- Invocar counter e ver valor mudar

---

## Fase 2 — Interfaces de Domínio + Cadeia de Fallback

**Status: Entregue** · **Objetivo: Serviços tipados com fallback automático**

### 2.1 Interfaces Tipadas ✅

- `Greeter` — `greet(name: string): string`
- `Counter` — `increment()`, `decrement()`, `getValue()`, `reset()`
- Definidas em `packages/core/src/domain/interfaces.ts` e exportadas pelo `@addons/core`

### 2.2 Fallback Chain ✅

- `withFallback<T,R>(registry, serviceId, fn)` — tenta cada implementação em ordem
- Se a primeira falhar, tenta a próxima
- Se todas falharem, lança `AggregateFallbackError`
- 5 testes unitários de fallback

### 2.3 Add-on Concorrente ✅

- `addon-hello-pt` registra `greeter` com prioridade 10 (maior que o hello padrão)
- Se o nome passado for `"error"`, o hello-pt lança exceção
- O hello padrão (prioridade 0) funciona como fallback

### 2.4 Testes de Fallback ✅

- Prioridade: o de maior prioridade é usado
- Fallback: se o primeiro falha, cai para o segundo
- Erro total: se todos falham, lança AggregateFallbackError

---

## Fase 3 — Descoberta Remota e Catálogo

**Status: Planejado** · **Objetivo: Add-ons carregados de qualquer lugar**

### 3.1 Manifesto Remoto

- Loader faz fetch do manifesto de URL remota
- Validação antes de carregar
- Cache do manifesto para evitar refetch

### 3.2 Catálogo de Add-ons

- Lista de manifests conhecidos (configuração ou JSON estático)
- UI para navegar e instalar
- Persistência em localStorage

### 3.3 Version Negotiation

- Manifesto declara `hostVersion` (versão do host requerida)
- Loader compara com a versão do host
- Se incompatível, add-on não carrega com mensagem clara

---

## Fase 4 — Isolamento e Resiliência

**Status: Planejado** · **Objetivo: Nenhum add-on quebra o host**

### 4.1 Error Boundary

- Cada chamada de serviço é isolada em try/catch
- Degradação: se um add-on falhar N vezes, perde prioridade
- Notificação ao usuário sobre falhas

### 4.2 Preferências do Usuário

- Habilitar/desabilitar add-ons individualmente
- Reordenar prioridade via drag-and-drop
- Persistência das preferências

### 4.3 Sandbox (Investigação)

- Investigar Web Worker ou Iframe para isolamento real
- Comunicação via postMessage
- Trade-off: isolamento vs. complexidade

---

## Linha do Tempo Estimada

| Fase | Duração Estimada | Depende de |
|------|-------------------|------------|
| Fase 1 | — | Nada |
| Fase 2 | — | Fase 1 completa |
| Fase 3 | — | Fase 2 completa |
| Fase 4 | — | Fase 3 completa |

Cada fase começa assim que a anterior estiver estável e testada.