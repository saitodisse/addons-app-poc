# Especificação do Manifesto de Add-on

**Versão: 1.0.0** · **Status: Planejado**

---

## 1. Propósito

O manifesto é o documento que um add-on publica para se anunciar. Ele contém tudo que o host precisa saber para carregar e integrar o add-on: identidade, metadados, entrypoint, e lista de serviços oferecidos.

O manifesto é um arquivo JSON. Ele pode estar hospedado em qualquer URL acessível por HTTP GET.

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

### 3.3 Campos Reservados para Versões Futuras

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
2. Todos os campos obrigatórios devem estar presentes
3. `id` deve ser uma string não vazia, em kebab-case (letras minúsculas, hífens)
4. `version` deve seguir o formato semântico `X.Y.Z` onde X, Y, Z são inteiros não negativos
5. `entrypoint` deve ser uma URL absoluta válida (começando com `http://` ou `https://`)
6. `services` deve ser um array com pelo menos um item
7. Cada serviço deve ter `id`, `version`, `name`, `description` não vazios
8. `license` deve ser um identificador SPDX válido

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