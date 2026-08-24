# `@addons-poc/protocol`

Contrato público, schema JSON, validadores, negociação SemVer e SDK de autoria para add-ons confiáveis.

Versão `1.0.0` · Licença [MIT](LICENSE) · pacote ESM público.

## Por que este pacote existe

Hosts e add-ons precisam compartilhar regras sem compartilhar implementações. Este pacote é a fronteira de compatibilidade: um host pode validar e mediar um add-on de qualquer origem, e um add-on pode declarar o que oferece sem importar o runtime do host.

O protocolo é uma fronteira de compatibilidade e governança, não um sandbox. APIs globais continuam disponíveis para plugins confiáveis; qualquer I/O externo deve ser declarado em `contract.http` e revisado.

## O que ele publica

O manifesto v1 possui uma única seção `contract` com:

- versão e faixa SemVer do protocolo;
- capacidades obrigatórias e opcionais (`registry.services`, `ui.tab`, `logs` e `state-store`);
- serviços fornecidos ou consumidos, descritores serializados, versões, prioridades, métodos e schemas de entrada/saída;
- UI declarativa, estado, HTTP e logs.

Os identificadores oficiais são `state-store` e as capacidades canônicas do host. Serviços próprios usam nomes namespaceados, por exemplo `addons.hello.greeter`. Um consumidor é compatível somente quando o identificador, a faixa SemVer, os métodos e os schemas compartilhados são compatíveis.

O runtime do host — loader, registro, escolha de provedor, status e adaptadores — não é exportado por este pacote. Ele vive em `packages/host-app/src/runtime`.

O pacote publicado inclui `dist`, o schema, este README, a licença e os metadados do `package.json`. Arquivos auxiliares mantidos no workspace para testes de migração não entram na distribuição nem na API pública.

## Como usar

```bash
npm install @addons-poc/protocol@1.0.0
```

```ts
import {
  defineAddonManifest,
  validateManifest,
  type HostAPI,
} from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'hello',
  name: 'Hello',
  version: '1.0.0',
  description: 'Exemplo de add-on',
  author: 'Equipe',
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['ui.tab', 'logs'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [],
    logs: [],
  },
});

const result = validateManifest(manifest);
if (!result.valid) throw new Error(result.errors.join('; '));
```

Um add-on em processo exporta `manifest`, `setup(host)` e `createTab(host)`. Dentro do `setup`, o acesso é sempre mediado pelo contrato:

```ts
const service = host.services.use<{ greet(name: string): string }>({
  id: 'addons.hello.greeter',
  version: '^1.0.0',
  methods: [{ id: 'greet' }],
});
```

`host.registerService` só aceita serviços declarados como `provides`. Chamadas, entradas, saídas, estado, ações da aba e logs são validados em runtime. `onUnload` registra callbacks de limpeza para o ciclo interno de erro; o descarregamento mediado de uma instância ativa ainda está fora da v1.

## Exportações e distribuição

As exportações principais estão em [`src/index.ts`](src/index.ts): tipos do contrato, `defineAddonManifest`, validadores, SemVer, acesso mediado a serviços, persistência de aba e tipos de `HostAPI`.

O schema equivalente está em [`schema/addon-contract.schema.json`](schema/addon-contract.schema.json) e é exportado por `@addons-poc/protocol/schema` para ferramentas que carregam JSON (ou por um import ESM com atributo `type: 'json'`).

A distribuição publica ESM e declarações TypeScript em `dist`. Para validar o pacote localmente:

```bash
pnpm --filter @addons-poc/protocol test
pnpm --filter @addons-poc/protocol build
cd packages/protocol
npm pack --dry-run
```

O envio público de `@addons-poc/protocol@1.0.0` requer uma conta autenticada e propriedade confirmada do escopo `@addons-poc`; não há fallback automático para outro nome.

## Limites de compatibilidade

Esta versão não oferece compatibilidade com o formato legado, `onUnload` remoto, sandbox ou proxy de rede. Mudanças incompatíveis no contrato exigem uma major nova do protocolo ou do serviço. O host pode bloquear instalação, ativação ou reativação quando a negociação falhar.

Leia a [especificação do manifesto](../../docs/MANIFEST-SPEC.md), a [arquitetura](../../docs/ARCHITECTURE.md) e o [índice dos pacotes](../../docs/PACKAGES.md) antes de publicar um add-on.
