# Arquitetura do addons-app-poc

**Status: Parcial**

Este documento explica como o sistema funciona. A primeira metade oferece um mapa simples; a segunda descreve os contratos, fluxos e limites que interessam a quem vai alterar o código.

## Por que esta arquitetura existe

Um aplicativo extensível enfrenta uma tensão: ele precisa aceitar capacidades criadas por outras pessoas sem permitir que cada extensão fique soldada ao código principal.

Se o host importar diretamente uma implementação específica em toda parte, trocar essa implementação exige mudar o aplicativo. Se o add-on conhecer detalhes internos do host, qualquer reorganização quebra a extensão. A arquitetura resolve esse problema colocando um contrato estável no meio.

Em termos simples, o host diz: “preciso de um serviço que faça este trabalho”. Os add-ons respondem: “eu ofereço uma implementação desse serviço”. O `ServiceRegistry` apresenta os dois sem obrigá-los a se conhecer diretamente.

## O sistema visto de longe

```text
┌─────────────────────────────────────────────────────────────┐
│                         Host App                            │
│                                                             │
│  interface ──► serviços ──► ServiceRegistry ◄── add-ons     │
│                              │                              │
│                              └── prioridade e fallback      │
└──────────────────────────────┬──────────────────────────────┘
                               │ contratos
                     ┌─────────▼─────────┐
                     │  @addons/core     │
                     │ domínio, portas,  │
                     │ adaptadores       │
                     └─────────┬─────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
          módulo ESM em processo   servidor independente
          manifest + setup         manifest + recursos HTTP
```

Há quatro peças principais:

| Peça | Explicação simples | Responsabilidade técnica |
|---|---|---|
| `core` | O livro de regras | Define domínio, portas, adaptadores e API pública |
| host | O aplicativo anfitrião | Inicializa add-ons e usa os serviços disponíveis |
| add-on em processo | Uma ferramenta colocada dentro do host | Exporta `manifest` e `setup`, depois registra serviços |
| add-on HTTP | Um serviço que mora fora do host | Publica `manifest.json` e responde a recursos por HTTP |

## Dois formatos de add-on

### Add-on em processo

Use este formato quando a capacidade precisa executar dentro do mesmo processo JavaScript do host. É o caso do contador, do formatador e dos favoritos.

O módulo exporta duas partes:

```typescript
export const manifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Saúda o usuário',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: 'https://example.com/hello.js',
  services: [
    {
      id: 'greeter',
      version: '1.0.0',
      name: 'Greeter',
      description: 'Serviço de saudação',
    },
  ],
};

export function setup(host: HostAPI): void {
  host.registerService('greeter', {
    greet: (name: string) => `Olá, ${name}!`,
  });
}
```

O manifesto diz **o que** o add-on oferece. O `setup` executa **como** ele será ativado. Separar as duas partes permite validar a declaração antes de iniciar o comportamento.

### Add-on HTTP

Use este formato quando o add-on deve permanecer independente do processo do host. É o caso dos quatro provedores de texto.

O host não importa o código do servidor. Ele lê o manifesto e faz requisições a rotas previsíveis:

```text
GET /manifest.json
GET /catalog/<type>/<catalogId>.json
GET /search/<type>/<query>.json
GET /text/<type>/<id>.json
GET /text/<type>/<id>/content.txt
```

Essa divisão reduz o acoplamento operacional. O servidor pode ser atualizado ou reiniciado sem reconstruir o host. Em troca, passa a existir uma dependência de rede e a necessidade de lidar com latência, CORS e indisponibilidade.

## O núcleo em três camadas

O `@addons/core` usa uma arquitetura hexagonal leve. “Hexagonal” significa que as regras centrais não conhecem diretamente navegador, rede ou armazenamento; elas conversam com esses recursos por interfaces.

```text
packages/core/src/
├── domain/       regras e tipos puros
├── ports/        interfaces esperadas pelo núcleo
├── adapters/     implementações concretas das portas
└── index.ts      API pública do pacote
```

### Domínio

O diretório `domain/` contém o que deve continuar verdadeiro em qualquer ambiente:

- formato do manifesto e da instância carregada;
- registro e ordenação de serviços;
- fallback síncrono e assíncrono;
- validação de manifestos;
- interfaces de serviços como `Greeter`, `Counter` e `SearchProvider`;
- modelos de texto, formatação, marcadores e favoritos.

