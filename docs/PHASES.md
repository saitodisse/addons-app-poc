# Fases do Projeto

**Status: Planejado**

---

Este documento detalha cada fase do projeto, do mais simples ao mais complexo. Cada fase é **funcional por si só** — ao final de cada uma, você tem um sistema que roda e demonstra o que foi construído até ali.

---

## Fase 1 — Núcleo do Protocolo + App Base

**Status: Em Andamento** · **Objetivo: Um aplicativo que carrega add-ons**

### 1.1 Core — Manifest Types

**Arquivo:** `packages/core/src/manifest.ts`

Criar os tipos TypeScript do manifesto:

- `AddonManifest` — interface com todos os campos do manifesto
- `ServiceRegistration` — interface com id, version, name, description
- `AddonInstance` — representação de um add-on carregado (status, erro, serviços)
- `ServiceEntry<T>` — entrada no registry (instância, addonId, prioridade)
- `HostAPI` — interface que o host expõe para add-ons
- `AddonModule` — interface do que um add-on exporta (manifest + setup)

### 1.2 Core — Validation

**Arquivo:** `packages/core/src/validation.ts`

- `validateManifest(data: unknown): { valid: boolean; errors: string[] }`
- Validar campos obrigatórios
- Validar formato de versão semântica
- Validar URL do entrypoint
- Validar estrutura dos serviços

### 1.3 Core — Registry

**Arquivo:** `packages/core/src/registry.ts`

- `class ServiceRegistry`
- `register<T>(serviceId, instance, addonId, priority?)` — registra um serviço
- `unregister(serviceId, addonId)` — remove um registro
- `get<T>(serviceId)` — retorna a implementação de maior prioridade
- `getAll<T>(serviceId)` — retorna todas ordenadas por prioridade
- `has(serviceId)` — verifica se há pelo menos uma implementação
- `clear()` — remove todos os registros
- `clearAddon(addonId)` — remove todos os registros de um add-on

### 1.4 Core — Loader

**Arquivo:** `packages/core/src/loader.ts`

- `class AddonLoader`
- `load(manifestUrl: string): Promise<AddonInstance>` — carrega um add-on da URL
- `loadFromManifest(manifest: AddonManifest, manifestUrl: string): Promise<AddonInstance>` — carrega de um manifesto já obtido
- `loadFromModule(module: AddonModule, manifestUrl: string, registry: ServiceRegistry): AddonInstance` — registra a partir de um módulo já importado
- Tratamento de erro em cada etapa

### 1.5 Core — Index

**Arquivo:** `packages/core/src/index.ts`

Re-exportar tudo que é público.

### 1.6 Testes do Core

**Arquivos:** `packages/core/src/*.test.ts`

- Registry: register, unregister, get, getAll, prioridade, fallback, limpeza
- Validation: manifesto válido, inválido, campos faltando, versão inválida
- Loader: mock de fetch, mock de import(), erro não quebra

### 1.7 Add-on Hello

**Arquivo:** `packages/addon-hello/src/index.ts`

- Exportar `manifest` com serviço `"greeter"`
- Exportar `setup` que registra um serviço `greeter`
- O serviço `greeter` tem um método `greet(name: string): string`

### 1.8 Add-on Counter

**Arquivo:** `packages/addon-counter/src/index.ts`

- Exportar `manifest` com serviço `"counter"`
- Exportar `setup` que registra um serviço `counter`
- O serviço `counter` tem métodos `increment()`, `decrement()`, `getValue(): number`

### 1.9 Host App

**Arquivos:** `packages/host-app/src/`

- App React que instancia ServiceRegistry e AddonLoader
- Carrega add-ons de uma lista pré-configurada
- `AddonList.tsx` — mostra add-ons instalados com status
- `AddonViewer.tsx` — detalhes de um add-on e botão para invocar serviços
- UI simples, funcional, sem estilo elaborado

### 1.10 Teste Manual

- Abrir host-app no navegador
- Ver add-ons carregados
- Invocar greeter e ver resultado
- Invocar counter e ver valor mudar

---

## Fase 2 — Interfaces de Domínio + Cadeia de Fallback

**Status: Planejado** · **Objetivo: Serviços tipados com fallback automático**

### 2.1 Interfaces Tipadas

- Definir `interface Greeter { greet(name: string): string }` em `@addons/core`
- O registry passa a ser genérico: `registry.get<Greeter>("greeter")`
- Add-ons implementam a interface explicitamente

### 2.2 Fallback Chain

- `registry.get<T>(serviceId)` wrapped em try/catch
- Se falhar, tenta `getAll<T>(serviceId)` e itera
- Fallback automático sem o host precisar fazer nada

### 2.3 Add-on Concorrente

- Criar `addon-hello-pt` que registra `greeter` com prioridade maior
- Host usa o `greeter` do novo add-on sem saber que trocou
- Se o novo falhar, fallback para o original

### 2.4 Testes de Fallback

- Registrar dois serviços com prioridades diferentes
- Verificar que o de maior prioridade é usado
- Simular falha e verificar fallback

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