# A jornada de planejamento

Este documento conta como a arquitetura ganhou forma. Ele é uma narrativa histórica, não uma lista de regras atuais. Para consultar contratos vigentes, use `ARCHITECTURE.md`, `DECISIONS.md` e `MANIFEST-SPEC.md`.

## 1. O incômodo inicial

A conversa começou com um problema comum em sistemas modulares: partes que deveriam ser substituíveis estavam ligadas por dependências diretas. Trocar uma implementação significava alterar importações, reconstruir aplicações e coordenar versões de muitas peças ao mesmo tempo.

O contexto que inspirou a conversa envolvia outros projetos, mas a conclusão foi criar esta POC como um laboratório independente. O `addons-app-poc` não faz parte do ecossistema AC nem depende dele.

## 2. A primeira ideia: pedir capacidades, não pacotes

A inspiração inicial veio de contêineres de serviços e inversão de controle. O nome técnico é menos importante que a mudança de pergunta.

Em vez de escrever “importe exatamente o pacote X”, o consumidor diz “preciso de algo que cumpra o contrato Y”. Um registro apresenta a implementação disponível.

Isso trouxe a primeira peça do desenho: o `ServiceRegistry`.

```text
consumidor ── pede "greeter" ──► registro
                                      ▲
                                      │ registra "greeter"
                                    add-on
```

O registro resolveria o acoplamento dentro do processo. Ainda faltava entender como publicar, descobrir e substituir extensões de forma independente.

## 3. O manifesto entra na história

Um add-on precisava se apresentar antes de executar. Nasceu então o manifesto: um objeto legível que declara nome, versão, autoria, licença e capacidades.

A decisão mais importante foi usar a **URL do manifesto como identidade**. O campo `id` poderia continuar amigável, mas a localização completa seria o valor estável usado pelo host.

Essa escolha abriu uma possibilidade: o add-on poderia morar fora do repositório e ser encontrado por endereço.

## 4. A lição do Stremio

O protocolo do Stremio mostrou uma fronteira útil. O aplicativo principal não precisa importar todo add-on; pode conversar com servidores independentes por um conjunto previsível de recursos.

A POC adotou essa organização como referência técnica e a adaptou para textos:

| Referência de mídia | Adaptação nesta POC |
|---|---|
| manifesto remoto | manifesto remoto |
| catálogo de itens | catálogo de textos, citações, poemas ou páginas |
| busca | busca na fonte do add-on |
| opções de legenda | opções de texto com uma URL de conteúdo |
| conteúdo carregado depois | texto puro carregado sob demanda |

O objetivo não era copiar um produto inteiro. Era aprender com a separação entre host, contrato e servidor externo.

## 5. A primeira POC: tudo dentro do processo

Começar por servidores teria misturado rede, protocolo e interface cedo demais. O primeiro degrau foi menor:

1. definir `AddonManifest`;
2. validar o objeto;
3. criar `ServiceRegistry`;
4. definir `HostAPI`;
5. carregar um módulo com `manifest` e `setup`;
6. provar o fluxo com saudação e contador;
7. mostrar o resultado em um host React.

Essa ordem transformou cada abstração em algo observável. O contador provou estado. A saudação provou um contrato simples. O host provou que serviços podiam chegar à interface.

## 6. O grilling: perguntas que endureceram o desenho

O planejamento foi submetido a perguntas difíceis. As respostas viraram decisões duráveis:

- Como distinguir dois add-ons com o mesmo nome? Pela URL do manifesto.
- Como inspecionar antes de executar? Separando `manifest` e `setup`.
- Quanto do host deve ser exposto? Apenas um `HostAPI` pequeno.
- Onde produtores e consumidores se encontram? No `ServiceRegistry`.
- Quem vence quando há concorrência? A maior prioridade explícita.
- O que acontece se a ativação falhar? A instância entra em erro.
- O que acontece se o serviço preferido falhar? O fallback tenta o próximo.
- Qual formato de módulo usar? ESM nativo.
- O que merece testes primeiro? As regras críticas do protocolo.

