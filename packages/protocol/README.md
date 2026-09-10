# `@addons-poc/protocol`

O manual de convivência entre um aplicativo e seus add-ons.

Versão `1.0.0` · Licença [MIT](LICENSE) · pacote ESM público.

## Em uma frase

O protocolo é um conjunto de regras que permite ao aplicativo principal,
chamado **host**, entender e executar add-ons criados separadamente.

Este é o padrão do `addons-app-poc`. Ele não pretende ser um padrão universal.

## Por que este protocolo existe

Imagine que o host seja um videogame e cada add-on seja um cartucho. Os dois
precisam concordar sobre o formato do encaixe antes de funcionar juntos.

No projeto, esse encaixe precisa responder perguntas simples:

- quem criou o add-on e qual é sua versão;
- o que ele oferece e do que precisa;
- quais campos e botões deseja mostrar;
- quais dados pretende guardar;
- quais chamadas de internet realiza;
- quais mensagens pode registrar.

Sem essas regras, o host precisaria conhecer cada add-on antecipadamente. Com o
protocolo, ele lê uma descrição pública, verifica a compatibilidade e só então
decide se pode ativar a extensão.

## O que forma o protocolo

### O manifesto é a ficha de apresentação

Todo add-on publica um arquivo chamado `manifest.json`. Ele informa nome,
versão, descrição, autoria, licença e o contrato de interação.

A identidade verdadeira do add-on é a URL completa desse manifesto, por
exemplo:

```text
https://example.com/addons/hello/manifest.json
```

Dois manifestos em endereços diferentes são tratados como dois add-ons, mesmo
que tenham o mesmo nome ou `id`.

### O contrato é uma promessa antes da execução

O manifesto contém uma única seção `contract`. Ela descreve tudo o que o add-on
declara fazer:

| Parte | Explicação simples |
|---|---|
| `protocol` | Versão das regras que o add-on entende |
| `capabilities` | Recursos obrigatórios ou opcionais que ele espera do host |
| `services` | Serviços que oferece ou deseja usar |
| `ui` | Campos, botões e respostas da sua tela |
| `state` | Dados que pretende guardar e operações permitidas |
| `http` | Chamadas de internet recebidas ou realizadas |
| `logs` | Mensagens estruturadas que pode registrar |
| `resources` | Recursos HTTP, como catálogo, busca ou texto |

As capacidades oficiais são `registry.services`, `ui.tab`, `logs` e
`state-store`. Capacidades e serviços próprios usam nomes com um namespace,
como `addons.hello.greeter`, para não colidirem com nomes de outros projetos.

As informações recebidas e devolvidas também são classificadas como:

- `public`: informação pública;
- `personal`: informação relacionada a uma pessoa;
- `secret`: informação sensível, como uma credencial.

O contrato descreve o tipo e a classificação do dado. Senhas, tokens e outros
segredos reais não devem ser gravados no manifesto.

## Como a instalação acontece

```text
Pessoa informa a URL do manifesto
                ↓
Host baixa e valida o manifest.json
                ↓
Host mostra o contrato para revisão
                ↓
Host verifica versões, recursos e serviços
                ↓
Add-on fica pronto, bloqueado ou com erro
```

O host valida os metadados, a versão do protocolo, as capacidades, os serviços
e os schemas de dados. Um schema é uma descrição verificável do formato de uma
informação. A v1 aceita strings, números, inteiros, booleanos, valores nulos,
objetos e listas.

Uma instância pode passar pelos seguintes estados:

| Estado | Significado |
|---|---|
| `loading` | O host ainda está carregando o add-on |
| `ready` | O add-on foi validado e está pronto |
| `blocked` | O contrato é conhecido, mas falta uma dependência obrigatória |
| `error` | O manifesto, o bundle ou a inicialização falhou |

Dependências obrigatórias ausentes e ciclos entre add-ons bloqueiam a ativação.
Quando um novo provedor aparece, o host pode reavaliar os bloqueados.

