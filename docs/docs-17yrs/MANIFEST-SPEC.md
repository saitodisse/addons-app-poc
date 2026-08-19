# Especificação do Manifesto — O Documento que Apresenta o Add-on

*Tudo que você precisa saber pra criar ou entender um manifesto de add-on.*

---

## 1. O que é um Manifesto?

É um arquivo **JSON** que o add-on publica em algum lugar da internet. Pense como um **cartão de visita** ou uma **embalagem de produto**. Ele diz:

- Quem é o add-on
- Qual a versão
- Quem fez
- O que ele faz
- Onde baixar o código

O host lê o manifesto primeiro, antes de baixar o código de verdade. É tipo ler os ingredientes antes de comprar o produto.

---

## 2. Um Exemplo Completo

```json
{
  "id": "hello",
  "version": "1.0.0",
  "name": "Hello Add-on",
  "description": "Um add-on simples que saúda o usuário",
  "author": "Joaquim Silva",
  "icon": "https://exemplo.com/addons/hello/icon.svg",
  "license": "MIT",
  "entrypoint": "https://exemplo.com/addons/hello/bundle.js",
  "services": [
    {
      "id": "greeter",
      "version": "1.0.0",
      "name": "Serviço de Saudação",
      "description": "Retorna uma saudação personalizada para o usuário"
    }
  ]
}
```

---

## 3. Campo por Campo

### Campos Obrigatórios

| Campo | Tipo | O que é | Exemplo |
|-------|------|---------|---------|
| `id` | string | Nome curto do add-on, em kebab-case (letra minúscula, hífen) | `"hello"`, `"meu-addon"` |
| `version` | string | Versão no formato `X.Y.Z` | `"1.0.0"`, `"2.3.1"` |
| `name` | string | Nome bonito pra mostrar pro usuário | `"Hello Add-on"` |
| `description` | string | O que o add-on faz, em uma frase | `"Um add-on que saúda o usuário"` |
| `author` | string | Quem fez o add-on | `"Joaquim Silva"` |
| `license` | string | Licença de uso (identificador SPDX) | `"MIT"`, `"Apache-2.0"`, `"GPL-3.0"` |
| `entrypoint` | string | URL do arquivo JavaScript do add-on | `"https://.../bundle.js"` |
| `services` | array | Lista de serviços que o add-on oferece | `[{ id: "greeter", ... }]` |

### Campos Opcionais

| Campo | Tipo | O que é |
|-------|------|---------|
| `icon` | string | URL de um ícone (SVG ou PNG) pra mostrar na interface |

### Campos que vão existir no futuro

| Campo | Quando | O que faz |
|-------|--------|-----------|
| `hostVersion` | Fase 3 | Diz qual versão do host o add-on precisa |
| `dependencies` | Fase 3 | Dependências externas que o add-on precisa |

---

## 4. O Serviço (ServiceRegistration)

Cada serviço dentro da lista `services` descreve uma funcionalidade que o add-on oferece.

| Campo | Tipo | O que é | Exemplo |
|-------|------|---------|---------|
| `id` | string | Identificador do serviço | `"greeter"`, `"counter"` |
| `version` | string | Versão da interface do serviço | `"1.0.0"` |
| `name` | string | Nome amigável | `"Serviço de Saudação"` |
| `description` | string | O que o serviço faz | `"Retorna uma saudação personalizada"` |

---

## 4.5 O Outro Formato: Stremio (o add-on é um servidor)

A partir da Fase 3, um add-on pode ser um **servidor na internet** — igual o Torrentio é pro Stremio. Em vez de `services` + `entrypoint` (código que o app importa), ele declara `resources` e responde a pedidos HTTP.

### Exemplo (o add-on Biblioteca de Textos de verdade)

