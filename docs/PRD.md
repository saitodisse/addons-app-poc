# Requisitos do produto

**Status: Parcial** · **Versão da POC: 1.0.1** · **Protocolo publicado: 1.0.0**

Este documento define o que a prova de conceito precisa demonstrar. Ele não descreve um produto comercial pronto; descreve as perguntas técnicas que o experimento deve responder e as evidências esperadas para cada resposta.

## Por que construir esta POC

Aplicativos extensíveis costumam escolher entre dependências compiladas junto com o produto e marketplaces controlados por uma autoridade central. As duas opções são úteis, mas não atendem bem a uma extensão que precisa ser publicada e substituída de forma independente.

A hipótese deste projeto é simples:

> Um host pode descobrir capacidades por manifesto, consumir implementações sem conhecer seus detalhes e continuar funcionando quando uma delas falhar.

A POC existe para testar essa hipótese com código executável, não apenas com diagramas.

## O que está sendo validado

O experimento precisa provar sete ideias:

1. **Declaração:** um manifesto descreve a identidade, os metadados e as capacidades do add-on.
2. **Desacoplamento:** o host consulta serviços por contrato, sem depender da implementação em cada ponto de uso.
3. **Substituição:** mais de um add-on pode oferecer o mesmo serviço com prioridade previsível.
4. **Degradação:** uma falha pode levar o sistema a uma alternativa sem derrubar o restante.
5. **Independência operacional:** um add-on pode funcionar como servidor HTTP fora do processo do host.
6. **Revisão consciente:** antes de ativar uma URL, a pessoa consegue ler as interações declaradas; uma mudança posterior exige nova aceitação.
7. **Fronteira pública:** hosts e add-ons dependem de `@addons-poc/protocol@1.0.0`, enquanto loader, registry e adaptadores ficam internos ao host.

## Contrato público v1

Todo manifesto usa uma única seção `contract` com faixa SemVer, capacidades,
descritores de serviços namespaceados, UI declarativa, estado, HTTP e logs.
`validateManifest` e o schema publicado recusam o formato legado. O acesso de
serviço é `host.services.use(contrato)`, com negociação de método e versão.

O host bloqueia capacidades incompatíveis, serviços obrigatórios ausentes e
ciclos obrigatórios antes de importar o bundle. `state-store` é uma capacidade
oficial opcional. O protocolo declara I/O externo, mas não promete sandbox.

A distribuição do protocolo está publicada como `@addons-poc/protocol@1.0.0`.
Host e add-ons consomem essa versão pelo registry; o pacote fonte permanece no
workspace para testes e manutenção.

## Para quem a demonstração serve

| Perfil | Pergunta que a POC ajuda a responder |
|---|---|
| Pessoa que mantém o protocolo | A fronteira pública é pequena, clara e testável? |
| Pessoa que cria add-ons | É possível oferecer uma capacidade sem conhecer detalhes internos do host? |
| Pessoa que mantém o host | É possível ativar, consultar e substituir capacidades de modo previsível? |
| Pessoa que avalia arquitetura | Os formatos em processo e HTTP podem conviver sem se confundir? |

## Experiência demonstrada

Ao iniciar o projeto, o leitor deve conseguir abrir um host vazio, instalar URLs compatíveis e percorrer uma história completa definida pelos add-ons escolhidos:

1. instalar uma extensão por URL;
2. revisar seu contrato antes da ativação;
3. usar somente os campos e ações que a extensão declarou;
4. desativar, reativar ou remover a instalação;
5. reencontrar a instalação após recarregar a página;
6. pedir nova revisão quando o contrato daquela mesma URL mudar.

## Requisitos funcionais

Os estados significam: **Entregue** quando o comportamento está implementado no escopo indicado; **Parcial** quando uma parte funciona, mas ainda há uma lacuna relevante; **Planejado** quando a POC ainda não implementa o requisito.

### Núcleo do protocolo

| ID | Requisito | Estado | Evidência atual |
|---|---|---|---|
| F1.1 | Definir um manifesto comum | Entregue | `AddonManifest` e `validateManifest` |
| F1.2 | Validar o manifesto antes do consumo | Entregue | Testes de validação no `protocol` |
| F1.3 | Registrar serviços por identificador | Entregue | `packages/host-app/src/runtime/registry.ts: ServiceRegistry.register` |
| F1.4 | Consultar uma ou todas as implementações | Entregue | `ServiceRegistry.get` e `getAll`, internos ao host |
| F1.5 | Ordenar implementações por prioridade | Entregue | Ordenação decrescente no registro |
| F1.6 | Limpar serviços por add-on | Entregue | `ServiceRegistry.clearAddon`, interno ao host |
| F1.7 | Expor um `HostAPI` pequeno | Entregue | `services`, `registerService`, `onUnload` e `log` |
| F1.8 | Representar carregamento e erro | Entregue | `AddonInstance` e `AddonStatus` |

