# addons-app-poc

Imagine um aplicativo que ganha novas capacidades sem precisar ser reconstruído toda vez. Um desenvolvedor publica uma extensão, informa seu endereço e o aplicativo passa a usá-la. Se essa extensão falhar, outra pode assumir o trabalho.

O **addons-app-poc** existe para experimentar essa ideia. Ele é uma prova de conceito, ou **POC**: um laboratório pequeno, executável e testável, criado para descobrir se uma arquitetura funciona antes de levá-la a um produto real.

## O problema que queremos resolver

Plugins costumam depender do código principal ou de uma loja central. No primeiro caso, adicionar uma capacidade exige alterar e reconstruir o aplicativo. No segundo, quem cria uma extensão depende da aprovação e da infraestrutura de um intermediário.

Este projeto explora um terceiro caminho: add-ons independentes, descritos por um manifesto e identificados pelo endereço desse manifesto. O aplicativo principal, chamado **host**, conhece os contratos do sistema, mas não precisa conhecer os detalhes de cada implementação.

Essa ideia foi inspirada no protocolo de add-ons do Stremio. A inspiração está nas fronteiras técnicas — manifesto, recursos HTTP e descoberta por URL — e não no tipo de conteúdo distribuído.

## O que você pode ver funcionando

O projeto demonstra dois formatos de add-on que convivem no mesmo protocolo:

1. **Add-on em processo:** é um módulo JavaScript carregado pelo host. Durante a inicialização, ele registra serviços como saudação, contador ou favoritos.
2. **Add-on HTTP:** é um servidor independente. O host lê seu manifesto e consulta catálogos, buscas e textos por rotas HTTP.

O host também demonstra **prioridade** e **fallback**. Quando dois add-ons oferecem o mesmo serviço, a implementação de maior prioridade é tentada primeiro. Se ela falhar, `withFallback` ou `withFallbackAsync` tenta a próxima.

## Visão rápida da arquitetura

```text
                        contratos e regras
                    ┌──────────────────────┐
                    │    @addons/core      │
                    │ manifesto, registry, │
                    │ validação e clientes │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
    ┌────────▼────────┐                 ┌────────▼────────┐
    │    Host App     │                 │     Add-ons     │
    │ React, gestão e │                 │ em processo ou  │
    │ demonstrações   │                 │ servidores HTTP │
    └─────────────────┘                 └─────────────────┘
```

O `core` é o centro do protocolo. O host e os add-ons dependem dele, mas add-ons não dependem do host. Os add-ons HTTP usam `@addons/addon-server`, um servidor Node.js sem dependências externas de runtime.

## Como executar

Você precisa de Node.js e `pnpm`. Na raiz do projeto, execute:

```bash
pnpm install
pnpm dev
```

O comando inicia o host em `http://localhost:5280` e os quatro servidores de texto:

| Porta | Add-on | Origem do conteúdo |
|---:|---|---|
| `5291` | Biblioteca de Textos | Acervo embutido |
| `5292` | Citações da Web | DummyJSON Quotes |
| `5293` | Poemas | PoetryDB |
| `5294` | Wikipédia | APIs da Wikipédia |

No WSL2, abra `http://localhost:5280` manualmente no navegador do Windows. O servidor já escuta em `0.0.0.0` e o script evita tentar abrir um navegador dentro do Linux.

Para encerrar os processos iniciados pelo modo de desenvolvimento:

```bash
pnpm kill-all
```

### Outros comandos úteis

| Comando | O que faz |
|---|---|
| `pnpm dev:host` | Inicia apenas o host |
| `pnpm dev:addons` | Inicia apenas os add-ons HTTP |
| `pnpm test` | Executa os testes de todos os pacotes |
| `pnpm build:host` | Gera a build de produção do host |

## Como explorar a demonstração

Comece pela interface do host:

- **Saudação:** usa o serviço `greeter`.
- **Contador:** usa o serviço `counter`.
- **Fallback:** mostra a troca automática entre duas implementações de `greeter`.
- **Textos:** consulta os quatro servidores HTTP, navega catálogos, busca e carrega conteúdo sob demanda.
- **Inspetor:** mostra os serviços presentes no registro.
- **Extras:** demonstra formatação, busca agregada, favoritos e verificação de disponibilidade.

## Pacotes do projeto

| Pacote | Responsabilidade |
|---|---|
| `@addons/core` | Tipos, regras de domínio, registro de serviços, validação, fallback, portas e adaptadores |
| `@addons/host-app` | Aplicativo React que reúne as demonstrações |
| `@addons/addon-server` | Servidor HTTP para add-ons de texto |
| `@addons/addon-hello` | Saudação padrão |
| `@addons/addon-hello-pt` | Saudação prioritária, usada para demonstrar fallback |
| `@addons/addon-counter` | Contador com estado em memória |
| `@addons/addon-markdown` | Serviço `textFormatter` |
| `@addons/addon-aggregator` | Serviço `searchProvider` para busca em vários servidores |
| `@addons/addon-favorites` | Serviço `favorites`, persistido pelo `bookmarkStore` do host |
| `@addons/addon-health` | Serviço `healthCheck` para os servidores remotos |
| `@addons/addon-text-*` | Biblioteca, citações, poemas e Wikipédia por HTTP |

## Onde continuar a leitura

Toda a documentação usa a mesma progressão: começa com a explicação mais simples e aprofunda apenas depois.

1. [`docs/PLANNING.md`](docs/PLANNING.md) conta como o problema e a solução evoluíram.
2. [`docs/PRD.md`](docs/PRD.md) define o que a POC precisa provar.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explica os componentes, os fluxos e as limitações atuais.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) registra as decisões e suas consequências.
5. [`docs/MANIFEST-SPEC.md`](docs/MANIFEST-SPEC.md) especifica os dois formatos de manifesto.
6. [`docs/PHASES.md`](docs/PHASES.md) mostra o que foi entregue e o que ainda está planejado.
7. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) define os termos usados no projeto.

## Limites atuais

Esta POC prova o protocolo, mas ainda não é uma plataforma pronta para produção. O host de demonstração importa os add-ons em processo durante a build, embora o `core` já contenha um loader por URL. Instalação arbitrária por URL, negociação de versões, cache, descarregamento completo e sandbox ainda não estão concluídos.

Esses limites são intencionais e estão detalhados na documentação. Separar claramente o que já funciona do que ainda é direção futura mantém a POC honesta e útil.

## Licença

MIT.
