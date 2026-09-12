# `@addons/host-app`

Runtime e interface do host para a POC de add-ons.

## Por que este pacote existe

O host precisa carregar add-ons por URL sem importar implementações conhecidas. A separação deixa o protocolo público estável e mantém decisões de execução — loader, registro, estados e adaptadores — dentro do aplicativo.

## O que ele oferece

O host busca e valida `manifest.json`, negocia a versão do protocolo e as capacidades, revisa o contrato, importa bundles ESM em processo e apresenta servidores HTTP. A interface é genérica: não existe catálogo embutido, alias ou dependência de `@addons/addon-*` no pacote. Em Configurações, a lista local consulta somente `name` e `description` dos manifestos para facilitar o preenchimento. A busca global consulta recursos HTTP `search` declarados pelos add-ons ativos e normaliza as respostas em uma tabela comum.

Capacidades canônicas do host:

- `registry.services`: registro mediado de serviços;
- `ui.tab`: aba declarativa;
- `logs`: logs estruturados;
- `state-store`: provedor opcional de estado serializável.

O campo de busca fica fixo no cabeçalho: **Enter** dispara a consulta e **Esc**
limpa campo e resultados. `src/search.ts` é um adaptador interno que consulta
as rotas `/search/<type>/<query>.json`, aplica o limite configurado por add-on
como tamanho de página, isola falhas de uma origem e produz linhas com tipo, ID, URL, nome, descrição e
metadados visuais opcionais. A tabela permanece visível mesmo sem extensões.
O tamanho da página pode ser ajustado na lateral de extensões ou em
Configurações, entre 1 e 500 resultados. O padrão é 10, inclusive quando o
campo fica vazio. Quando uma resposta traz `pagination.next`, o host mantém o
cursor por provedor e mostra **Página anterior** e **Próxima página**, com a
página atual entre os botões, no início e no fim da tabela. A troca substitui as
linhas pela página solicitada, sem acumular a página anterior. O termo de busca
e a página são controlados na URL por `nuqs` (`q` e `page`).
Quando existe um `state-store` ativo, o host grava a consulta, as linhas e os
cursores sob a chave `host:search:results:v1`.

Na home, a tabela ocupa toda a largura disponível. A demonstração ao vivo abre
por um ícone de engrenagem em um modal com a lista de extensões. Ao selecionar
uma extensão ativa, o host navega para uma rota dinâmica de detalhe e não repete
a listagem inicial. A coluna visual de URL não é exibida: ao clicar no nome de
um resultado, o host navega para uma página dedicada, busca seu `content.json` e
renderiza imagem, descrição, resumo e o link original. Os metadados, headers,
métricas, observabilidade e o JSON completo continuam disponíveis no tráfego e
no debug, sem ocupar a visualização principal. O `content.txt` continua
disponível como conteúdo textual compatível e fallback para add-ons antigos.

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

O loader executa callbacks `onUnload` quando uma ativação falha e depois remove os serviços registrados. Uma exceção em callback pode interromper essa limpeza. Ao desativar ou remover uma instância ativa, o host remove seus serviços, mas ainda não executa os callbacks. O ciclo completo de descarregamento é o próximo trabalho no [roteiro](../../docs/PHASES.md#ordem-recomendada-para-o-próximo-trabalho).

Manifestos HTTP sem `entrypoint` recebem uma aba com título e descrição, o
contrato completo e, quando declaram `debug-traffic`, um único link para o
histórico de requests e responses reais. O host continua lendo o debug em
segundo plano e imprimindo cada resposta no console do navegador, mesmo quando
o histórico não mudou. A busca genérica já cobre o recurso `search`; catálogo,
leitura, cache e validação completa de respostas HTTP ainda estão planejados.

Consulte a [especificação de manifesto](../../docs/MANIFEST-SPEC.md) e o [índice dos pacotes](../../docs/PACKAGES.md).