As respostas completas, incluindo consequências e lacunas atuais, estão em `DECISIONS.md`.

## 7. O plano B vira parte do protocolo

Depois que duas implementações puderam coexistir, apareceu uma diferença importante: ordenar não é o mesmo que executar.

O registro ficou responsável apenas pela lista ordenada. As funções `withFallback` e `withFallbackAsync` receberam a responsabilidade de chamar cada implementação e lidar com exceções.

O `addon-hello-pt` tornou a ideia visível. Ele tem prioridade maior, mas falha de propósito para o nome `error`. Nesse momento, o saudador padrão assume.

Essa demonstração mostrou que substituição não precisa ser uma decisão de build. Pode ser uma decisão de runtime, tomada no instante da chamada.

## 8. A virada para servidores independentes

Com o fluxo em processo funcionando, o projeto voltou à pergunta maior: um add-on pode morar em qualquer lugar?

Surgiu o segundo formato. Em vez de `entrypoint` e `services`, o manifesto poderia declarar `resources`, `types` e `catalogs`. O host não executaria o servidor; faria requisições HTTP.

O `@addons/addon-server` foi criado para reduzir o trabalho repetitivo. Um add-on fornece quatro funções, e o framework monta manifesto, catálogo, busca, opções de texto e conteúdo.

Três fontes provaram aspectos diferentes:

- a Biblioteca mostrou conteúdo local ao servidor;
- Citações mostrou transformação de uma API simples;
- Poemas mostrou busca e leitura a partir de uma API externa.

Depois, a Wikipédia acrescentou uma quarta fonte e reforçou que o mesmo contrato podia esconder APIs de origem diferentes.

## 9. Entrega sob demanda

Enviar textos completos durante uma busca seria desperdício. A solução foi adaptar o formato de opções de legenda: o add-on devolve metadados e uma URL, e o host busca o conteúdo quando o usuário abre o item.

```text
busca ──► metadados ──► escolha ──► opções de texto ──► conteúdo
```

Essa sequência mantém respostas iniciais pequenas e permite mais de uma versão ou idioma no futuro.

## 10. Add-ons começam a colaborar

Depois de provar add-ons isolados, a POC passou a demonstrar composição:

- o agregador consulta vários servidores e mescla resultados;
- favoritos usa um armazenamento oferecido pelo host;
- health check consulta os mesmos servidores para medir disponibilidade;
- o formatador reaproveita regras puras do `core`.

O ponto central é que nenhuma dessas extensões importa outra extensão. Elas conhecem contratos ou URLs, e o registro continua sendo a fronteira dentro do processo.

## 11. O que aprendemos com a implementação

O código revelou diferenças entre uma arquitetura desenhada e uma arquitetura realmente demonstrada.

O `FetchAddonLoader` consegue buscar manifesto e importar bundle por URL, mas o host visual ainda usa imports locais. O loader recebe callbacks de unload, mas não oferece o ciclo que os executa. Uma falha de setup vira estado `error`, mas registros criados antes da exceção ainda precisam ser removidos explicitamente.

Registrar essas diferenças é parte do resultado da POC. Um experimento é valioso justamente quando mostra quais peças da ideia são simples e quais exigem desenho adicional.

## 12. A direção daqui para frente

O próximo capítulo não é adicionar mais exemplos. É completar o ciclo de vida:

1. tornar a ativação transacional;
2. executar a limpeza no unload;
3. conectar instalação por URL ao host;
4. persistir escolhas e prioridades;
5. negociar versões e cache;
6. investigar isolamento real.

Quando essas etapas existirem, a POC poderá responder uma pergunta mais exigente: não apenas “o protocolo funciona?”, mas “ele continua compreensível e seguro quando add-ons deixam de ser confiáveis?”.

O roteiro verificável está em `PHASES.md`, e os requisitos correspondentes estão em `PRD.md`.
