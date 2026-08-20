# Especificação do manifesto de add-on

**Status: Entregue** · **Versão do documento: 1.0**

O manifesto é a apresentação do add-on. Antes de executar código ou consultar recursos, o host lê esse pequeno objeto JSON para descobrir quem publicou a extensão, qual versão está disponível e quais capacidades ela oferece.

Este documento começa com exemplos práticos e termina nas regras exatas aplicadas por `validateManifest`.

## Por que o manifesto existe

Sem um manifesto, o host precisaria baixar código e investigá-lo para descobrir o que existe ali. Isso seria lento, inseguro e difícil de explicar ao usuário.

Com o manifesto, a conversa começa de forma declarativa: o add-on descreve suas capacidades, e o host decide se consegue consumi-las. A URL desse documento é a identidade do add-on.

## Os dois formatos

O protocolo reconhece duas formas de oferecer capacidades:

| Formato | Quando usar | Campos característicos |
|---|---|---|
| Em processo | O código deve executar dentro do host | `entrypoint` e `services` |
| HTTP | O add-on funciona como servidor independente | `resources`, `types` e `catalogs` |

O validador atual aceita um manifesto híbrido que declare `services` e `resources`. Porém, os consumidores tratam cada formato por fluxos diferentes. Prefira um formato por manifesto até existir um caso de uso e uma regra de interoperabilidade explícitos.

## Exemplo em processo

```json
{
  "id": "hello",
  "version": "1.0.0",
  "name": "Hello Add-on",
  "description": "Oferece um serviço de saudação",
  "author": "Equipe AC",
  "icon": "https://example.com/hello/icon.png",
  "license": "MIT",
  "entrypoint": "https://example.com/hello/bundle.js",
  "services": [
    {
      "id": "greeter",
      "version": "1.0.0",
      "name": "Greeter",
      "description": "Cria uma saudação para um nome"
    }
  ]
}
```

O host valida o objeto, importa `entrypoint` como módulo ESM e espera que o bundle exporte `manifest` e `setup`.

## Exemplo HTTP

```json
{
  "id": "text-biblioteca",
  "version": "1.0.0",
  "name": "Biblioteca de Textos",
  "description": "Catálogo de textos curtos",
  "author": "Equipe AC",
  "license": "MIT",
  "resources": [
    { "name": "catalog", "types": ["text"], "idPrefixes": [] },
    { "name": "search", "types": ["text"], "idPrefixes": [] },
    { "name": "text", "types": ["text"], "idPrefixes": [] }
  ],
  "types": ["text"],
  "idPrefixes": [],
  "catalogs": [
    { "type": "text", "id": "destaques", "name": "Textos em Destaque" }
  ]
}
```

O host obtém esse objeto em `GET /manifest.json`. Depois, usa os recursos declarados para montar as demais rotas.

## Campos comuns

### Obrigatórios

| Campo | Tipo | Significado | Regra atual |
|---|---|---|---|
| `id` | `string` | Nome técnico legível | Deve usar kebab-case e começar com letra minúscula |
| `version` | `string` | Versão do add-on | Deve seguir `X.Y.Z`, com números inteiros |
| `name` | `string` | Nome para exibição | Não pode ser vazio |
| `description` | `string` | Resumo da capacidade | Não pode ser vazio |
| `author` | `string` | Responsável declarado | Não pode ser vazio |
| `license` | `string` | Licença declarada | Não pode ser vazio |

O padrão aceito para `id` é:

```regex
^[a-z][a-z0-9-]*$
```

Exemplos válidos incluem `hello`, `text-biblioteca` e `addon-2`. `Meu Addon`, `2-addon` e `addon_especial` são inválidos.

A validação de versão é deliberadamente pequena:

```regex
^\d+\.\d+\.\d+$
```

Ela aceita `1.0.0` e `12.4.9`, mas não implementa toda a especificação SemVer. Sufixos como `1.0.0-beta.1` ainda são rejeitados.

### Opcional

| Campo | Tipo | Significado |
|---|---|---|
| `icon` | `string` | URL de uma imagem para interface |

O validador atual não verifica se `icon` é uma URL válida. Consumidores não devem assumir que o valor é seguro apenas porque o manifesto passou na validação.

## Formato em processo

### `entrypoint`

`entrypoint` aponta para o bundle ESM:

```json
"entrypoint": "https://example.com/addons/hello/bundle.js"
```

Quando o manifesto declara `services` e não declara `resources`, o campo é obrigatório e deve começar com `http://` ou `https://`.

O `FetchAddonLoader` também exige `entrypoint` antes de importar qualquer manifesto pelo fluxo em processo, inclusive um manifesto híbrido.

### `services`

`services` é uma lista não vazia de capacidades declaradas:

```typescript
interface ServiceRegistration {
  id: string;
  version: string;
  name: string;
  description: string;
}
```

| Campo | Função |
|---|---|
| `id` | Chave usada no `ServiceRegistry` |
| `version` | Versão do contrato do serviço |
| `name` | Nome legível |
| `description` | Explicação breve do comportamento |

Hoje, o validador verifica apenas se os quatro valores existem. Ele ainda não aplica kebab-case ao ID do serviço nem SemVer à versão do serviço.

## Formato HTTP

### `resources`

Cada item declara uma família de rota que o servidor atende:

