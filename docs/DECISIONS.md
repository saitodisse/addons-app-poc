# Decisões de arquitetura

Este documento preserva o raciocínio por trás do sistema. Ele existe porque uma decisão sem contexto parece apenas uma regra arbitrária; com o problema e as alternativas visíveis, fica mais fácil saber quando mantê-la e quando revisá-la.

Cada decisão começa pela ideia simples e termina nas consequências técnicas.

## 1. A URL do manifesto é a identidade

### Por que

Nomes e identificadores declarados podem se repetir. Duas pessoas podem publicar um add-on chamado `hello`, e o mesmo servidor pode atualizar o nome sem se tornar outro add-on.

### Decisão

O endereço completo do manifesto identifica o add-on. O campo `id` continua útil para leitura, logs e interface, mas não define unicidade.

### Consequências técnicas

- `AddonInstance.manifestUrl` preserva a identidade.
- `ServiceEntry.addonId` recebe a URL do manifesto quando o loader registra serviços.
- mover o manifesto para outra URL cria outra identidade;
- atualizar o conteúdo na mesma URL mantém a identidade.

## 2. Manifesto e setup são partes separadas

### Por que

O host precisa entender o que um add-on declara antes de executar seu código.

### Decisão

Um add-on em processo exporta `manifest` e `setup`. O manifesto descreve; o `setup` inicializa.

```typescript
interface AddonModule {
  manifest: AddonManifest;
  setup(host: HostAPI): void | Promise<void>;
}
```

### Consequências técnicas

O host pode validar metadados e serviços antes da ativação. Em uma evolução futura, também pode exibir permissões ou compatibilidade antes de executar o bundle.

## 3. O HostAPI deve permanecer pequeno

### Por que

Cada método exposto pelo host vira um compromisso de compatibilidade. Uma API enorme dá mais poder imediato ao add-on, mas aumenta o acoplamento e dificulta isolamento futuro.

### Decisão

O add-on recebe apenas:

- `services`, para consultar o registro;
- `registerService`, para publicar uma implementação;
- `onUnload`, para declarar limpeza;
- `log`, para emitir mensagens contextualizadas.

### Consequências técnicas

Recursos como rede, persistência ou autenticação devem chegar como serviços explícitos, não como acesso irrestrito aos detalhes internos do host.

`log` aceita detalhes opcionais e os encaminha ao serviço `debugLog` quando ele estiver ativo. Isso não acrescenta uma API de debug paralela nem entrega armazenamento diretamente ao add-on.

## 4. O ServiceRegistry é o ponto de encontro

### Por que

Se o host e cada add-on importarem uns aos outros, todas as partes ficam presas à mesma build.

### Decisão

Produtores registram implementações por `serviceId`; consumidores consultam pelo mesmo identificador.

### Consequências técnicas

O registro guarda `serviceId`, instância, origem e prioridade. Ele não conhece React, HTTP ou o propósito de cada serviço. Essa profundidade pequena e genérica é intencional.

## 5. A prioridade é explícita

### Por que

Quando várias implementações oferecem a mesma capacidade, o sistema precisa de uma ordem previsível.

### Decisão

Cada registro recebe uma prioridade numérica. Valores maiores vêm primeiro; a prioridade padrão é zero.

### Consequências técnicas

`ServiceRegistry.register` ordena as entradas. O `addon-hello-pt` usa prioridade `10`, enquanto o saudador padrão usa `0`. Empates preservam a ordem estável produzida pelo JavaScript atual, mas o protocolo não deve depender de empate para expressar preferência.

## 6. Falha no setup desativa a instância

### Por que

Um add-on parcialmente inicializado deixa o estado difícil de compreender. O host precisa saber se a ativação terminou ou não.

### Decisão

Se `setup` lançar uma exceção, o loader devolve uma `AddonInstance` com status `error` e não anuncia serviços na instância retornada.

### Consequências técnicas e lacuna atual

O contrato desejado é remover também qualquer serviço registrado antes da falha. O `ServiceRegistry` já oferece `clearAddon(addonId)`, mas o `FetchAddonLoader` atual ainda não o chama no bloco de erro. Até essa lacuna ser corrigida, documentação e testes não devem afirmar que registros parciais são descartados.

## 7. Fallback é uma operação explícita

### Por que

Escolher o primeiro serviço e tentar alternativas são responsabilidades diferentes. Esconder execução dentro do registro tornaria erros e tipos mais difíceis de controlar.

### Decisão

O registro ordena; `withFallback` e `withFallbackAsync` executam.

### Consequências técnicas

O consumidor fornece a função que será aplicada a cada implementação. Se todas falharem, recebe um `AggregateFallbackError` com os erros individuais. Se nenhum serviço estiver registrado, o mesmo erro é lançado com a lista interna vazia.

## 8. Add-ons em processo usam ESM

### Por que

O navegador e o Node.js modernos já entendem módulos ECMAScript, ou **ESM**. Um padrão nativo reduz formatos proprietários e loaders extras.

### Decisão

Bundles em processo devem ser módulos ESM carregáveis com `import()`.

### Consequências técnicas

