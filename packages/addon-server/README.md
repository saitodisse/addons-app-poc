# `@addons/addon-server`

Servidor HTTP ESM para add-ons de recursos de texto.

## Por que este pacote existe

Um add-on remoto precisa ser hospedado sem carregar o runtime TypeScript do host. Este pacote concentra apenas o servidor HTTP e a validação do manifesto pelo protocolo público.

## O que ele oferece

`createAddonServer` recebe um manifesto v1, uma porta e quatro handlers principais, além de handlers opcionais:

| Handler | Rota | Resposta |
| --- | --- | --- |
| `catalog` | `GET /catalog/{type}/{catalogId}.json?limit=20&cursor=...` | `{ metas: [...], pagination? }` |
| `search` | `GET /search/{type}/{query}.json?limit=20&cursor=...` | `{ metas: [...], pagination? }` |
| `text` | `GET /text/{type}/{id}.json` | `{ texts: [{ id, url, lang, name }] }` |
| `content` | `GET /text/{type}/{id}/content.txt` | texto puro |
| `contentJson` (opcional) | `GET /text/{type}/{id}/content.json` | objeto estruturado; pode retornar `{ body, headers }` |
| `debugTraffic` (opcional) | `GET /debug/traffic.json` | histórico local de requests e responses |

Também publica `GET /manifest.json`, responde CORS para a demonstração local,
converte URLs relativas de conteúdo em URLs absolutas do servidor e repassa
`limit` e `cursor` aos handlers de catálogo e busca. O cursor é opaco para o
servidor comum: cada add-on decide como interpretá-lo.

`contentJson` é uma extensão paralela: não altera o texto puro de `content`.
Quando o handler retorna `{ body, headers }`, o servidor serializa `body` como
JSON, preserva os headers adicionais e calcula `Content-Length` para o corpo
entregue.

Quando `handlers.debugTraffic` é fornecido, o servidor também publica um
histórico local. `onTraffic` recebe cada request de entrada e response de
saída, incluindo URL, headers, status, duração e corpo completo. A rota de
debug não registra a própria leitura para não criar um ciclo de observabilidade.
Cabeçalhos de autenticação, sessão, chave de API e IP são redigidos antes do
registro; os demais campos continuam disponíveis.

## Como usar

```js
import { createAddonServer } from '@addons/addon-server';
import { manifest } from './manifest.js';

const server = await createAddonServer({
  manifest,
  port: 5294,
  handlers: { catalog, search, text, content },
});

console.log(server.manifestUrl);
```

O servidor chama `validateManifest` de `@addons-poc/protocol` antes de abrir a porta. O manifesto deve declarar `contract.resources`, as interações HTTP de entrada e todo I/O externo em `contract.http`. O pacote usa JavaScript ESM e não tem dependências externas de runtime além do protocolo público.

## Desenvolvimento

```bash
pnpm --filter @addons/addon-server test
pnpm --filter @addons/addon-text-wikipedia serve
```

O consumidor restante está documentado no [índice dos pacotes](../../docs/PACKAGES.md). O host conhece somente a URL do manifesto; não importa este servidor nem os handlers de um add-on específico.

## Limites

Este servidor não é sandbox. O callback `onTraffic` só observa as requisições
que o servidor recebe e as respostas que entrega; cada handler precisa registrar
as chamadas de rede externas que fizer. O add-on é confiável para a POC e deve
declarar seus destinos externos no manifesto para revisão humana.