Esses arquivos não fazem `fetch`, não acessam `localStorage` e não renderizam React.

### Portas

Uma **porta** é uma interface que descreve uma necessidade sem escolher a tecnologia usada para atendê-la.

| Porta | Necessidade descrita |
|---|---|
| `AddonLoaderPort` | Carregar um add-on a partir da URL do manifesto |
| `LoggerPort` | Registrar mensagens de informação, aviso ou erro |
| `TextAddonClientPort` | Consultar manifesto, catálogo, busca e texto por HTTP |

### Adaptadores

Um **adaptador** transforma uma tecnologia concreta no formato da porta:

| Adaptador | Tecnologia concreta |
|---|---|
| `FetchAddonLoader` | `fetch()` e `import()` dinâmico |
| `HttpTextAddonClient` | Requisições HTTP aos recursos de texto |
| `ConsoleLogger` e `SilentLogger` | Saída de logs |
| `LocalStorageBookmarkStore` | Persistência no navegador |
| `MemoryBookmarkStore` | Persistência temporária em memória |

## O ServiceRegistry

O registro é como uma lista telefônica de capacidades. Um add-on registra uma implementação sob um `serviceId`; o host busca pelo mesmo identificador.

```typescript
interface ServiceEntry<T = unknown> {
  serviceId: string;
  instance: T;
  addonId: string;
  priority: number;
}

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

`register` mantém as entradas em ordem decrescente de prioridade. `get` devolve somente a primeira implementação. `getAll` devolve todas, já ordenadas, e é a base usada pelo fallback.

### Prioridade não é fallback

Prioridade apenas responde “qual implementação vem primeiro?”. Ela não executa o serviço nem captura erros.

Para tentar alternativas, o consumidor usa:

```typescript
const greeting = withFallback<Greeter, string>(
  registry,
  'greeter',
  (greeter) => greeter.greet('Joaquim'),
);
```

`withFallback` percorre as implementações em ordem. A primeira resposta bem-sucedida encerra a busca. Se todas falharem, `AggregateFallbackError` reúne os erros. `withFallbackAsync` aplica o mesmo comportamento a operações assíncronas.

## O HostAPI

O `HostAPI` é a pequena caixa de ferramentas entregue ao add-on durante o `setup`:

```typescript
interface HostAPI {
  services: ServiceRegistry;
  registerService<T>(serviceId: string, instance: T, priority?: number): void;
  onUnload(callback: () => void): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
}
```

- `services` permite consultar capacidades já registradas.
- `registerService` registra uma capacidade atribuindo a origem ao add-on atual.
- `onUnload` recebe rotinas de limpeza para um futuro ciclo completo de descarregamento.
- `log` registra mensagens com o contexto do add-on.

O acesso direto a `services` permite composição. O add-on de favoritos, por exemplo, procura `bookmarkStore`, serviço de infraestrutura registrado pelo host. Se não encontrar, usa armazenamento em memória.

## Fluxo de um add-on em processo

O fluxo implementado por `FetchAddonLoader` é:

```text
URL do manifesto
      │
      ▼
fetch e parse do JSON
      │
      ▼
validateManifest
      │ inválido
      ├──────────► AddonInstance com status "error"
      │
      ▼ válido
import(entrypoint)
      │
      ▼
verifica manifest + setup
      │
      ▼
setup(hostAPI)
      │
      ├── sucesso ─► status "ready" + serviços registrados
      └── falha   ─► status "error"
```

A URL do manifesto é usada como `addonId` nos registros. Isso impede que um nome amigável alterado acidentalmente crie uma segunda identidade.

### Comportamento atual do host de demonstração

O `core` oferece o fluxo remoto acima, mas o `host-app` atual não o usa para os exemplos em processo. Ele importa os pacotes locais durante a build e chama cada `setup` diretamente. As URLs exibidas funcionam como identidades locais, não como origem real de um download dinâmico.

Isso é suficiente para demonstrar registro, prioridade e composição. Não prova ainda a instalação arbitrária de módulos remotos pela interface.

## Fluxo de um add-on HTTP

O host conhece a URL base do servidor e o `HttpTextAddonClient` monta as rotas:

```text
URL base
  │
  ├── /manifest.json ─────────────► capacidades declaradas
  ├── /catalog/type/id.json ──────► { metas: [...] }
  ├── /search/type/query.json ────► { metas: [...] }
  └── /text/type/id.json ─────────► { texts: [{ url, ... }] }
                                            │
                                            ▼
                                      conteúdo sob demanda
