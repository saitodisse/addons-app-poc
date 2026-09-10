# Histórico de mudanças

Este arquivo conta, em ordem inversa, como o projeto evoluiu. A leitura rápida mostra o que mudou; os detalhes técnicos registram os pacotes e contratos afetados.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.3.1] - 2026-09-10

### Corrigido

- A busca da Wikipédia agora identifica o cliente, repete falhas transitórias
  `429` e `5xx`, deduplica chamadas simultâneas e mantém cada página em cache
  por 60 segundos, evitando falhas `500` após recarregar a listagem.

## [1.3.0] - 2026-09-10

### Adicionado

- A busca global agora usa `q` e `page` na URL, permitindo restaurar e
  compartilhar o termo e a página atual.
- A tabela oferece **Página anterior**, página atual e **Próxima página** no
  início e no fim da listagem.
- A paginação por cursor foi adicionada ao protocolo, ao servidor HTTP, ao
  cliente do host e à busca da Wikipédia.
- O host abre o conteúdo textual de um resultado em modal e mostra o conteúdo
  da Wikipédia diretamente na descrição quando disponível.

### Alterado

- A navegação troca a página inteira de resultados, sem acumular a página
  anterior, e preserva as páginas já visitadas para voltar sem nova consulta.
- A Wikipédia limita cada página ao máximo permitido pela API de extratos e a
  busca total a 500 registros.
- Descrições da listagem são truncadas em 140 caracteres e sua coluna ocupa no
  máximo metade da largura da janela.
- O limite de busca configurável aceita campo vazio e usa 10 como padrão.

## [1.2.0] - 2026-09-10

### Adicionado

- A demonstração ao vivo agora abre e fecha por um ícone de engrenagem em um modal responsivo.
- Extensões ativas agora possuem rotas dinâmicas dedicadas de detalhe e configuração.
- O reset de fábrica remove instalações, configurações e estados persistidos do host após confirmação explícita.

### Alterado

- A home passou a exibir somente a listagem principal; o detalhe da extensão não é repetido nessa tela.
- A demonstração local foi reduzida aos add-ons mantidos: Markdown, Favoritos, Saúde, Armazenamento local e Wikipédia.

### Removido

- Foram retirados da demonstração os add-ons Hello, Hello PT, Contador, Agregador, Armazenamento da sessão, Debug, Biblioteca, Citações e Poemas.

## [1.1.2] - 2026-09-09

### Alterado

- A home agora ocupa toda a largura disponível e apresenta a demonstração ao vivo em uma barra lateral direita responsiva.
- A tabela de resultados remove a coluna URL e torna o nome de cada item o link para seu conteúdo.

## [1.1.1] - 2026-09-09

### Alterado

- A lateral de extensões agora exibe o limite de resultados de busca para Biblioteca, Citações, Poemas e Wikipédia.
- O controle da lateral compartilha a mesma configuração persistida da tela de Configurações e continua aplicando o limite à tabela principal.

## [1.1.0] - 2026-09-08

### Adicionado

- Campo de pesquisa fixo no topo do host, com Enter para buscar e Esc para limpar.
- Tabela central de resultados presente em todas as rotas, inclusive sem add-ons instalados.
- Normalização de respostas de Citações da Web, Poemas e Wikipédia em linhas com tipo, ID, URL, nome, descrição e emoji ou imagem opcionais.

### Alterado

- Add-ons HTTP ativos que declaram `search` agora são consultados em paralelo, com falhas isoladas mostradas na tabela.
- Cada add-on de busca ganhou limite configurável de resultados, persistido junto da instalação.
- A última consulta e suas linhas são persistidas pelo `state-store` ativo sob `host:search:results:v1`.

### Documentação

- Arquitetura, PRD, fases, decisões, glossário e READMEs foram atualizados para registrar a busca global e as pendências restantes de catálogo, leitura e validação HTTP completa.

## [1.0.7] - 2026-09-08

### Alterado

- As abas de Armazenamento local e Armazenamento da sessão listam os estados automaticamente ao serem abertas.
- O painel de JSON agora aparece somente nesses dois provedores, e o Session Storage também permite abrir o valor completo de cada estado.