O `entrypoint` precisa ser uma URL HTTP ou HTTPS no manifesto validado pelo loader. As sugestões locais ainda entram na build para facilitar a demonstração, mas a interface de instalação também aceita uma URL arbitrária: depois da revisão do contrato, ela usa `FetchAddonLoader` para buscar o manifesto e importar o bundle ESM.

## 9. O manifesto deve ser completo antes da execução

### Por que

Um host precisa mostrar autoria, versão, licença e capacidades sem adivinhar informações pelo código.

### Decisão

Todo manifesto declara `id`, `version`, `name`, `description`, `author` e `license`. Depois escolhe pelo menos um dos formatos:

- `services` e `entrypoint`, para execução em processo;
- `resources`, com os campos HTTP relacionados, para execução remota.

### Consequências técnicas

`validateManifest` rejeita campos obrigatórios vazios, IDs fora de kebab-case, versões fora de `X.Y.Z`, formatos sem capacidades e estruturas incompatíveis. A especificação canônica está em [`MANIFEST-SPEC.md`](MANIFEST-SPEC.md).

## 10. Interfaces de domínio tornam serviços compreensíveis

### Por que

Um `serviceId` sozinho não diz quais métodos a implementação oferece. Sem um contrato, o erro só aparece durante a execução.

### Decisão

Serviços públicos devem implementar interfaces TypeScript quando houver um contrato estável, como `Greeter`, `Counter`, `SearchProvider`, `HttpFetcher`, `TextFormatter`, `BookmarkStore` e `FavoritesService`.

### Consequências técnicas

O TypeScript verifica produtores e consumidores durante o desenvolvimento. Essa garantia não substitui validação em runtime para código realmente remoto.

## 11. Os testes se concentram no protocolo crítico

### Por que

O erro mais caro é aquele que quebra todos os add-ons. Por isso, registro, validação, fallback, carregamento e clientes merecem testes pequenos e determinísticos.

### Decisão

O `@addons/core` mantém testes unitários ao lado do código. O servidor e os add-ons com transformação própria também testam seus handlers e serviços.

### Consequências técnicas

Rede real é substituída por funções injetadas ou mocks sempre que o objetivo é testar regras. A interface React ainda depende principalmente de verificação manual.

## 12. Um add-on pode ser um servidor HTTP

### Por que

Executar tudo dentro do host aumenta acoplamento, tamanho da build e risco. Algumas capacidades funcionam melhor como serviços independentes.

### Decisão

O protocolo aceita add-ons que declaram `resources` e respondem por HTTP, seguindo a organização de rotas popularizada pelo Stremio.

### Consequências técnicas

O host usa `HttpTextAddonClient`; o servidor usa `@addons/addon-server`. Código e implantação podem evoluir separadamente, mas o sistema precisa tratar rede, CORS, tempo de resposta e indisponibilidade.

## 13. Texto usa entrega em duas etapas

### Por que

Enviar o conteúdo completo em catálogos e buscas desperdiça banda. Na maioria das vezes, o usuário só abre alguns resultados.

### Decisão

Catálogo e busca devolvem metadados. O recurso `text` devolve uma lista de opções no formato:

```json
{
  "texts": [
    {
      "id": "texto-1",
      "url": "https://example.com/text/text/texto-1/content.txt",
      "lang": "pt-BR",
      "name": "Versão principal"
    }
  ]
}
```

### Consequências técnicas

O host busca o conteúdo apontado por `url` somente quando necessário. O formato se inspira em `subtitles` do Stremio, adaptado para texto puro.

## 14. O servidor HTTP permanece autônomo

### Por que

Um add-on remoto deve ser simples de hospedar sem carregar toda a ferramenta TypeScript do protocolo.

### Decisão

`@addons/addon-server` e os add-ons de texto usam JavaScript ESM puro e zero dependências externas de runtime.

### Consequências técnicas

O servidor mantém uma validação mínima própria. A validação canônica continua no `@addons/core`; qualquer mudança de contrato precisa avaliar e sincronizar as duas implementações.

## 15. Serviços podem compor outros serviços

### Por que

Extensões úteis raramente vivem isoladas. Favoritos precisam de armazenamento; busca agregada precisa de fontes; o host pode oferecer infraestrutura sem conhecer cada consumidor.

### Decisão

Um add-on pode consultar `host.services` durante o `setup` e construir sua capacidade a partir de serviços existentes.

### Consequências técnicas

- o host registra infraestrutura com uma origem explícita, como `addonId: "host"`;
- consumidores devem prever a ausência de dependências opcionais;
- dependências obrigatórias ainda precisam de um modelo formal futuro;
- add-ons não importam outros add-ons diretamente.

## 16. A interface de demonstração pertence ao add-on ativo

### Por que

Abas fixas no host faziam o aplicativo conhecer serviços e exemplos específicos. Uma extensão removida ainda deixava sua interface no host, o que contradiz a ideia de instalação independente.

### Decisão

Todo manifesto declara `tab.title` e `tab.body`. Um módulo em processo exporta `createTab(host)`, que fornece campos, ações e `run(actionId, values)`. O retorno de `run` é uma resposta declarativa que o host renderiza sem conhecer a regra do add-on.

