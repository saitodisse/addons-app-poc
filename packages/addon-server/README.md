# `@addons/addon-server`

Servidor HTTP ESM para add-ons de recursos de texto.

## Por que este pacote existe

Um add-on remoto precisa ser hospedado sem carregar o runtime TypeScript do host. Este pacote concentra apenas o servidor HTTP e a validação do manifesto pelo protocolo público.

## O que ele oferece

`createAddonServer` recebe um manifesto v1, uma porta e quatro handlers:

| Handler | Rota | Resposta |
| --- | --- | --- |
| `catalog` | `GET /catalog/{type}/{catalogId}.json` | `{ metas: [...] }` |
| `search` | `GET /search/{type}/{query}.json` | `{ metas: [...] }` |
| `text` | `GET /text/{type}/{id}.json` | `{ texts: [{ id, url, lang, name }] }` |
| `content` | `GET /text/{type}/{id}/content.txt` | texto puro |

Também publica `GET /manifest.json`, responde CORS para a demonstração local e converte URLs relativas de conteúdo em URLs absolutas do servidor.

## Como usar

```js
import { createAddonServer } from '@addons/addon-server';
import { manifest } from './manifest.js';

const server = await createAddonServer({
  manifest,
  port: 5291,
  handlers: { catalog, search, text, content },
});

console.log(server.manifestUrl);
```

O servidor chama `validateManifest` de `@addons-poc/protocol` antes de abrir a porta. O manifesto deve declarar `contract.resources`, as interações HTTP de entrada e todo I/O externo em `contract.http`. O pacote usa JavaScript ESM e não tem dependências externas de runtime além do protocolo público.

## Desenvolvimento

```bash
pnpm --filter @addons/addon-server test
pnpm --filter @addons/addon-text-biblioteca serve
```

Os quatro consumidores estão documentados no [índice dos pacotes](../../docs/PACKAGES.md). O host conhece somente a URL do manifesto; não importa este servidor nem os handlers de um add-on específico.

## Limites

Este servidor não é sandbox e não intercepta chamadas de rede feitas pelos handlers. O add-on é confiável para a POC e deve declarar seus destinos externos no manifesto para revisão humana.