```json
{
  "id": "text-biblioteca",
  "version": "1.0.0",
  "name": "Biblioteca de Textos",
  "description": "Catálogo e busca de textos",
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

### Os campos novos

| Campo | O que é |
|-------|---------|
| `resources` | Os recursos que o add-on atende. Cada um tem `name` (catalog/search/text/meta/subtitles/stream) e `types` (que tipos de conteúdo) |
| `types` | Os tipos de conteúdo: `text`, `quote`, `poem`... |
| `idPrefixes` | Prefixos de id que o add-on aceita (o Torrentio usa `tt` do IMDb) |
| `catalogs` | Listas que o add-on anuncia (ex.: "Textos em Destaque") |

### As rotas do servidor

| Rota | O que responde |
|------|----------------|
| `GET /manifest.json` | O próprio manifesto |
| `GET /catalog/<type>/<id>.json` | Uma lista de itens: `{ metas: [...] }` |
| `GET /search/<type>/<query>.json` | Resultados de busca: `{ metas: [...] }` |
| `GET /text/<type>/<id>.json` | Versões do texto: `{ texts: [{ id, url, lang, name }] }` — igual legendas do Stremio |
| `GET /text/<type>/<id>/content.txt` | O conteúdo, em texto puro |

> **Regra:** um manifesto precisa declarar **ou** `services` (formato em-processo) **ou** `resources` (formato Stremio). Os dois são válidos.

---

## 5. Regras de Validação

### Regras de Estrutura (o que o host verifica)

1. O manifesto precisa ser um JSON válido (não pode estar quebrado)
2. Os campos obrigatórios (`id`, `version`, `name`, `description`, `author`, `license`) precisam existir
3. `id` precisa ser em **kebab-case**: letras minúsculas, números, hífens. Nada de espaços ou caracteres especiais
4. `version` precisa ser no formato `X.Y.Z` (ex: `1.0.0`, `2.3.1`)
5. O manifesto precisa ter **ou** `services` (formato em-processo) **ou** `resources` (formato Stremio)
6. No formato em-processo: `entrypoint` precisa ser uma URL absoluta (`http://` ou `https://`) e `services` precisa ter pelo menos um item
7. No formato Stremio: cada `resource` precisa ter `name` válido (catalog/search/text/meta/subtitles/stream) e `types` não vazio
8. `catalogs` precisa referenciar tipos que existem no manifesto
9. Cada serviço precisa ter `id`, `version`, `name`, `description` não vazios

### Regras de Negócio (como o sistema interpreta)

1. O `id` no manifesto é só um nome bonito. A **identidade real** é a URL onde o manifesto está
2. Dois manifests na mesma URL são o mesmo add-on, mesmo que o conteúdo tenha mudado
3. Se você mudar o entrypoint, precisa aumentar a versão do manifesto
4. Serviços com o mesmo `id` em add-ons diferentes competem por prioridade

---

## 6. Exemplo Mínimo

O menor manifesto possível que ainda é válido:

```json
{
  "id": "minimo",
  "version": "1.0.0",
  "name": "Add-on Mínimo",
  "description": "O mínimo que um add-on precisa ter",
  "author": "Autor",
  "license": "MIT",
  "entrypoint": "https://exemplo.com/addons/minimo/bundle.js",
  "services": [
    {
      "id": "exemplo",
      "version": "1.0.0",
      "name": "Serviço de Exemplo",
      "description": "Um serviço mínimo"
    }
  ]
}
```

---

## 7. Como o Host Valida

O host tem uma função chamada `validateManifest()` que recebe o JSON e devolve:

```typescript
{
  valid: true,           // true se passou, false se não
  errors: []             // lista de erros (vazia se válido)
}
```

Se vier `{ valid: false, errors: ["Campo 'id' é obrigatório"] }`, o host rejeita o add-on e mostra o erro.

---

## 8. Versionamento

Coisas importantes sobre versão:

- O add-on declara a versão dele no manifesto. O host pode usar isso pra saber se o formato é compatível.
- Cada serviço declara sua própria versão. Isso permite que interfaces evoluam independentemente.
- Na Fase 3, o host vai negociar versões: se o add-on precisar de uma versão do host que não existe, ele não carrega.

---

## 9. Resumo

O manifesto é:

- **Um arquivo JSON** → fácil de ler, fácil de validar
- **Hospedado em qualquer URL** → não precisa de loja, não precisa de aprovação
- **Lido antes de executar código** → seguro, o host pode inspecionar antes de confiar
- **A identidade do add-on** → a URL do manifesto é o RG do add-on