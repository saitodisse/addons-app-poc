# `@addons/host-app`

Runtime e interface do host para a POC de add-ons.

## Por que este pacote existe

O host precisa carregar add-ons por URL sem importar implementações conhecidas. A separação deixa o protocolo público estável e mantém decisões de execução — loader, registro, estados e adaptadores — dentro do aplicativo.

## O que ele oferece

O host busca e valida `manifest.json`, negocia a versão do protocolo e as capacidades, revisa o contrato, importa bundles ESM em processo e apresenta servidores HTTP. A interface é genérica: não existe catálogo embutido, alias ou dependência de `@addons/addon-*` no pacote. Em Configurações, a lista local consulta somente `name` e `description` dos manifestos para facilitar o preenchimento.

Capacidades canônicas do host:

- `registry.services`: registro mediado de serviços;
- `ui.tab`: aba declarativa;
- `logs`: logs estruturados;
- `state-store`: provedor opcional de estado serializável.

O registro interno ordena provedores por prioridade e nome do add-on. Serviços obrigatórios ausentes deixam a instalação bloqueada; quando um provedor aparece, o host pode reavaliá-la. Dependências obrigatórias em ciclo também são bloqueadas.

## Como funciona

O runtime está em [`src/runtime`](src/runtime):

- [`loader.ts`](src/runtime/loader.ts) implementa `FetchAddonLoader`, valida o manifesto antes do `import()` e confere se o contrato do bundle é idêntico ao contrato revisado. A URL pública do manifesto é a fonte do `entrypoint`; por isso um bundle local também pode exportar um caminho relativo de build sem invalidar a instalação;
- [`registry.ts`](src/runtime/registry.ts) mantém as implementações e suas prioridades;
- [`dependency-graph.ts`](src/runtime/dependency-graph.ts) ordena provedores e identifica ciclos;
- [`logger.ts`](src/runtime/logger.ts) concentra a saída de logs do host.

O pacote depende diretamente apenas de `@addons-poc/protocol` e das bibliotecas da própria interface. Add-ons não importam este pacote.

## Desenvolvimento

Na raiz do repositório:

```bash
pnpm --filter @addons/host-app dev
pnpm --filter @addons/host-app test
pnpm build:host
pnpm check:host-boundary
```

O servidor local do host usa a porta `5280`. `pnpm dev` inicia o host e os quatro servidores HTTP da demonstração; add-ons em processo são servidos por `scripts/serve-inprocess-addon.mjs` e descobertos pela URL de seu manifesto.

## Limites

Os add-ons são confiáveis nesta POC. O host valida o contrato, entradas, saídas, estado, ações e logs declarados, mas não promete sandbox, bloqueio de APIs globais ou proxy de rede. I/O externo deve aparecer em `contract.http` e passar por revisão.

O loader executa callbacks `onUnload` quando uma ativação falha; o ciclo completo de descarregamento ao desativar ou remover uma instância ainda é uma lacuna conhecida.

Consulte a [especificação de manifesto](../../docs/MANIFEST-SPEC.md) e o [índice dos pacotes](../../docs/PACKAGES.md).
