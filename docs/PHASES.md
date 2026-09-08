# Fases do projeto

Construir um sistema extensível de uma vez esconderia riscos demais. Por isso, a POC cresce em degraus: cada fase responde a uma pergunta e deixa uma demonstração verificável.

Os estados usados aqui são **Planejado**, **Em Andamento**, **Entregue**, **Parcial**, **Desativado** e **Substituído**.

O estado atual dos pacotes está detalhado em [`PACKAGES.md`](PACKAGES.md). As fases 1 a 6 preservam a história da POC; quando um nome antigo aparece nelas, ele é histórico e não é mais uma API pública.

## Mapa da jornada

| Fase | Pergunta principal | Estado |
|---|---|---|
| 1. Alicerce | Um host consegue receber serviços de add-ons? | Entregue |
| 2. Substituição | Uma alternativa consegue assumir após uma falha? | Entregue |
| 3. Servidores | Um add-on pode viver fora do processo do host? | Parcial |
| 4. Composição | Add-ons conseguem formar capacidades maiores sem importações diretas? | Entregue |
| 5. Gestão e compatibilidade | O usuário consegue instalar e controlar add-ons remotos? | Parcial |
| 6. Isolamento | Código não confiável pode ser limitado com segurança? | Planejado |
| 7. Protocolo público | O contrato pode ser publicado e usado por hosts independentes? | Entregue |

"Parcial" na fase 3 significa que o formato HTTP está entregue, enquanto a interface genérica de catálogo, busca e leitura, o cache, a atualização e a validação de respostas ainda não estão. A negociação SemVer e o perfil de capacidades foram entregues na fase 7.

## Verificação de 08/09/2026

Este registro separa a base já demonstrada das pendências para continuar o experimento. O estado geral permanece **Parcial**: o protocolo público e a instalação por URL estão entregues, mas o ciclo de vida e a experiência HTTP ainda precisam ser completados.

A verificação usou o código do commit `09ac6da`, versão da POC `1.0.1`, com consumidores de `@addons-poc/protocol@1.0.0` pelo npm. Antes desta atualização documental, o checkout estava na branch `master`, sem alterações locais.

A versão `1.0.2` consolida esta revisão documental. Os comandos abaixo foram repetidos na finalização dessa versão, com os mesmos resultados; o protocolo permanece em `1.0.0`.

| Verificação executada | Resultado |
|---|---|
| `pnpm test` | 136 testes passaram em 24 arquivos; inclui a checagem da fronteira do host e a build do protocolo |
| `pnpm build:host` | TypeScript, checagem da fronteira e build de produção passaram |
| Inspeção do loader e da gestão de instalações | Confirmadas a limpeza básica após falha de `setup`, a ausência de unload completo e a aba apenas informativa para manifestos sem `entrypoint` |

Não houve nova verificação visual no navegador, consulta ao npm nem verificação do remoto Git. A publicação do protocolo e seu teste em consumidor limpo pertencem à entrega registrada em 24/08 no [changelog](../CHANGELOG.md).

Para reproduzir a demonstração manual, execute `pnpm dev`, abra `http://localhost:5280` e instale `http://localhost:5301/manifest.json` em **Configurações**. Revise e aceite o contrato, abra a aba Hello e recarregue a página. O resultado esperado é a instalação permanecer disponível. Esse roteiro não foi executado nesta verificação.

## Fase 7 — Protocolo público v1

**Estado: Entregue**

### Por que

Um contrato misturado ao runtime impede publicação e compatibilidade entre hosts.

### O que foi entregue

- `@addons-poc/protocol@1.0.0`, MIT, com ESM, tipos e schema JSON, publicado no npm;
- seção única `contract` v1 em todos os manifestos;
- capacidades, SemVer, descritores namespaceados e `state-store` oficial;
- proxy `host.services.use(contrato)` e validação em runtime;
- loader, registry, status e adaptadores internos ao host;
- bloqueio de incompatibilidades, dependências obrigatórias e ciclos;
- ADR 0001 e documentação alinhada.

O pacote foi consultado no registry com `npm view` e instalado em um consumidor
limpo. Os consumidores do workspace agora usam a versão publicada, registrada
no lockfile por sua integridade.

