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
| add-on em processo | Uma ferramenta colocada dentro do host | Exporta `manifest`, `setup` e `createTab`, depois registra serviços e descreve sua aba |
| add-on HTTP | Um serviço que mora fora do host | Publica `manifest.json` e responde a recursos por HTTP |

## Dois formatos de add-on

### Add-on em processo

Use este formato quando a capacidade precisa executar dentro do mesmo processo JavaScript do host. É o caso do contador, do formatador, dos favoritos, da persistência e da depuração.

O módulo exporta duas partes:

```typescript
export const manifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Saúda o usuário',
  author: 'Equipe AC',
  license: 'MIT',
  tab: { title: 'Hello', body: 'Uma saudação.' },
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

export function createTab(host: HostAPI): AddonTab {
  return { title: 'Hello', body: 'Uma saudação.', actions: [], run: () => ({ status: 'info', body: '' }) };
}
```

O manifesto diz **o que** o add-on oferece. O `setup` executa **como** ele será ativado. Separar as duas partes permite validar a declaração antes de iniciar o comportamento.

### Abas criadas por add-ons

Cada add-on ativo também define uma aba. O manifesto declara `tab.title` e `tab.body`, que podem ser apresentados antes de executar uma ação. Módulos em processo exportam `createTab(host)`: ela devolve campos, botões e uma função `run`. A aba também pode declarar `persistence`, com `load` e `save`, e uma atualização observável com `getSnapshot` e `subscribe`. O host só desenha esses elementos, restaura o estado pedido e exibe a resposta; a regra de cada ação permanece no add-on.

Quando uma resposta traz itens, cada item pode incluir `details`, um valor JSON serializável. O host mostra esse valor somente quando a pessoa clica no nome do item. Assim, por exemplo, `storage-local` entrega o estado completo sem o host conhecer a chave, o prefixo ou a estrutura interna daquele estado.

```text
add-on ativo ──► AddonTab (título, corpo, campos, ações, run)
                            │
                            ▼
                    host genérico renderiza e mostra a resposta
```

Ao desativar ou remover a extensão, sua instância e sua aba saem da lista ativa. O host não mantém abas fixas de serviços conhecidos.

### Contrato de interação e revisão

Além de `services` e `resources`, todo manifesto tem `interactions`. Ele reúne, em um único bloco JSON, o que o add-on oferece, recebe, devolve, guarda, consulta por HTTP e registra como evento. A interface de Configurações mostra esse bloco em linguagem simples e também no JSON completo ao expandir um add-on instalado.

```text
manifesto ──► contrato de interação ──► revisão da pessoa ──► ativação
                     │                         │
                     ├── campos e ações        └── impressão digital aceita
                     ├── serviços e estado
                     └── HTTP e logs
```

O host valida o contrato antes da instalação. Para módulos em processo, ele também compara campos e ações reais da aba com a declaração, encaminha somente os campos autorizados e limita serviços e chaves de estado aos itens declarados. A origem e as rotas de HTTP externo aparecem no contrato, mas continuam apenas declarativas: o código em processo ainda poderia chamar `fetch` diretamente, pois esta POC não tem sandbox nem um adaptador de rede obrigatório.

O host preserva a impressão digital do contrato aceito junto da instalação. Se o manifesto na mesma URL mudar, a instância fica desativada e pede revisão antes de voltar a oferecer serviços. A impressão digital detecta mudanças acidentais ou visíveis; ela não é uma assinatura criptográfica e não prova autoria.

### Instalações persistidas pelo host

O host guarda sua configuração de instalação em `localStorage`, na chave `addons:host-installations:v1`. Ela contém apenas as URLs dos manifestos instalados e quais delas estavam desativadas. No primeiro acesso essa chave não existe, portanto a POC continua começando sem extensões.

Em um recarregamento, o host lê essa lista e instala novamente cada URL. Provedores de armazenamento são restaurados primeiro, Debug vem em seguida e os demais add-ons mantêm a ordem em que foram instalados. Essa configuração é a exceção de inicialização do host: ela não é o `addonStateStore` e não entrega persistência implícita ao estado interno dos add-ons.

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
- modelos de texto, formatação, marcadores, favoritos, estado opcional e eventos de debug.

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
| `BrowserStateStore` | Estado serializável no `localStorage` ou `sessionStorage` |

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
  log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void;
}
```

- `services` permite consultar capacidades já registradas.
- `registerService` registra uma capacidade atribuindo a origem ao add-on atual.
- `onUnload` recebe rotinas de limpeza para um futuro ciclo completo de descarregamento.
- `log` registra mensagens com o contexto do add-on e, quando `debugLog` está ativo, publica também o detalhe estruturado para a aba Debug.

O acesso direto a `services` permite composição. Os add-ons de contador, busca e favoritos consultam `addonStateStore` em cada operação: sem esse serviço, seguem apenas em memória; com ele, restauram e gravam seu próprio estado.

### Persistência e debug como add-ons

O host não fornece armazenamento nem uma tela de log por conta própria. Essas são capacidades instaláveis:

```text
add-on consumidor ──consulta──► addonStateStore ──► localStorage/sessionStorage
         │
         └── host.log(...) ──► debugLog ──► aba Debug
```

`Local Storage Add-on` registra `addonStateStore` com prioridade `10`; `Session Storage Add-on` registra o mesmo serviço com prioridade `0`. Assim, quando ambos estão ativos, o estado durável local é escolhido. Ao desativá-lo, o armazenamento de sessão passa a ser usado sem o host conhecer a extensão consumidora. Desativar os dois impede novas gravações e restaurações. A lista de extensões instaladas continua sendo uma configuração mínima do host, para que ele consiga restaurar as próprias extensões após F5.

O `Debug Add-on` registra `debugLog`. O fluxo de `HostAPI.log` continua escrevendo no console, mas também encaminha evento, nível, horário e detalhes para esse serviço quando ele existe. Os add-ons em processo usam esse caminho em setup, ações e erros; servidores HTTP continuam independentes e não recebem `HostAPI`.

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
  tab: { title: string; body: string };
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
  tab?: AddonTab;
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
| Módulo não exporta `manifest`, `setup` e `createTab` | Loader devolve instância em `error` |
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
