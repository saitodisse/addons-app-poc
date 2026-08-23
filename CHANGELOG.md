# Histórico de mudanças

Este arquivo conta, em ordem inversa, como o projeto evoluiu. A leitura rápida mostra o que mudou; os detalhes técnicos registram os pacotes e contratos afetados.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
- A especificação, arquitetura, decisões, glossário e contexto de domínio foram atualizados para registrar o protocolo `interactions` 1.0.0 e seus limites observáveis.

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

### Adicionado

- `@addons/addon-markdown`, com o serviço `textFormatter` para Markdown e HTML.
- `@addons/addon-aggregator`, com o serviço `searchProvider` e busca paralela tolerante a falhas.
- `@addons/addon-favorites`, com o serviço `favorites` e persistência fornecida pelo `bookmarkStore` do host.
- `@addons/addon-health`, com o serviço `healthCheck` para disponibilidade e latência.
- `@addons/addon-text-wikipedia`, na porta `5294`, com busca e resumos obtidos das APIs da Wikipédia.
- Interfaces e funções de domínio para formatação, favoritos e armazenamento de marcadores no `@addons/core`.
- Serviços de infraestrutura registrados pelo host com `addonId: "host"`.
- A área **Extras** no host, com demonstrações de formatação, busca agregada, favoritos e saúde dos servidores.

### Alterado

- `pnpm dev` passou a iniciar também o servidor da Wikipédia.
- O `tsconfig.json` do host passou a usar `noEmit`, evitando JavaScript gerado ao lado dos arquivos TypeScript.
- A documentação passou a incluir a composição entre add-ons e serviços fornecidos pelo host.
