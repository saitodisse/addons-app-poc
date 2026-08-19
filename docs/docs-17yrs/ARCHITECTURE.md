# Arquitetura — Como o Sistema Funciona por Dentro

*Um guia visual e explicado de como as peças se encaixam.*

---

## 1. A Grande Ideia

O host não conhece os add-ons. Os add-ons não conhecem o host. Eles se encontram através de um **intermediário**: o **ServiceRegistry**.

É como um leilão. Os add-ons oferecem serviços ( "eu tenho um serviço de saudação!" ). O host pede serviços ( "alguém tem um serviço de saudação?" ). O registry faz a ponte.

```
┌───────────────────────────────────────────────┐
│                   Host App                     │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │           ServiceRegistry               │   │
│  │  ┌──────────┐  ┌──────────┐             │   │
│  │  │ greeter  │  │ counter  │  ...        │   │
│  │  │ [impl1]  │  │ [impl1]  │             │   │
│  │  │ [impl2]  │  │          │             │   │
│  │  └──────────┘  └──────────┘             │   │
│  └─────────────────────────────────────────┘   │
│         ▲                      ▲                │
│         │ setup(hostAPI)       │ get/getAll     │
│         ▼                      │                │
│  ┌──────────────┐  ┌────────────────────┐       │
│  │ addon-hello  │  │  addon-counter     │       │
│  │ ┌──────────┐ │  │  ┌──────────────┐  │       │
│  │ │ manifest │ │  │  │ manifest     │  │       │
│  │ │ setup()  │─┼──┼──┤ setup()      │  │       │
│  │ └──────────┘ │  │  └──────────────┘  │       │
│  └──────────────┘  └────────────────────┘       │
└───────────────────────────────────────────────┘
```

---

## 2. As Camadas

### Camada Core (`@addons/core`)

É o cérebro. Não depende de nada — nem React, nem Vite, nem jQuery. Só TypeScript puro.

O core é dividido em **três zonas** pra deixar claro o que é regra de negócio e o que é detalhe técnico:

```
packages/core/src/
├── domain/              ← O NEGÓCIO. Regras puras, sem efeito colateral
│   ├── manifest.ts      #   AddonManifest, ServiceRegistration
│   ├── instance.ts      #   AddonInstance (um add-on carregado)
│   ├── registry.ts      #   ServiceRegistry (o coração)
│   ├── host-api.ts      #   O que o host oferece pro add-on
│   └── validation.ts    #   Validação de manifesto
├── ports/               ← AS PORTAS. Interfaces que o domínio espera
│   ├── addon-loader.ts  #   "Preciso de algo que carregue add-ons"
│   └── logger.ts        #   "Preciso de algo que logue mensagens"
└── adapters/            ← AS TOMADAS. Implementações reais
    ├── http-loader.ts   #   FetchAddonLoader (fetch + import())
    └── console-logger.ts
```

**A regra de ouro:** o `domain/` não sabe que `ports/` e `adapters/` existem. Ele é puro, testável, transportável. Os adapters são as "tomadas" que conectam o domínio puro ao mundo real — HTTP, console, React, etc.

### Camada Add-ons (`@addons/addon-*`)

São módulos independentes. Cada um exporta:

- **`manifest`** — quem é, o que oferece
- **`setup`** — função que registra os serviços no host

### Camada Host App (`@addons/host-app`)

É o aplicativo que junta tudo. Ele é um **adaptador de UI** — uma "tomada" que conecta o domínio puro ao React:

1. Cria um ServiceRegistry
2. Cria os adaptadores concretos (FetchAddonLoader, ConsoleLogger)
3. Usa o AddonLoaderPort pra carregar add-ons
4. Chama o `setup` de cada add-on
5. Usa os serviços registrados
6. Mostra tudo na tela

### Por que separar em três zonas?

Imagina que você quer testar o ServiceRegistry. Com o código separado, você testa o `domain/registry.ts` sem precisar de fetch, sem HTTP, sem navegador. É uma função pura: entra dado, sai resultado. Se o teste falhar, o problema é na lógica, não na internet.

E se um dia você quiser trocar o loader de HTTP por um loader de cache local? Você cria um novo adapter em `adapters/cache-loader.ts` e pronto. O domínio não muda. As portas não mudam. Só a tomada.

---

## 3. O Ciclo de Vida de um Add-on

### Passo a passo do carregamento

```
1. Host descobre uma URL de manifesto
   ↓
2. Host faz fetch do manifesto (HTTP GET)
   ↓
3. Host valida o manifesto (campos obrigatórios, versão, URL)
   ↓
4. Se inválido → loga erro, nunca carrega esse add-on
   ↓
5. Se válido → host faz import(URL_do_entrypoint)
   ↓
6. Se o import falhar → loga erro, não carrega
   ↓
7. Host verifica se o módulo exporta manifest e setup
   ↓
8. Se faltar algo → loga erro, não carrega
   ↓
9. Host chama setup(hostAPI)
   ↓
10. Se setup lançar erro → marca add-on como "error", descarta registros
   ↓
11. Se setup funcionar → add-on fica "ready" e pronto pra uso
```

### O que acontece quando o host usa um serviço