## [1.0.6] - 2026-09-08

### Corrigido

- O Contador deixou de reler o valor antigo a cada ação quando o `state-store` mediado pelo host criava uma nova ponte. O botão `+1` agora preserva incrementos sucessivos após recarregar a página.
- O add-on ganhou um teste de regressão que simula a mediação do host e uma instrução própria de teste no README.

## [1.0.5] - 2026-09-08

### Alterado

- O add-on passou a se chamar **Saúde dos Add-ons** na interface e nos metadados.
- Cada resultado agora mostra o nome obtido do manifesto junto do endereço consultado, com um nome local de reserva quando o servidor não responde.

## [1.0.4] - 2026-09-08

### Corrigido

- O add-on Saúde deixou de consultar apenas os quatro servidores HTTP de texto e passou a verificar os 14 servidores da demonstração, incluindo os add-ons em processo.
- A declaração `contract.http`, a descrição da aba e os testes do Saúde agora usam a mesma lista completa de manifestos.

## [1.0.3] - 2026-09-08

### Alterado

- A lateral da demonstração passou a exibir ações nomeadas `Ativar` e `Desativar` para cada add-on, deixando a ativação de Citações e Poemas visível e acionável.
- Add-ons cujo contrato mudou agora exibem `Revisar e ativar` e levam a pessoa às Configurações, em vez de aceitar um clique que não produziria efeito.
- A revisão de uma instalação local aparece logo abaixo do add-on escolhido, recebe foco ao abrir e alterna entre `Instalar` e `Fechar`.

## [1.0.2] - 2026-09-08

### Documentação

- Registrado o estado atual da POC, com 136 testes aprovados, build de produção aprovada e limites explícitos da verificação local.
- Corrigido o planejamento para reconhecer a compatibilidade de versões e a limpeza básica após falha de inicialização como implementadas.
- Detalhadas as pendências de descarregamento ao desativar ou remover add-ons, recuperação de falhas nos callbacks de limpeza e interface genérica dos recursos HTTP.
- Alinhados os requisitos e a ordem dos próximos trabalhos: ciclo de vida, experiência HTTP, edição de prioridades, cache e atualização de manifestos, seguidos de isolamento.

## [1.0.1] - 2026-08-24

### Alterado

- Todos os consumidores do workspace, incluindo host, servidor HTTP e add-ons,
  passaram a declarar `@addons-poc/protocol@1.0.0` como dependência do npm.
- O lockfile registra a integridade do pacote publicado, sem links locais para
  `packages/protocol`.
- A instalação do workspace passou a liberar explicitamente a versão publicada
  recém-lançada durante a janela de verificação de idade do pnpm.

### Publicação

- Confirmada a publicação pública de `@addons-poc/protocol@1.0.0` e a
  instalação em um consumidor limpo.

## [1.0.0] - 2026-08-24

### Adicionado

- `@addons-poc/protocol@1.0.0`, publicado publicamente no npm e licenciado em MIT.
- Contrato v1 com JSON Schema, faixa SemVer, capacidades, descritores
  namespaceados, schemas de método, UI, estado, HTTP e logs.
- Proxy `host.services.use(contrato)`, `state-store` oficial opcional e
  bloqueio de incompatibilidades, dependências obrigatórias e ciclos.
- Runtime de loader, registry, status e adaptadores movido para o host.
- ADR 0001 e validação de empacotamento do protocolo.
- A tela de Configurações passou a listar os 14 manifestos locais com título,
  descrição e ações de copiar ou iniciar a instalação.

### Alterado

- Todos os add-ons e o host dependem diretamente de `@addons-poc/protocol`.
- Todos os manifestos usam somente `contract`; o parser legado foi removido.
- Serviços de exemplo usam identificadores namespaceados.
- O loader aceita caminhos relativos somente no manifesto interno do bundle,
  usando a URL pública do manifesto como `entrypoint` canônico.
- `pnpm dev` e `pnpm kill-all` cobrem todos os projetos executáveis e suas
  portas, com comentários de sincronização entre os scripts.

### Documentação