### Add-ons em processo

| ID | Requisito | Estado | Evidência atual |
|---|---|---|---|
| F2.1 | Exportar `manifest`, `setup` e `createTab` | Entregue | Add-ons locais de exemplo |
| F2.2 | Carregar manifesto e bundle por URL | Entregue | `FetchAddonLoader` e testes com mocks |
| F2.3 | Instalar uma URL arbitrária pela interface | Entregue | Configurações valida o manifesto, pede revisão, oferece URLs locais com `name`/`description` lidos genericamente e usa `FetchAddonLoader` quando há `entrypoint` |
| F2.4 | Não deixar falha de setup derrubar o host | Entregue | Loader devolve instância em `error` |
| F2.5 | Remover registros parciais após falha de setup | Entregue | `FetchAddonLoader` chama `clearAddon` e executa callbacks registrados |
| F2.6 | Executar callbacks de descarregamento | Planejado | Callbacks são coletados, mas não há ciclo público de unload |
| F2.7 | Demonstrar serviços de saudação e contador | Entregue | Pacotes `addon-hello`, `addon-hello-pt` e `addon-counter`, sem acoplamento ao host |

### Prioridade, fallback e composição

| ID | Requisito | Estado | Evidência atual |
|---|---|---|---|
| F3.1 | Tentar implementações síncronas em ordem | Entregue | helper interno de fallback coberto pelos testes do protocolo |
| F3.2 | Tentar implementações assíncronas em ordem | Entregue | helper interno de fallback coberto pelos testes do protocolo |
| F3.3 | Reunir falhas quando nenhuma opção funciona | Entregue | `AggregateFallbackError` coberto pelos testes do protocolo |
| F3.4 | Definir descritores TypeScript para serviços | Entregue | `ServiceInteraction`, schemas de entrada/saída e `services.use` |
| F3.5 | Permitir infraestrutura fornecida pelo host | Entregue | `state-store` opcional, com prioridade entre provedores |
| F3.6 | Permitir composição sem importação direta | Entregue | Favoritos, agregador e health check |

### Add-ons HTTP de texto

| ID | Requisito | Estado | Evidência atual |
|---|---|---|---|
| F4.1 | Declarar `resources`, `types` e `catalogs` dentro de `contract` | Entregue | Quatro manifestos HTTP canônicos |
| F4.2 | Servir manifesto e recursos por rotas estáveis | Entregue | `@addons/addon-server` |
| F4.3 | Liberar acesso do host pelo navegador | Entregue | Cabeçalhos CORS e resposta a `OPTIONS` |
| F4.4 | Consumir catálogo, busca e opções de texto | Entregue | Clientes HTTP locais dos add-ons agregador e health |
| F4.5 | Entregar conteúdo sob demanda por URL | Entregue | Payload `texts` e rota `content.txt` |
| F4.6 | Demonstrar conteúdo embutido | Entregue | Biblioteca de Textos |
| F4.7 | Demonstrar processamento externo | Entregue | Citações, PoetryDB e Wikipédia |
| F4.8 | Tolerar uma origem indisponível na busca agregada | Entregue | `Promise.allSettled` no agregador |
| F4.9 | Armazenar manifesto em cache | Planejado | O cliente busca novamente |

### Gestão, compatibilidade e isolamento

| ID | Requisito | Estado | Evidência atual |
|---|---|---|---|
| F5.1 | Mostrar add-ons ativos e seus estados | Entregue | Área de gestão do host |
| F5.2 | Ativar e remover add-ons instalados por URL | Entregue | `AddonManager` |
| F5.3 | Persistir add-ons escolhidos | Entregue | `addons:host-installations:v1` preserva URLs, extensões desativadas e contratos aceitos |
| F5.4 | Escolher provedores por prioridade explícita | Entregue | `priority` no descritor e ordenação determinística no registry interno |
| F5.5 | Negociar versão do protocolo e capacidades | Entregue | `checkContractCompatibility` antes do `import()` |
| F5.6 | Isolar código em Worker ou iframe | Planejado | Add-ons em processo compartilham o contexto do host |
| F5.7 | Aplicar política de confiança e permissões | Planejado | Não há assinatura, autorização ou consentimento por capacidade |
| F5.8 | Dar rota própria a cada extensão ativa | Entregue | Hash codifica a URL do manifesto em `#/addons/<url>` |
| F5.9 | Pedir nova revisão quando o contrato mudar | Entregue | Impressão digital do contrato bloqueia a reativação até nova aceitação |
| F5.10 | Mediar interações internas declaradas | Entregue | Proxy valida serviço, entrada, saída, campos, ações, estado e logs |

