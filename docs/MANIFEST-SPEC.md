# Especificação do Manifesto de Add-on

**Versão: 1.0.0** · **Status: Planejado**

---

## 1. Propósito

O manifesto é o documento que um add-on publica para se anunciar. Ele contém tudo que o host precisa saber para carregar e integrar o add-on: identidade, metadados, entrypoint, e lista de serviços oferecidos.

O manifesto é um arquivo JSON. Ele pode estar hospedado em qualquer URL acessível por HTTP GET.

> **Dois formatos são suportados:**
> - **Em-processo** (`services` + `entrypoint`): o add-on é um bundle ESM importado com `import()`, que registra serviços no registry (Fases 1–2).
> - **Stremio/HTTP** (`resources` + `types`): o add-on é um **servidor HTTP** (como o Torrentio no Stremio) que declara `resources` (catalog/search/text) e responde em endpoints `/<resource>/<type>/<id>.json` (Fase 3).

---

## 2. Exemplo Completo

```json
{
  "id": "hello",
  "version": "1.0.0",
  "name": "Hello Add-on",
  "description": "Um add-on simples que saúda o usuário",
  "author": "Joaquim Silva",
  "icon": "https://example.com/addons/hello/icon.svg",
  "license": "MIT",
  "entrypoint": "https://example.com/addons/hello/bundle.js",
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

## 3. Campos

### 3.1 Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador amigável do add-on. Deve ser curto, em kebab-case. Ex: `"hello"`, `"counter"` |
| `version` | string | Versão semântica do add-on. Ex: `"1.0.0"`, `"2.3.1"` |
| `name` | string | Nome legível para exibição na interface do usuário. Ex: `"Hello Add-on"` |
| `description` | string | Descrição curta do que o add-on faz. Ex: `"Um add-on simples que saúda o usuário"` |
| `author` | string | Nome do autor ou organização. Ex: `"Joaquim Silva"` |
| `license` | string | Identificador SPDX da licença. Ex: `"MIT"`, `"Apache-2.0"`, `"GPL-3.0"` |
| `entrypoint` | string | URL absoluta do bundle JavaScript ESM do add-on. Deve ser acessível via HTTP GET |
| `services` | ServiceRegistration[] | Lista de serviços que o add-on implementa. Deve ter pelo menos um item |

### 3.2 Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `icon` | string | URL absoluta de um ícone para o add-on. Deve ser uma imagem SVG ou PNG |

### 3.3 Campos do Formato Stremio (Add-on HTTP)

Neste formato, o add-on **é** um servidor HTTP (inspirado no protocolo Stremio, referência Torrentio). A URL do servidor é a identidade; o manifesto é servido em `/manifest.json`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `resources` | AddonResource[] | Recursos que o add-on atende. Cada um tem `name` (catalog/search/text/meta/subtitles/stream), `types[]` e opcional `idPrefixes[]` |
| `types` | string[] | Tipos de conteúdo atendidos (ex.: `["text"]`, `["quote"]`, `["poem"]`) |
| `idPrefixes` | string[] | Prefixos de id aceitos (como `tt` do IMDb no Torrentio) |
| `catalogs` | AddonCatalog[] | Catálogos anunciados: `{ type, id, name }` |

**Exemplo (formato Stremio):**

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
    { "type": "text", "id": "classicos", "name": "Textos Clássicos" }
  ]
}
```

**Endpoints servidos pelo add-on (estilo Stremio):**

| Endpoint | Resposta |
|----------|----------|
| `GET /manifest.json` | O próprio manifesto |
| `GET /catalog/<type>/<catalogId>.json` | `{ "metas": [TextMeta] }` |
| `GET /search/<type>/<query>.json` | `{ "metas": [TextMeta] }` |
| `GET /text/<type>/<id>.json` | `{ "texts": [TextItem] }` — formato subtitles: cada item tem `url` apontando para o conteúdo |
| `GET /text/<type>/<id>/content.txt` | Conteúdo em texto puro (como um arquivo SRT) |

### 3.4 Campos Reservados para Versões Futuras

| Campo | Tipo | Previsto para |
|-------|------|---------------|
| `hostVersion` | string | Fase 3 — versão do host com a qual o add-on é compatível. Ex: `">=1.0.0"` |
| `dependencies` | Record<string, string> | Fase 3 — dependências externas com versões. Ex: `{ "@achorde/musical-domain": ">=0.6.0" }` |

---

## 4. ServiceRegistration

Cada item da lista `services` descreve um serviço que o add-on implementa.

### 4.1 Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador do serviço. Deve ser único dentro do add-on. Ex: `"greeter"`, `"counter"` |
| `version` | string | Versão semântica da interface do serviço |
| `name` | string | Nome legível do serviço |
| `description` | string | Descrição do que o serviço faz |

---

## 5. Regras de Validação

### 5.1 Regras de Estrutura

1. O manifesto deve ser um objeto JSON válido
2. `id`, `version`, `name`, `description`, `author`, `license` são sempre obrigatórios
3. O manifesto deve declarar **ou** `services` (em-processo) **ou** `resources` (Stremio/HTTP)
4. No formato em-processo, `entrypoint` deve ser uma URL absoluta (`http://`/`https://`) e `services` deve ter ao menos um item
5. No formato Stremio, cada `resource` deve ter `name` em {catalog, search, text, meta, subtitles, stream} e `types` não vazio
6. `catalogs[]` deve referenciar tipos declarados em `types` ou nos `resources`
7. `id` deve ser uma string não vazia, em kebab-case (letras minúsculas, hífens)
8. `version` deve seguir o formato semântico `X.Y.Z` onde X, Y, Z são inteiros não negativos
9. `license` deve ser um identificador SPDX válido

### 5.2 Regras de Negócio

1. O `id` do manifesto é o nome amigável. A identidade real do add-on é a URL onde o manifesto está hospedado
2. Dois manifests com a mesma URL são considerados o mesmo add-on, mesmo que o conteúdo interno tenha mudado
3. A versão do manifesto deve ser incrementada quando o entrypoint muda
4. Serviços com o mesmo `id` em add-ons diferentes competem por prioridade

---

## 6. Content-Type

O manifesto deve ser servido com `Content-Type: application/json` ou `Content-Type: application/manifest+json`.

---

## 7. Exemplo Mínimo

```json
{
  "id": "minimo",
  "version": "1.0.0",
  "name": "Add-on Mínimo",
  "description": "O mínimo que um add-on precisa ter",
  "author": "Autor",
  "license": "MIT",
  "entrypoint": "https://example.com/addons/minimo/bundle.js",
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

## 8. Validação no Código

A função `validateManifest(manifest: unknown): ValidationResult` em `@addons/core` implementa todas as regras acima. Retorna um objeto com `{ valid: boolean, errors: string[] }`.

---

## 9. Considerações de Versionamento

- O add-on declara a versão do manifesto. O host pode usar isso para saber se o formato é compatível.
- Cada serviço declara sua própria versão. Isso permite que interfaces evoluam independentemente.
- Na Fase 3, o host negociará versões: se o add-on requer uma versão do host que o host não tem, o add-on não carrega.