### Como verificar

Execute `pnpm check:host-boundary`, `pnpm test`, `pnpm build:host`,
`npm pack --dry-run` no pacote do protocolo e `npm view
@addons-poc/protocol@1.0.0`. Para uma nova versão, publique somente o pacote
com a conta da organização e confirme a instalação em um consumidor limpo.

## Fase 1 — O alicerce

**Estado: Entregue**

### Por que veio primeiro

Antes de pensar em rede ou sandbox, era preciso provar a conversa mais básica: um add-on oferece uma capacidade, o host a encontra e a usa.

### O que foi entregue

- manifesto e instância de add-on;
- `HostAPI` com registro, consulta, descarregamento declarado e logs;
- `ServiceRegistry` com múltiplas implementações e prioridade;
- validação estrutural do manifesto;
- portas para carregamento e logs;
- adaptadores com `fetch`, `import()` e console;
- add-ons de saudação e contador;
- host React genérico para instalar extensões por URL;
- testes do registro, da validação e do loader.

### Como verificar

Execute `pnpm test`. Para a interface, inicie `pnpm dev`, informe uma URL de manifesto em **Configurações**, revise o contrato e ative a extensão.

### Limite que permaneceu

O host não importa implementações locais: cada extensão precisa publicar seu próprio manifesto e, no formato em processo, seu bundle ESM. O script local `serve-inprocess-addon.mjs` demonstra essa publicação em portas próprias. Ainda não há cache, atualização nem descarregamento completo.

## Fase 2 — Prioridade e fallback

**Estado: Entregue**

### Por que veio depois

Um serviço único funciona em uma demonstração feliz. Um ecossistema real precisa sobreviver quando a implementação preferida falha.

### O que foi entregue

- interfaces `Greeter` e `Counter`;
- helper interno de fallback para chamadas síncronas;
- helper interno de fallback para chamadas assíncronas;
- `AggregateFallbackError` para reunir falhas;
- `addon-hello-pt` com prioridade `10`;
- falha simulada ao receber o nome `error`;
- `addon-hello` como alternativa de prioridade `0`;
- testes de ordem, sucesso alternativo e falha total.

### Como verificar

Execute os testes de fallback em `@addons-poc/protocol`. Um host pode demonstrar esse fluxo depois de instalar duas extensões compatíveis que publiquem o mesmo serviço com prioridades diferentes.

## Fase 3 — Add-ons como servidores

**Estado: Parcial**

### Por que mudar o formato

Nem toda extensão precisa executar dentro do host. Conteúdo remoto e processamento externo se beneficiam de implantação independente e de um contrato HTTP simples.

### Parte entregue: protocolo de texto

- manifesto com `resources`, `types`, `idPrefixes` e `catalogs`;
- `@addons/addon-server` em JavaScript ESM puro;
- rotas para manifesto, catálogo, busca, opções de texto e conteúdo;
- clientes HTTP locais nos add-ons que consomem o formato de texto;
- formato `{ texts: [{ id, url, lang, name }] }`;
- CORS para consumo local pelo navegador;
- Biblioteca de Textos na porta `5291`;
- Citações na porta `5292`;
- Poemas na porta `5293`;
- Wikipédia na porta `5294`;
- testes do servidor, cliente e handlers.

### Parte pendente: compatibilidade e experiência genérica

- armazenar manifestos em cache com política de atualização;
- validar respostas HTTP além do manifesto;
- transformar os recursos de um servidor HTTP recém-instalado em uma aba especializada, sem código prévio no host.

### Como verificar a parte entregue

Execute `pnpm dev` e instale uma das URLs de manifesto das portas `5291` a `5294`. O host revisa e preserva o contrato; o consumo genérico dos recursos HTTP ainda é a próxima etapa.

## Fase 4 — Composição de serviços

**Estado: Entregue**

### Por que esta fase importa

Add-ons isolados provam extensibilidade básica. A arquitetura fica mais interessante quando uma capacidade usa outra sem criar importações diretas.

### O que foi entregue