## Requisitos não funcionais

### Clareza do protocolo

Uma pessoa deve conseguir compreender o caminho de um add-on lendo o manifesto, o `HostAPI` público e a descrição do `ServiceRegistry` interno do host. A documentação começa simples e aprofunda progressivamente.

### Testabilidade

Regras centrais devem funcionar sem rede real. Funções de `fetch` e armazenamento precisam ser injetáveis ou substituíveis nos testes.

### Dependências controladas

O `@addons-poc/protocol` não deve depender de React ou Vite. O `@addons/addon-server` deve permanecer sem dependências externas de runtime.

### Compatibilidade

Add-ons em processo usam ESM. O host de demonstração depende de navegadores modernos capazes de executar a aplicação React e usar `fetch` e `localStorage`.

### Honestidade operacional

Falhas, segurança e isolamento devem ser descritos de acordo com o comportamento atual. Uma capacidade planejada não pode aparecer como entregue apenas porque o tipo ou a intenção já existem.

## Casos de uso

### Criar um add-on em processo

Uma pessoa escolhe ou define um descritor de serviço dentro de `contract`, cria um manifesto com `entrypoint`, exporta um `setup` e registra sua implementação pelo `HostAPI`. Depois, gera um bundle ESM e o hospeda junto do manifesto.

A tela **Configurações** aceita uma URL HTTP ou HTTPS, valida o manifesto, mostra o contrato e chama `FetchAddonLoader` para importar o bundle ESM após a aceitação. O `host-app` não tem dependência de implementação, catálogo embutido nem caminho especial para add-ons do workspace. Para desenvolvimento local, cada pacote em processo pode publicar `manifest.json` e `bundle.js` com seu próprio comando `serve`.

### Criar um add-on HTTP

Uma pessoa escreve um manifesto com `contract.resources`, implementa handlers de catálogo, busca, texto e conteúdo, e entrega tudo ao `createAddonServer`. O host precisa apenas da URL base para iniciar a conversa.

### Usar fallback

Duas implementações registram o mesmo serviço. O runtime interno ordena pela maior prioridade e o helper de fallback, mantido como implementação interna testada, tenta a próxima quando a anterior lança uma exceção. A API pública do add-on continua sendo `host.services.use(contrato)`; o consumidor não importa o registry nem o helper.

### Ler um texto remoto

O host busca o manifesto, consulta um catálogo ou uma busca, escolhe um item, pede as opções em `/text/...json` e só então baixa a URL de conteúdo. O servidor de origem pode consultar outra API antes de responder, sem mudar o contrato visto pelo host.

## Critérios de sucesso da POC

A hipótese principal é considerada demonstrada quando todas estas evidências permanecem verdadeiras:

- dois add-ons oferecem `greeter` com prioridades diferentes;
- o fallback usa a alternativa depois de uma falha simulada;
- um erro de carregamento vira estado observável em vez de encerrar o host;
- um serviço pode consumir infraestrutura do host pelo registro;
- um servidor HTTP compatível é descoberto por manifesto;
- catálogo, busca, opções de texto e conteúdo funcionam de ponta a ponta pelo cliente HTTP do protocolo;
- pelo menos uma origem externa é transformada no contrato comum;
- a busca agregada continua útil quando uma origem falha;
- uma URL compatível pode ser revisada, instalada e restaurada depois de recarregar;
- uma mudança de contrato na mesma URL mantém a extensão desativada até nova aceitação;
- serviços, campos de ação e estado não declarados são recusados antes de uso pelo host;
- os testes dos pacotes passam sem depender dos servidores externos reais.

## Fora do escopo atual

- marketplace ou catálogo público com backend;
- autenticação e autorização;
- auditoria ou assinatura criptográfica de add-ons;
- publicação automática no npm sem credenciais da organização;
- suporte a Service Worker ou WebAssembly;
- sandbox pronto para produção;
- garantia de disponibilidade das APIs públicas de exemplo;
- ranking, cache e busca sofisticada;
- verificação criptográfica de origem, permissões de rede e sandbox de código em processo;
- interface visual final de produto.