```
1. Host: registry.get("greeter")
2. Registry: olha a lista de implementações de "greeter"
3. Registry: ordena por prioridade (maior primeiro)
4. Registry: retorna a de maior prioridade
   ↓
   (Se o host quiser todas, pra fallback manual:)
1. Host: registry.getAll("greeter")
2. Registry: retorna array ordenado por prioridade
3. Host: tenta a primeira, se falhar tenta a segunda...
```

---

## 4. Os Tipos Principais

### AddonManifest — O Cartão de Visita

```typescript
interface AddonManifest {
  id: string;              // Nome amigável, tipo "hello"
  version: string;         // Versão, tipo "1.0.0"
  name: string;            // Nome bonito pro usuário
  description: string;     // O que faz
  author: string;          // Quem fez
  icon?: string;           // URL do ícone (opcional)
  license: string;         // Licença, tipo "MIT"
  entrypoint: string;      // URL do bundle JavaScript
  services: ServiceRegistration[];  // Lista de serviços
}
```

### ServiceRegistration — Um Serviço Específico

```typescript
interface ServiceRegistration {
  id: string;              // ID do serviço, tipo "greeter"
  version: string;         // Versão da interface
  name: string;            // Nome amigável
  description: string;     // O que o serviço faz
}
```

### ServiceEntry — Um Registro no Registry

```typescript
interface ServiceEntry<T = unknown> {
  serviceId: string;        // ID do serviço
  instance: T;              // A implementação de verdade
  addonId: string;          // URL do manifesto do add-on que registrou
  priority: number;         // Prioridade (maior = mais preferido)
}
```

### AddonInstance — Um Add-on Carregado

```typescript
interface AddonInstance {
  manifest: AddonManifest;       // O manifesto do add-on
  manifestUrl: string;           // URL do manifesto (a identidade)
  status: 'loading' | 'ready' | 'error';  // Estado atual
  error?: Error;                 // Se deu erro, qual foi
  services: string[];            // IDs dos serviços registrados
}
```

### HostAPI — O que o Add-on Recebe

```typescript
interface HostAPI {
  services: ServiceRegistry;                          // O registro
  onUnload: (callback: () => void) => void;           // Gancho de limpeza
  log: (level: 'info' | 'warn' | 'error', message: string) => void;  // Logger
}
```

---

## 5. ServiceRegistry — A API Completa

```typescript
class ServiceRegistry {
  // Registra um serviço
  register<T>(serviceId: string, instance: T, addonId: string, priority?: number): void;

  // Remove um registro específico
  unregister(serviceId: string, addonId: string): void;

  // Pega a implementação de maior prioridade
  get<T>(serviceId: string): T | undefined;

  // Pega todas as implementações ordenadas por prioridade
  getAll<T>(serviceId: string): T[];

  // Pergunta se existe pelo menos uma implementação
  has(serviceId: string): boolean;

  // Limpa tudo
  clear(): void;

  // Remove todos os registros de um add-on específico
  clearAddon(addonId: string): void;
}
```

---

## 6. Tratamento de Erros

| Onde | O que pode dar errado | O que acontece |
|------|----------------------|----------------|
| Fetch do manifesto | URL inválida, servidor offline | Add-on não carrega, loga erro |
| Validação | Campos faltando, versão errada | Add-on não carrega, loga erro |
| `import()` do bundle | Bundle corrompido, URL inválida | Add-on não carrega, loga erro |
| `setup()` | Exceção no código do add-on | Add-on marcado como "error", registros descartados |
| Chamada de serviço | Exceção no serviço | Fallback pra próxima implementação (Fase 2) |

**Nenhum erro quebra o host.** O host é tipo um bom goleiro: pode tomar chute, mas nunca cai.

---

## 7. Dependências entre os Pacotes

```
@addons/host-app
    │
    ▼ (depende de)
@addons/core
    ▲
    │ (implementa as interfaces)
    │
@addons/addon-hello    @addons/addon-counter
    │                        │
    ▼                        ▼
@addons/core            @addons/core
```

Regras:
- Add-ons dependem do `core` (precisam dos tipos)
- Host-app depende do `core` (precisa do registry e loader)
- Add-ons **nunca** dependem do host-app
- Host-app **nunca** depende de add-ons em tempo de compilação (só em tempo de execução)

---

## 8. As Decisões Arquiteturais (em Português Simples)

### ADR-001: URL é a identidade
**Problema:** Como identificar um add-on de forma única?
**Decisão:** A URL do manifesto é a identidade. Não existe ID único global.
**Por quê:** URL é única por natureza. Não precisa de cadastro central.

### ADR-002: Manifest separado do Setup
**Problema:** Como o host descobre o que o add-on oferece sem executar ele?
**Decisão:** O add-on exporta `manifest` (dados) e `setup` (código) separadamente.
**Por quê:** O host pode ler o manifesto (JSON puro, seguro) antes de executar código.

### ADR-003: Prioridade explícita
**Problema:** Se dois add-ons registram o mesmo serviço, qual usar?
**Decisão:** Cada registro tem um número de prioridade. Maior número = maior preferência.
**Por quê:** Resolução determinística e controlável pelo usuário.

### ADR-004: Core sem dependências
**Problema:** O core precisa ser portável pra qualquer projeto.
**Decisão:** `@addons/core` não depende de React, Vite, ou nenhum framework.
**Por quê:** Qualquer aplicação TypeScript pode usar o protocolo.