Depois da revisão humana, o host guarda uma impressão digital do contrato junto
da URL. Se o contrato mudar no mesmo endereço, a pessoa precisa revisá-lo outra
vez. Essa impressão digital detecta mudanças, mas não é uma assinatura digital
nem comprova autoria.

## Os dois formatos de add-on

### Add-on em processo

É um módulo JavaScript ESM carregado pelo host. Seu manifesto contém um
`entrypoint`, que aponta para o bundle JavaScript.

O módulo exporta três itens:

```ts
manifest
setup(host)
createTab(host)
```

Antes de executar o bundle, o host confere se o manifesto interno possui a mesma
identidade, versão e contrato do manifesto público. Durante o `setup`, o add-on
recebe uma API pequena:

```ts
host.services
host.registerService
host.onUnload
host.log
```

O add-on só pode registrar serviços declarados. O host também confere as
interações que passam por sua mediação. Se a inicialização falhar, ele remove os
registros parciais e deixa a instância em `error`.

### Add-on HTTP

É um servidor independente e não possui `entrypoint`. Ele publica
`GET /manifest.json` e declara recursos como `catalog`, `search` e `text`.

Catálogo e busca devolvem metadados e podem dividir a resposta em páginas. A
requisição seguinte repete a rota com `limit` e o `cursor` opaco devolvido em
`pagination.next`:

```text
GET /search/page/termo.json?limit=20&cursor=...
```

Uma resposta paginada usa este formato:

```json
{
  "metas": [{ "id": "texto-1", "type": "page", "name": "Página" }],
  "pagination": { "limit": 20, "total": 42, "next": "cursor-opaco" }
}
```

`pagination` é opcional para preservar compatibilidade com add-ons antigos. O
campo `next` ausente significa que não há outra página. O conteúdo completo é
buscado apenas quando a pessoa escolhe uma opção. Um recurso de texto usa este
envelope:

```json
{
  "texts": [
    {
      "id": "texto-1",
      "url": "https://example.com/text/texto-1/content.txt",
      "lang": "pt-BR",
      "name": "Versão principal"
    }
  ]
}
```

O servidor é ESM puro, não conhece React e não carrega o runtime interno do
host.

## Exemplo de manifesto

Este exemplo declara um add-on em processo que oferece um serviço de saudação:

```ts
import {
  defineAddonManifest,
  validateManifest,
} from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Cria uma saudação para o nome informado.',
  author: 'Equipe',
  license: 'MIT',
  entrypoint: 'https://example.com/addons/hello/bundle.js',
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: {
      required: ['registry.services', 'ui.tab'],
      optional: ['logs', 'state-store'],
    },
    services: [{
      id: 'addons.hello.greeter',
      role: 'provides',
      version: '1.0.0',
      name: 'Saudação',
      description: 'Produz uma saudação personalizada.',
      methods: [{
        id: 'greet',
        description: 'Saúda uma pessoa pelo nome.',
        receives: {
          description: 'Nome da pessoa.',
          schema: {
            type: 'string',
            description: 'Nome usado na saudação.',
            classification: 'personal',
          },
        },
        returns: {
          description: 'Mensagem produzida.',
          schema: {
            type: 'string',
            description: 'Texto da saudação.',
            classification: 'personal',
          },
        },
      }],
    }],
    ui: {
      title: 'Saudação',
      body: 'Informe um nome para receber uma saudação.',
      fields: [{
        id: 'name',
        label: 'Nome',
        description: 'Nome usado para criar a mensagem.',
        required: true,
        schema: {
          type: 'string',
          description: 'Nome da pessoa.',
          classification: 'personal',
        },
      }],
      actions: [{
        id: 'greet',
        label: 'Saudar',
        description: 'Cria a saudação.',
        receives: ['name'],
        returns: {
          description: 'Resposta exibida pelo host.',
          schema: {
            type: 'object',
            description: 'Resultado da ação.',
            classification: 'personal',
          },
        },
      }],
    },
    state: [],
    http: [],
    logs: [],
  },
});

const result = validateManifest(manifest);
if (!result.valid) throw new Error(result.errors.join('; '));
```

## Como os serviços conversam

Um add-on não pede um serviço apenas pelo nome. Ele informa também a versão e
os métodos que espera encontrar:

