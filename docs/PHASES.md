# Fases do projeto

Construir um sistema extensível de uma vez esconderia riscos demais. Por isso, a POC cresce em degraus: cada fase responde a uma pergunta e deixa uma demonstração verificável.

Os estados usados aqui são **Planejado**, **Em Andamento**, **Entregue**, **Parcial**, **Desativado** e **Substituído**.

## Mapa da jornada

| Fase | Pergunta principal | Estado |
|---|---|---|
| 1. Alicerce | Um host consegue receber serviços de add-ons? | Entregue |
| 2. Substituição | Uma alternativa consegue assumir após uma falha? | Entregue |
| 3. Servidores | Um add-on pode viver fora do processo do host? | Parcial |
| 4. Composição | Add-ons conseguem formar capacidades maiores sem importações diretas? | Entregue |
| 5. Gestão e compatibilidade | O usuário consegue instalar e controlar add-ons remotos? | Planejado |
| 6. Isolamento | Código não confiável pode ser limitado com segurança? | Planejado |

“Parcial” na fase 3 significa que o formato HTTP está entregue, enquanto descoberta arbitrária, cache e negociação de versão ainda não estão.

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
- host React para explorar os serviços;
- testes do registro, da validação e do loader.

### Como verificar

Execute `pnpm test`, inicie `pnpm dev` e use as áreas **Saudação**, **Contador** e **Inspetor**.

### Limite que permaneceu

O host de demonstração importa os add-ons locais durante a build. O loader remoto existe no `core`, mas ainda não é o caminho usado pela interface.

## Fase 2 — Prioridade e fallback

**Estado: Entregue**

### Por que veio depois

Um serviço único funciona em uma demonstração feliz. Um ecossistema real precisa sobreviver quando a implementação preferida falha.

### O que foi entregue

- interfaces `Greeter` e `Counter`;
- `withFallback` para chamadas síncronas;
- `withFallbackAsync` para chamadas assíncronas;
- `AggregateFallbackError` para reunir falhas;
- `addon-hello-pt` com prioridade `10`;
- falha simulada ao receber o nome `error`;
- `addon-hello` como alternativa de prioridade `0`;
- testes de ordem, sucesso alternativo e falha total.

### Como verificar

Abra a área **Fallback**, use um nome comum e depois use `error`. O segundo caso deve cair para a saudação padrão.

## Fase 3 — Add-ons como servidores

**Estado: Parcial**

### Por que mudar o formato

Nem toda extensão precisa executar dentro do host. Conteúdo remoto e processamento externo se beneficiam de implantação independente e de um contrato HTTP simples.

### Parte entregue: protocolo de texto

- manifesto com `resources`, `types`, `idPrefixes` e `catalogs`;
- `@addons/addon-server` em JavaScript ESM puro;
- rotas para manifesto, catálogo, busca, opções de texto e conteúdo;
- `HttpTextAddonClient` no `core`;
- formato `{ texts: [{ id, url, lang, name }] }`;
- CORS para consumo local pelo navegador;
- Biblioteca de Textos na porta `5291`;
- Citações na porta `5292`;
- Poemas na porta `5293`;
- Wikipédia na porta `5294`;
- área **Textos** no host;
- testes do servidor, cliente e handlers.

### Parte pendente: descoberta e compatibilidade

- instalar um add-on pela URL digitada pelo usuário;
- manter um catálogo persistente de URLs conhecidas;
- armazenar manifestos em cache com política de atualização;
- declarar e negociar a versão mínima do host;
- validar respostas HTTP além do manifesto.

### Como verificar a parte entregue

Execute `pnpm dev`, abra **Textos** e percorra catálogo, busca e leitura. Interromper um dos quatro servidores não deve impedir os outros de responder.

## Fase 4 — Composição de serviços

**Estado: Entregue**

### Por que esta fase importa

Add-ons isolados provam extensibilidade básica. A arquitetura fica mais interessante quando uma capacidade usa outra sem criar importações diretas.

### O que foi entregue

| Add-on | Serviço | Composição demonstrada |
|---|---|---|
| `addon-markdown` | `textFormatter` | Usa funções puras de formatação do `core` |
| `addon-aggregator` | `searchProvider` | Consulta vários add-ons HTTP em paralelo |
| `addon-favorites` | `favorites` | Consome `bookmarkStore` fornecido pelo host |
| `addon-health` | `healthCheck` | Consulta manifestos e mede disponibilidade |

O host registra `bookmarkStore` com origem `host`. Se esse serviço não existir, favoritos degrada para `MemoryBookmarkStore`.

### Como verificar

Abra **Extras** e exercite formatação, busca agregada, favoritos e verificação de saúde.

## Fase 5 — Gestão e compatibilidade

**Estado: Planejado**

### Problema a resolver

Hoje, o conjunto de add-ons é conhecido pelo código da demonstração. Para se aproximar de um ecossistema real, a escolha precisa pertencer ao usuário e sobreviver ao recarregamento.

### Entregas previstas

- instalação e remoção por URL de manifesto;
- persistência das escolhas;
- edição de prioridade;
- cache e atualização de manifestos;
- negociação de versão entre host e add-on;
- mensagens claras para incompatibilidade;
- ciclo completo de unload;
- limpeza transacional de registros quando o setup falhar.

### Condição de conclusão

A fase termina quando um usuário consegue adicionar uma URL válida, reiniciar o host e encontrar o add-on preservado; uma URL inválida ou incompatível deve produzir erro compreensível sem alterar os add-ons já ativos.

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

1. Corrigir a limpeza de registros após falha de `setup`.
2. Implementar e testar o ciclo de unload.
3. Conectar o `FetchAddonLoader` à instalação por URL.
4. Persistir a lista e as prioridades escolhidas.
5. Adicionar negociação de versão e cache.
6. Só então escolher o modelo de sandbox.

Essa ordem fecha primeiro inconsistências do ciclo de vida, depois adiciona conveniência e, por último, enfrenta o isolamento — o tema mais caro e sensível.
