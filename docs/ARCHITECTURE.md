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

O coração do sistema. Zero dependências externas. Define:

- **Tipos do manifesto** — `AddonManifest`, `ServiceRegistration`
- **ServiceRegistry** — mapa de serviceId → implementações ordenadas
- **AddonLoader** — carregamento dinâmico via `import()`
- **Validation** — validação de manifests
- **HostAPI** — interface que o host expõe para add-ons

### 2.2 Add-ons (`@addons/addon-*`)

Módulos ESM independentes que exportam `manifest` e `setup`. Cada add-on:

1. Declara no manifesto quais serviços oferece
2. Implementa os serviços de acordo com as interfaces
3. No `setup`, registra os serviços no `HostAPI.services`

### 2.3 Host App (`@addons/host-app`)

Aplicação React que:

1. Instancia um `ServiceRegistry`
2. Carrega add-ons via `AddonLoader`
3. Chama `setup` de cada add-on com o `HostAPI`
4. Usa os serviços registrados para interagir com o usuário
5. Exibe status dos add-ons na interface

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
  entrypoint: string;      // URL do bundle ESM
  services: ServiceRegistration[];
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