| Add-on | Serviço | Composição demonstrada |
|---|---|---|
| `addon-markdown` | `addons.markdown.text-formatter` | Usa funções puras locais de formatação |
| `addon-aggregator` | `addons.aggregator.search-provider` | Consulta vários add-ons HTTP em paralelo |
| `addon-favorites` | `addons.favorites` | Consome `state-store` opcional |
| `addon-health` | `addons.health.health-check` | Consulta manifestos e mede disponibilidade |

O host ou um add-on de armazenamento pode registrar `state-store`; se ele não
existir, favoritos degrada para memória temporária.

### Como verificar

Execute os testes dos pacotes de composição. Um host pode apresentar essas capacidades quando as extensões publicarem abas compatíveis pelo protocolo.

## Fase 5 — Gestão e compatibilidade

**Estado: Parcial**

### Problema a resolver

Um ecossistema por URL precisa deixar a escolha com a pessoa usuária sem transformar uma instalação em autorização invisível. O host deve lembrar a escolha, mostrar o que o add-on declara e pedir nova revisão se essa declaração mudar.

### Parte entregue

- instalação por URL com revisão do manifesto e do contrato de interação;
- expansão de cada add-on instalado com explicação e JSON completo do manifesto;
- persistência das URLs, extensões desativadas e impressão digital do contrato aceito;
- reativação bloqueada quando o contrato muda na mesma URL;
- validação de serviços, campos, ações e acesso mediado a estado;
- compatibilidade de versões e capacidades, com bloqueio de dependências obrigatórias ausentes e ciclos;
- limpeza básica dos serviços registrados quando `setup` falha, coberta por teste do loader.

A limpeza básica chama os callbacks de `onUnload` e depois remove os serviços da URL. Ela ainda não garante recuperação se um desses callbacks lançar uma exceção. Ao desativar ou remover uma instância ativa, a interface limpa o registro de serviços, mas não executa esses callbacks. Veja os detalhes na [arquitetura](ARCHITECTURE.md#loader-e-estados).

### Parte pendente

- edição de prioridade;
- cache e atualização de manifestos;
- mensagens claras para incompatibilidade;
- ciclo completo de unload;
- garantir que uma falha em callback de limpeza não impeça os demais callbacks nem a remoção dos serviços.

### Condição de conclusão

A instalação persistente já funciona. Para concluir a fase, o host deve também executar a limpeza completa ao desativar ou remover uma instância, preservar a remoção dos serviços mesmo se um callback falhar, permitir editar prioridades e oferecer cache e atualização de manifestos. URLs inválidas ou incompatíveis devem produzir erros compreensíveis sem alterar os add-ons já ativos.

## Fase 6 — Isolamento e confiança

**Estado: Planejado**

### Problema a resolver

Fallback trata falhas de serviço, mas não limita o que código em processo pode acessar. Um módulo malicioso ou bloqueante ainda compartilha o contexto do host.

### Investigação prevista

- comparar Web Worker e `iframe` com origem separada;
- definir mensagens serializáveis entre host e add-on;
- limitar tempo, memória e tamanho de resposta quando possível;
- desenhar permissões por capacidade;
- estudar integridade, assinatura e origem confiável;
- restringir CORS e políticas de conteúdo para implantação real;
- criar limites de falhas e degradação de prioridade.

### Condição de conclusão

Uma extensão de teste deve falhar, travar ou tentar um acesso não autorizado sem comprometer o restante do host. O mecanismo escolhido precisa ter testes e ameaças documentadas; um `try/catch` isolado não basta.

## Ordem recomendada para o próximo trabalho

1. Completar e testar o ciclo de unload ao desativar ou remover add-ons, incluindo recuperação quando um callback de limpeza falhar.
2. Apresentar catálogo, busca e leitura dos recursos HTTP instalados de modo genérico, validando suas respostas.
3. Adicionar edição de prioridades e melhorar as mensagens de incompatibilidade.
4. Adicionar cache e atualização de manifestos, preservando a nova revisão quando o contrato mudar.
5. Só então escolher o modelo de sandbox.

Essa ordem fecha primeiro inconsistências do ciclo de vida, depois adiciona conveniência e, por último, enfrenta o isolamento — o tema mais caro e sensível.