```ts
const greeter = host.services.use<{ greet(name: string): string }>({
  id: 'addons.hello.greeter',
  version: '^1.0.0',
  methods: [{ id: 'greet' }],
});
```

No contrato, `provides` significa “oferece este serviço” e `consumes` significa
“precisa usar este serviço”.

O provedor declara uma versão exata, como `1.0.0`. O consumidor pode aceitar
uma faixa, como `^1.0.0`. O host compara identificador, versão, métodos, entradas
e saídas antes de conectar os dois.

Quando existem vários provedores compatíveis, o host escolhe o de maior
prioridade. Um serviço obrigatório ausente bloqueia o consumidor; um serviço
opcional pode permitir que ele continue, por exemplo usando apenas a memória.

O serviço oficial `state-store` oferece armazenamento serializável. O contrato
limita quais chaves e operações, como leitura ou escrita, cada add-on pode usar.

## Três versões que não devem ser confundidas

| Versão | Exemplo | O que representa |
|---|---|---|
| Pacote npm | `@addons-poc/protocol@1.0.0` | A distribuição da biblioteca |
| Contrato | `contract.version: 1.0.0` | As regras de compatibilidade entre host e add-on |
| Add-on | `manifest.version: 1.0.0` | A versão daquela extensão específica |

Atualizar um add-on não significa necessariamente atualizar o protocolo. Uma
mudança incompatível no protocolo exige uma nova versão major. Remover ou mudar
o significado de um método também exige uma nova versão major daquele serviço.

## O que este pacote publica

As exportações principais estão em [`src/index.ts`](src/index.ts): tipos do
contrato, `defineAddonManifest`, validadores, negociação SemVer, acesso mediado
a serviços, persistência de abas e tipos de `HostAPI`.

O schema equivalente está em
[`schema/addon-contract.schema.json`](schema/addon-contract.schema.json) e pode
ser importado por `@addons-poc/protocol/schema`.

O pacote distribui JavaScript ESM, declarações TypeScript, schema JSON, README,
licença e metadados do `package.json`. Arquivos auxiliares usados apenas nos
testes do workspace não fazem parte da API pública.

O pacote não exporta loader, registro de serviços, catálogo de add-ons ou
helpers de fallback do runtime. Essas responsabilidades ficam em
`packages/host-app/src/runtime`. Add-ons também não dependem do host nem de
outros add-ons: a colaboração acontece pelo protocolo público.

## Limites da versão 1

O protocolo oferece validação e transparência, mas não é uma barreira completa
de segurança:

- não executa o add-on em um ambiente isolado;
- não bloqueia tecnicamente chamadas de internet;
- não comprova quem publicou o manifesto;
- a impressão digital não é uma assinatura criptográfica;
- `onUnload` recebe callbacks, mas o descarregamento completo ao desativar ou
  remover uma instância ainda não está concluído;
- a validação HTTP completa, o cache e a atualização automática ainda estão
  fora desta versão.

Por isso, a v1 foi desenhada para add-ons confiáveis. A declaração em
`contract.http` oferece transparência para revisão, mas ainda não funciona como
uma permissão de rede tecnicamente obrigatória.

## Como instalar e validar

```bash
npm install @addons-poc/protocol@1.0.0
```

No repositório:

```bash
pnpm --filter @addons-poc/protocol test
pnpm --filter @addons-poc/protocol build
cd packages/protocol
npm pack --dry-run
```

`@addons-poc/protocol@1.0.0` já está publicado no npm. Para confirmar a versão
distribuída, execute:

```bash
npm view @addons-poc/protocol@1.0.0 version dist.tarball
```

Uma versão futura exige conta autenticada e propriedade confirmada do escopo
`@addons-poc`. Não existe fallback automático para outro nome.

## Para continuar

Leia a [especificação do manifesto](../../docs/MANIFEST-SPEC.md), a
[arquitetura](../../docs/ARCHITECTURE.md) e o
[índice dos pacotes](../../docs/PACKAGES.md) quando precisar aprofundar os
detalhes técnicos.