```typescript
type AddonResourceName =
  | 'catalog'
  | 'search'
  | 'text'
  | 'meta'
  | 'subtitles'
  | 'stream';

interface AddonResource {
  name: AddonResourceName;
  types: string[];
  idPrefixes?: string[];
}
```

`types` deve ser uma lista não vazia. `idPrefixes` pode limitar identificadores aceitos, como o prefixo `tt` usado por IDs do IMDb. Os add-ons desta POC usam listas vazias, portanto não restringem IDs por prefixo.

O servidor genérico desta POC implementa handlers para `catalog`, `search`, `text` e `content`. Embora a validação reconheça também `meta`, `subtitles` e `stream`, declarar esses recursos não cria automaticamente rotas correspondentes no `@addons/addon-server` atual.

### `types`

`types` reúne os tipos de conteúdo anunciados pelo add-on:

```json
"types": ["text"]
```

Os exemplos atuais usam `text`, `quote`, `poem` e `page`. O validador usa esse campo ao conferir catálogos, mas ainda não exige sua presença quando os tipos já aparecem dentro de `resources`.

### `idPrefixes`

É uma lista opcional de prefixos globais aceitos pelo add-on:

```json
"idPrefixes": ["book-"]
```

O tipo está definido no contrato, mas o cliente e o servidor atuais não aplicam filtragem automática com base nesse campo.

### `catalogs`

Um catálogo é uma coleção navegável:

```typescript
interface AddonCatalog {
  type: string;
  id: string;
  name: string;
}
```

O `type` precisa aparecer em `types` ou em algum `resources[].types`. `id` e `name` precisam existir.

## Rotas e respostas

### Manifesto

```http
GET /manifest.json
Content-Type: application/json
```

Resposta: o próprio manifesto.

### Catálogo

```http
GET /catalog/<type>/<catalogId>.json
```

```json
{
  "metas": [
    {
      "id": "texto-1",
      "type": "text",
      "name": "Um texto",
      "description": "Resumo opcional",
      "author": "Autor opcional"
    }
  ]
}
```

### Busca

```http
GET /search/<type>/<query>.json
```

A resposta também usa `{ "metas": [...] }`.

### Opções de texto

```http
GET /text/<type>/<id>.json
```

```json
{
  "texts": [
    {
      "id": "texto-1-principal",
      "url": "http://localhost:5291/text/text/texto-1/content.txt",
      "lang": "pt-BR",
      "name": "Versão principal"
    }
  ]
}
```

Uma URL relativa iniciada por `/` é convertida pelo servidor em URL absoluta.

### Conteúdo

```http
GET /text/<type>/<id>/content.txt
Content-Type: text/plain; charset=utf-8
```

Essa rota entrega o conteúdo sem embrulhá-lo em JSON.

## Regras de validação

`validateManifest(data)` devolve:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Ordem aplicada hoje

1. O valor precisa ser um objeto.
2. Os seis campos comuns obrigatórios precisam existir e não podem ser vazios.
3. Se algum deles faltar, a função retorna imediatamente esses erros.
4. `id` e `version` são verificados pelos padrões descritos acima.
5. Pelo menos uma lista não vazia de `services` ou `resources` precisa existir.
6. O formato em processo exige `entrypoint` quando há `services` sem `resources`.
7. Serviços, recursos e catálogos são verificados quando presentes.

### O que a validação ainda não garante

Passar em `validateManifest` não prova que:

- as URLs estão acessíveis ou são confiáveis;
- o bundle exporta `manifest` e `setup` válidos;
- o manifesto do bundle corresponde ao JSON baixado;
- a implementação cumpre a interface declarada pelo serviço;
- o servidor realmente implementa todos os recursos declarados;
- respostas HTTP seguem os modelos esperados;
- versão, licença ou autor são verdadeiros;
- o conteúdo é seguro para renderização.

Essas verificações pertencem ao carregamento, ao cliente, a políticas de confiança ou a evoluções futuras do protocolo.

## Exemplos mínimos

### Em processo

```json
{
  "id": "minimo",
  "version": "1.0.0",
  "name": "Add-on Mínimo",
  "description": "Demonstra o menor manifesto em processo",
  "author": "Autor",
  "license": "MIT",
  "entrypoint": "https://example.com/minimo.js",
  "services": [
    {
      "id": "example",
      "version": "1.0.0",
      "name": "Exemplo",
      "description": "Serviço mínimo"
    }
  ]
}
```

### HTTP

```json
{
  "id": "text-minimo",
  "version": "1.0.0",
  "name": "Texto Mínimo",
  "description": "Demonstra o menor manifesto HTTP",
  "author": "Autor",
  "license": "MIT",
  "resources": [
    { "name": "text", "types": ["text"] }
  ]
}
```

## Como evoluir o contrato

Uma mudança compatível pode adicionar um campo opcional que consumidores antigos ignorem. Uma mudança incompatível altera o significado de um campo, torna algo antes opcional obrigatório ou remove um valor aceito.

Ao evoluir esta especificação:

1. atualize os tipos em `packages/core/src/domain/manifest.ts`;
2. atualize `validateManifest` e seus testes;
3. avalie a validação mínima de `@addons/addon-server`;
4. atualize clientes, exemplos e este documento;
5. registre a consequência em `DECISIONS.md` e `CHANGELOG.md`.

Negociação entre a versão exigida pelo add-on e a versão do host ainda está planejada.
