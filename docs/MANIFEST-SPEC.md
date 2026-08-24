# Especificação do manifesto de add-on

**Status: Entregue · Versão 1.0.0**

Os exemplos de implementação de cada manifesto estão nos READMEs listados em
[`PACKAGES.md`](PACKAGES.md). O contrato desta página é a referência comum ao
host, ao protocolo e aos add-ons.

## Por que

O host precisa decidir se consegue instalar uma extensão antes de importar o
bundle ou chamar um servidor. Um manifesto completo torna essa decisão legível
para pessoas e verificável por código.

## O que

A URL completa do manifesto é a identidade do add-on. O formato legado não é
aceito. Todo manifesto tem metadados e uma única seção `contract` v1. O
contrato é uma fronteira de compatibilidade e governança para plugins
confiáveis; ele não é um sandbox.

## Manifesto mínimo

```json
{
  "id": "hello",
  "version": "1.0.0",
  "name": "Hello Add-on",
  "description": "Oferece uma saudação.",
  "author": "Equipe AC",
  "license": "MIT",
  "entrypoint": "https://example.com/addons/hello/bundle.js",
  "contract": {
    "version": "1.0.0",
    "protocol": { "version": "1.0.0", "range": "^1.0.0" },
    "capabilities": {
      "required": ["registry.services", "ui.tab"],
      "optional": ["logs", "state-store"]
    },
    "services": [{
      "id": "addons.hello.greeter",
      "role": "provides",
      "version": "1.0.0",
      "name": "Greeter",
      "description": "Cria saudações.",
      "methods": [{
        "id": "greet",
        "description": "Saúda um nome.",
        "receives": { "description": "Nome", "schema": { "type": "string", "description": "Nome", "classification": "personal" } },
        "returns": { "description": "Saudação", "schema": { "type": "string", "description": "Texto", "classification": "personal" } }
      }]
    }],
    "ui": {
      "title": "Hello",
      "body": "Digite um nome.",
      "fields": [{ "id": "name", "label": "Seu nome", "description": "Nome usado na saudação.", "required": true, "schema": { "type": "string", "description": "Nome", "classification": "personal" } }],
      "actions": [{ "id": "greet", "label": "Saudar", "description": "Cria a saudação.", "receives": ["name"], "returns": { "description": "Resposta", "schema": { "type": "object", "description": "Resposta da aba", "classification": "personal" } } }]
    },
    "state": [],
    "http": [],
    "logs": []
  }
}
```

`entrypoint` existe apenas para add-ons em processo. Um bundle em processo
exporta `manifest`, `setup(host)` e `createTab(host)`. Um add-on HTTP omite
`entrypoint` e declara seus recursos em `contract.resources`, relacionados às
interações HTTP recebidas do mesmo `contract`; o servidor continua respondendo
`GET /manifest.json` e as rotas de catálogo, busca e texto.

## Como o host valida

1. Confere metadados (`id` em kebab-case, versão `X.Y.Z`, autor, licença e
   descrição).
2. Confere `contract.version`, a versão do protocolo e a faixa SemVer.
3. Confere capacidades oficiais (`registry.services`, `ui.tab`, `logs`,
   `state-store`) ou nomes namespaceados.
4. Confere descritores: cada serviço tem `id`, papel, versão, métodos e
   schemas. Um provedor publica uma versão exata; um consumidor pode declarar
   uma faixa `^` ou `~`. Serviços não oficiais usam `namespace.nome`.
5. Confere UI, estado, HTTP e logs. O subconjunto de JSON Schema aceita
   `string`, `number`, `integer`, `boolean`, `null`, `object` e `array`, além
   de `properties`, `required`, `items`, `enum`, `uri` e `date-time`.
6. Negocia as capacidades e serviços obrigatórios disponíveis no host.

O validador canônico é `validateManifest` de `@addons-poc/protocol`. O schema
JSON distribuído pode ser importado por `@addons-poc/protocol/schema`.
O pacote público não exporta `ServiceRegistry`, loader ou helpers de fallback;
essas responsabilidades ficam no runtime do host.

## Serviços e proxy tipada

O add-on não usa a API legada de consulta por string. Ele solicita o contrato que precisa:

```ts
const greeter = host.services.use<Greeter>({
  id: 'addons.hello.greeter',
  version: '1.0.0',
  methods: [{ id: 'greet' }]
});
```

O host só entrega um serviço declarado pelo consumidor ou provedor. Métodos,
entradas e saídas precisam permanecer compatíveis. Alterar o significado ou
remover método exige uma versão major nova do serviço. Provedores são
ordenados por prioridade; fallback é uma operação explícita do runtime.

O serviço oficial opcional `state-store` pode ser fornecido pelo host ou por
um add-on. O consumidor marca `required: true` quando não consegue operar sem
ele. Sem provedor, um consumidor opcional continua em memória.

## UI, estado, HTTP e logs

`contract.ui` declara título, corpo, campos, ações e schemas das respostas.
`contract.state` declara chave ou padrão, operações, retenção e exclusão.
`contract.http` registra entradas e saídas, com método, rota-modelo, origem e
finalidade. `contract.logs` descreve eventos estruturados e sua classificação.

O host valida ações e estado no runtime. I/O externo direto continua possível
para plugins confiáveis: a declaração HTTP é transparência e revisão, não
interceptação. `onUnload`, sandbox e proxy de rede estão fora da v1.

## Compatibilidade e estados

Antes de importar um bundle, o host pode recusar um contrato incompatível. Um
serviço obrigatório ausente deixa a instalação bloqueada e ela é reavaliada
quando um provedor compatível surge. Dependências obrigatórias em ciclo são
bloqueadas. Falha de `setup` limpa os registros parciais e deixa a instância
em `error`.

Depois da revisão humana, o host guarda uma impressão digital do `contract`
junto da URL. Mudança na mesma URL exige nova revisão. A impressão digital não
é assinatura criptográfica nem prova autoria.

## Perfil HTTP de texto

Os recursos de texto mantêm o envelope:

```json
{ "texts": [{ "id": "texto-1", "url": "https://example.com/text/texto-1/content.txt", "lang": "pt-BR", "name": "Versão principal" }] }
```

Catálogo e busca devolvem metadados. O conteúdo só é buscado quando a pessoa
abre uma opção. O servidor é ESM puro, não conhece React e não depende do
runtime interno do host.