### Consequências técnicas

- o host lista somente instâncias `ready`, ativas e com aba;
- desativar ou remover uma extensão remove sua aba imediatamente;
- cada add-on mantém sua própria funcionalidade, inclusive estado de serviço e chamadas remotas;
- add-ons HTTP podem declarar uma aba informativa no manifesto; para ações interativas precisam também de um módulo em processo;
- itens de uma resposta podem transportar `details` em JSON; o host só os mostra sob demanda e não interpreta sua estrutura;
- o contrato é neutro de React, portanto o `core` não passa a depender da biblioteca de interface.

## 17. Persistência e observabilidade são capacidades opcionais

### Por que

Gravar dados diretamente pelo host fazia Favoritos persistir mesmo sem uma extensão de armazenamento instalada. Da mesma forma, mensagens no console eram invisíveis dentro da POC e não permitiam que uma extensão de debug mostrasse o que as demais executaram.

### Decisão

O protocolo usa dois serviços opcionais: `addonStateStore`, para valores serializáveis por chave, e `debugLog`, para eventos estruturados. Os add-ons consumidores consultam esses serviços no momento da operação; se estiverem ausentes, continuam em memória e não gravam estado. Abas que desejam salvar sua interface declaram a ponte `persistence` com `load` e `save`.

`storage-local` oferece `addonStateStore` com prioridade `10`; `storage-session`, com prioridade `0`. Portanto o armazenamento local vence enquanto ambos estiverem ativos. `debug` oferece `debugLog` e mostra seus eventos pela própria aba.

### Consequências técnicas

- o host não registra mais `localStorage` como infraestrutura implícita;
- nome e resposta das abas, contador, histórico de busca e lista de favoritos persistem somente com algum `addonStateStore` ativo;
- logs estruturados são emitidos por `HostAPI.log` e exibidos em tempo real quando Debug está ativo;
- desativar um provedor limpa sua implementação do registro, de modo que outro provedor ativo pode assumir ou nenhum estado será salvo;
- os dados já existentes no armazenamento não são apagados ao desativar a extensão; somente deixam de ser lidos e atualizados até ela voltar a ficar ativa.

## 18. O host preserva sua lista de instalações

### Por que

Sem guardar as URLs instaladas, um F5 apaga todas as instâncias em memória. Isso também impede que o host reative `storage-local` antes de carregar os consumidores e, portanto, torna a persistência de estado pouco útil entre recarregamentos.

### Decisão

O host guarda em `localStorage` uma configuração pequena com as URLs dos manifestos instalados e as URLs desativadas. No carregamento inicial, ele restaura primeiro os provedores de armazenamento, depois Debug e por fim os demais na ordem registrada. Se a chave não existir, inicia sem extensões.

### Consequências técnicas

- remover uma extensão também a remove da configuração persistida;
- desativar uma extensão permanece desativado após recarregar;
- uma URL que não puder ser restaurada é ignorada naquela sessão e sai da lista persistida ao final do carregamento;
- a configuração do host não substitui `addonStateStore`: ela só permite reconstruir as extensões que poderão escolher persistir seus próprios dados.

## 19. Todo add-on declara seu contrato de interação

### Por que

Uma pessoa conseguia instalar um add-on sabendo seu nome e serviço, mas não conseguia identificar todos os dados recebidos, o estado gravado ou as chamadas HTTP feitas por ele. Essa lacuna impede uma escolha consciente e deixa mudanças de capacidade silenciosas.

### Decisão

Todo manifesto compatível deve trazer `interactions` na versão `1.0.0`. O bloco descreve serviços fornecidos e consumidos, campos e ações da aba, estado por chave ou padrão, HTTP recebido e enviado e eventos de log. Os dados são classificados como públicos, pessoais ou secretos; valores secretos não entram no manifesto nem devem ser mostrados pela interface.

O host rejeita um manifesto sem contrato. Ele compara serviços fornecidos, campos e ações mediadas com a declaração, encaminha apenas os campos aceitos pela ação e bloqueia acesso a serviço ou chave de estado não declarados. A URL continua sendo a identidade, mas uma alteração no contrato na mesma URL exige nova aceitação antes da reativação.

### Consequências técnicas e limite atual

- `AddonManifest.interactions` e `validateManifest` formam o novo contrato canônico;
- o host persiste a impressão digital aceita do contrato com sua configuração de instalação;
- add-ons HTTP registram método, origem, rota-modelo, finalidade, entrada e saída esperada;
- HTTP de saída ainda não é mediado, logo permanece uma declaração transparente e não uma permissão tecnicamente bloqueada;
- a mudança é incompatível para manifestos antigos: eles precisam publicar `interactions` antes de serem instalados.

## Quando revisar uma decisão

Uma decisão pode mudar quando a POC produzir evidência melhor. A revisão deve atualizar, na mesma entrega:

1. a explicação do problema;
2. a nova decisão e as alternativas descartadas;
3. o código e os testes afetados;
4. a arquitetura, o manifesto e o glossário, quando aplicável;
5. o status da fase correspondente.