```

O último passo é um carregamento sob demanda, também chamado de **lazy loading**. O servidor devolve metadados e uma URL; o texto completo só é transferido quando o usuário decide abrir o item.

O `@addons/addon-server` transforma quatro handlers — `catalog`, `search`, `text` e `content` — nessas rotas. Ele também:

- responde a `OPTIONS`;
- libera CORS com origem `*`;
- converte URLs relativas de conteúdo em URLs absolutas;
- devolve `404` para rotas desconhecidas;
- converte exceções dos handlers em resposta `500`.

## Modelos de dados essenciais

### Manifesto

```typescript
interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  icon?: string;
  license: string;
  entrypoint?: string;
  services?: ServiceRegistration[];
  resources?: AddonResource[];
  types?: string[];
  idPrefixes?: string[];
  catalogs?: AddonCatalog[];
}
```

A especificação completa está em [`MANIFEST-SPEC.md`](MANIFEST-SPEC.md).

### Instância carregada

```typescript
type AddonStatus = 'loading' | 'ready' | 'error';

interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;
  status: AddonStatus;
  error?: Error;
  services: string[];
}
```

### Respostas de texto

```typescript
interface TextMeta {
  id: string;
  type: string;
  name: string;
  description?: string;
  author?: string;
}

interface TextItem {
  id: string;
  url: string;
  lang: string;
  name: string;
}
```

Catálogo e busca devolvem `{ metas: TextMeta[] }`. O recurso de texto devolve `{ texts: TextItem[] }`.

## Dependências permitidas

```text
@addons/host-app ───────────────► @addons/core

@addons/addon-hello ────────────► @addons/core
@addons/addon-counter ──────────► @addons/core
@addons/addon-* em processo ────► @addons/core

@addons/addon-text-* ───────────► @addons/addon-server
```

Não são permitidos atalhos de `addon-*` para `host-app`. A colaboração entre extensões deve atravessar o registro e os contratos compartilhados.

## Falhas e degradação

| Falha | Comportamento atual |
|---|---|
| Manifesto remoto não responde | Loader ou cliente lança/registra erro contextualizado |
| Manifesto é inválido | Add-on é rejeitado antes do `setup` ou do consumo de recursos |
| Bundle não importa | `FetchAddonLoader` devolve instância em `error` |
| Módulo não exporta `manifest` e `setup` | Loader devolve instância em `error` |
| Serviço falha durante fallback | Próxima implementação é tentada |
| Todos os serviços falham | `AggregateFallbackError` é lançado |
| Um servidor falha na busca agregada | O agregador ignora essa origem e mantém as demais |
| `localStorage` não existe | Favoritos degradam para armazenamento em memória |

## Segurança e limites conhecidos

Uma POC não deve prometer isolamento que ainda não possui. Hoje:

- add-ons em processo executam com os mesmos privilégios JavaScript do host;
- não há sandbox em `Worker` ou `iframe`;
- não há autenticação, autorização ou assinatura de manifestos;
- CORS aberto serve à demonstração local, não a uma política de produção;
- não há limite de tempo, tamanho ou taxa para respostas HTTP;
- `FetchAddonLoader` marca erro de `setup`, mas ainda não remove registros parciais criados antes da exceção;
- callbacks passados a `onUnload` são coletados pelo loader, mas o ciclo público de descarregamento ainda não os executa;
- o host de demonstração ainda não instala módulos em processo por uma URL fornecida pelo usuário.

Esses pontos são trabalho futuro, não detalhes escondidos. O roteiro está em [`PHASES.md`](PHASES.md).

## Decisões arquiteturais

As decisões, alternativas e consequências foram consolidadas em [`DECISIONS.md`](DECISIONS.md). Consulte esse arquivo antes de mudar identidade, manifesto, registro, fallback, formato HTTP ou fronteiras de dependência.