- Cada pacote passou a ter README próprio com responsabilidade, contrato,
  dependências, portas, comandos e limites.
- `docs/PACKAGES.md` passou a ser o índice operacional e os guias centrais
  passaram a apontar para ele.

## [0.4.1] - 2026-08-23

### Documentação

- A documentação passou a descrever o caminho já entregue de instalação por URL, revisão de contrato e persistência das escolhas após recarregar a página.
- Os limites restantes foram corrigidos para destacar a ausência de cache, atualização, descarregamento transacional, negociação de versões e isolamento de código.
- Os requisitos e as fases agora registram as rotas próprias, a nova revisão de contratos modificados e a mediação de interações declaradas pelo host.

## [0.4.0] - 2026-08-23

### Adicionado

- Cada manifesto passou a declarar um contrato de interação completo: serviços, campos, ações, entradas, saídas, estado, HTTP e logs.
- As instalações agora mostram, em uma expansão abaixo do add-on, uma explicação legível e o JSON integral do manifesto em estilo terminal.
- O host inclui add-ons de estado local, sessão e depuração para demonstrar onde cada dado é guardado e qual provedor efetivo o atende.
- O visualizador `json-highlighter` foi integrado ao host sem destacar caminhos ou abrir modal.

### Alterado

- O host valida o contrato antes de ativar um add-on, restringe os serviços e as entradas de ações ao que foi declarado e exige nova aceitação quando o contrato remoto mudar na mesma URL.
- Os quatro servidores HTTP passaram a declarar recursos recebidos, dados devolvidos e chamadas externas de forma transparente.
- A especificação, arquitetura, decisões, glossário e contexto de domínio foram atualizados para registrar o protocolo `contract` 1.0.0 e seus limites observáveis.

## [0.3.0] - 2026-08-20

### Documentação

- As versões técnica e introdutória foram consolidadas em uma única documentação progressiva.
- Cada assunto agora começa pelo problema e pela visão geral antes de apresentar contratos, fluxos e limitações.
- As decisões antes reunidas em `docs/docs-17yrs/RESUMO-PLANO.md` passaram a formar `docs/DECISIONS.md`.
- Referências desatualizadas foram alinhadas ao comportamento atual do código.

### Adicionado

- Uma base de roteamento por hash, sem dependência externa, para a futura navegação por URLs próprias no host.
- Uma configuração Docker para executar localmente o serviço OpenViking.

### Alterado

- O diretório temporário `temp/` passou a ser ignorado pelo Git.

## [0.2.0] - 2025-08-19

Esta versão ampliou a demonstração: add-ons em processo passaram a compor serviços, e um quarto servidor remoto trouxe conteúdo da Wikipédia.

Os nomes `textFormatter`, `searchProvider`, `healthCheck` e **Extras** abaixo
descrevem a implementação histórica daquela versão. Na v1, os serviços são
namespaceados (`addons.markdown.text-formatter`, `addons.aggregator.search-provider`
e `addons.health.health-check`) e cada domínio permanece em seu próprio pacote.

### Adicionado

- `@addons/addon-markdown`, então identificado como `textFormatter`, para Markdown e HTML.
- `@addons/addon-aggregator`, então identificado como `searchProvider`, com busca paralela tolerante a falhas.
- `@addons/addon-favorites`, com o serviço `addons.favorites` e persistência opcional por `state-store`.
- `@addons/addon-health`, então identificado como `healthCheck`, para disponibilidade e latência.
- `@addons/addon-text-wikipedia`, na porta `5294`, com busca e resumos obtidos das APIs da Wikipédia.
- Helpers de formatação, favoritos e armazenamento de marcadores mantidos nos próprios add-ons.
- Serviços de infraestrutura registrados pelo host com `addonId: "host"`.
- A área **Extras** no host, com demonstrações de formatação, busca agregada, favoritos e saúde dos servidores.

### Alterado

- `pnpm dev` passou a iniciar também o servidor da Wikipédia.
- O `tsconfig.json` do host passou a usar `noEmit`, evitando JavaScript gerado ao lado dos arquivos TypeScript.
- A documentação passou a incluir a composição entre add-ons e serviços fornecidos pelo host.
