# addons-app-poc

Imagine um aplicativo que ganha novas capacidades sem precisar ser reconstruído toda vez. Um desenvolvedor publica uma extensão, informa seu endereço e o aplicativo passa a usá-la. Se essa extensão falhar, outra pode assumir o trabalho.

O **addons-app-poc** existe para experimentar essa ideia. Ele é uma prova de conceito, ou **POC**: um laboratório pequeno, executável e testável, criado para descobrir se uma arquitetura funciona antes de levá-la a um produto real.

## O problema que queremos resolver

Plugins costumam depender do código principal ou de uma loja central. No primeiro caso, adicionar uma capacidade exige alterar e reconstruir o aplicativo. No segundo, quem cria uma extensão depende da aprovação e da infraestrutura de um intermediário.

Este projeto explora um terceiro caminho: add-ons independentes, descritos por um manifesto e identificados pelo endereço desse manifesto. O aplicativo principal, chamado **host**, conhece os contratos do sistema, mas não precisa conhecer os detalhes de cada implementação.

Essa ideia foi inspirada no protocolo de add-ons do Stremio. A inspiração está nas fronteiras técnicas — manifesto, recursos HTTP e descoberta por URL — e não no tipo de conteúdo distribuído.

## O que você pode ver funcionando

O projeto demonstra dois formatos de add-on que convivem no mesmo protocolo:

1. **Add-on em processo:** é um módulo JavaScript carregado pelo host a partir da URL declarada no manifesto. Durante a inicialização, ele registra os serviços que seu contrato permite.
2. **Add-on HTTP:** é um servidor independente. O host lê seu manifesto e consulta catálogos, buscas e textos por rotas HTTP.

O runtime e os testes também demonstram **prioridade** e **fallback**. Quando dois add-ons oferecem o mesmo serviço, o registry interno ordena as implementações e a operação de fallback tenta a próxima quando a anterior falha. Os helpers de fallback são internos à implementação do runtime; a API pública do add-on continua sendo `host.services.use(contrato)`.

Em **Configurações**, uma pessoa pode informar a URL de um manifesto, revisar o contrato do protocolo e só então instalar o add-on. A escolha, as extensões desativadas e a aceitação do contrato sobrevivem ao recarregamento da página. Cada extensão ativa ganha uma rota própria na barra lateral.

## Visão rápida da arquitetura

```text
                        contratos e regras
                    ┌──────────────────────┐
                    │ @addons-poc/protocol │
                    │ contrato v1, schema,│
                    │ validação e SDK      │
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

`@addons-poc/protocol` é a fronteira pública de compatibilidade. O runtime do host (loader, registro, estados e adaptadores) fica em `packages/host-app/src/runtime`; add-ons não dependem do host nem uns dos outros. Os add-ons HTTP usam `@addons/addon-server`, um servidor Node.js sem dependências externas de runtime.

## Como executar

Você precisa de Node.js e `pnpm`. Na raiz do projeto, execute:

```bash
pnpm install
pnpm dev
```

O comando inicia o host em `http://localhost:5280`, quatro servidores de texto e dez add-ons em processo. Cada um publica seu próprio manifesto e bundle; o host não os serve.

| Porta | Add-on | Origem do conteúdo |
|---:|---|---|
| `5291` | Biblioteca de Textos | Acervo embutido |
| `5292` | Citações da Web | DummyJSON Quotes |
| `5293` | Poemas | PoetryDB |
| `5294` | Wikipédia | APIs da Wikipédia |

Os add-ons em processo usam as portas `5301` a `5310`. Por exemplo, `http://localhost:5301/manifest.json` publica o add-on Hello. Cada add-on em processo aceita `pnpm --filter @addons/<nome> serve` para ser executado separadamente.

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
| `pnpm --filter @addons/addon-hello serve` | Empacota e serve apenas o add-on Hello em `5301` |
| `pnpm test` | Executa os testes de todos os pacotes |
| `pnpm build:host` | Gera a build de produção do host |

### Preparar a publicação do protocolo

O pacote público fica em `packages/protocol`. Antes de publicar, confirme a
conta e a propriedade do escopo na organização; se essa checagem falhar, não
publique em outro nome:

```bash
cd packages/protocol
npm whoami
npm access list packages @addons-poc
npm pack --dry-run
npm publish --access public
```

A versão única desta entrega é `@addons-poc/protocol@1.0.0`. Depois do envio,
confirme `npm view @addons-poc/protocol@1.0.0` e faça uma instalação em um
projeto temporário.

## Como explorar o host

O host inicia sem add-ons embutidos. Em **Configurações**, informe a URL de um manifesto:

- revise o contrato do protocolo antes de instalar;
- aceite o contrato para ativar a extensão;
- abra a rota criada na barra lateral;
- desative, remova ou recarregue a página para conferir a persistência da escolha.

A mesma tela exibe URLs locais de `manifest.json` como atalho. Os títulos e
resumos são lidos genericamente de cada manifesto, sem carregar o bundle:
**Copiar** preenche o campo de URL e **Instalar** preenche o campo e inicia a
revisão do contrato.

Os quatro servidores HTTP iniciados por `pnpm dev` continuam disponíveis como exemplos independentes. Eles podem ser instalados pelas URLs `http://localhost:5291/manifest.json` a `http://localhost:5294/manifest.json`; o host não os conhece nem os inclui em sua build.

## Pacotes do projeto

| Pacote | Responsabilidade |
|---|---|
| [`@addons-poc/protocol`](packages/protocol/README.md) | Contrato v1, JSON Schema, SemVer, descritores de serviço, validadores e SDK de autoria |
| [`@addons/host-app`](packages/host-app/README.md) | Aplicativo React genérico que instala e apresenta add-ons por URL |
| [`@addons/addon-server`](packages/addon-server/README.md) | Servidor HTTP para add-ons de texto |
| [`@addons/addon-hello`](packages/addon-hello/README.md) | Saudação padrão |
| [`@addons/addon-hello-pt`](packages/addon-hello-pt/README.md) | Saudação prioritária, usada para demonstrar fallback |
| [`@addons/addon-counter`](packages/addon-counter/README.md) | Contador com estado opcional |
| [`@addons/addon-markdown`](packages/addon-markdown/README.md) | Serviço namespaceado de Markdown |
| [`@addons/addon-aggregator`](packages/addon-aggregator/README.md) | Busca agregada entre servidores HTTP |
| [`@addons/addon-favorites`](packages/addon-favorites/README.md) | Serviço namespaceado de favoritos |
| [`@addons/addon-health`](packages/addon-health/README.md) | Verificação dos servidores remotos |
| [`@addons/addon-storage-local`](packages/addon-storage-local/README.md) | Serviço oficial opcional `state-store` no `localStorage` |
| [`@addons/addon-storage-session`](packages/addon-storage-session/README.md) | Serviço oficial opcional `state-store` na sessão |
| [`@addons/addon-debug`](packages/addon-debug/README.md) | Serviço namespaceado de logs estruturados |
| [`@addons/addon-text-*`](docs/PACKAGES.md) | Biblioteca, citações, poemas e Wikipédia por HTTP |

## Onde continuar a leitura

Toda a documentação usa a mesma progressão: começa com a explicação mais simples e aprofunda apenas depois.

1. [`docs/PLANNING.md`](docs/PLANNING.md) conta como o problema e a solução evoluíram.
2. [`docs/PRD.md`](docs/PRD.md) define o que a POC precisa provar.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explica os componentes, os fluxos e as limitações atuais.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) registra as decisões e suas consequências.
5. [`docs/MANIFEST-SPEC.md`](docs/MANIFEST-SPEC.md) especifica os dois formatos de manifesto.
6. [`docs/PHASES.md`](docs/PHASES.md) mostra o que foi entregue e o que ainda está planejado.
7. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) define os termos usados no projeto.
8. [`docs/PACKAGES.md`](docs/PACKAGES.md) reúne o README e o comando de cada pacote.

## Contrato público v1

Todo manifesto tem uma única seção `contract` com versão do protocolo, faixa
SemVer, capacidades, descritores de serviços, UI declarativa, estado, HTTP e
logs. O schema publicável está em `@addons-poc/protocol/schema`. Serviços que
não são oficiais usam nomes namespaceados, como `addons.hello.greeter`.

`host.services.use({ id, version, methods })` devolve uma proxy tipada e
mediada. A entrada e a saída declaradas são verificadas no ponto de uso. O
host escolhe provedores por prioridade e deixa fallback explícito. Um serviço
obrigatório ausente bloqueia a instalação até surgir um provedor compatível;
ciclos obrigatórios também são bloqueados.

## Limites atuais

Esta POC prova o protocolo, mas ainda não é uma plataforma pronta para produção. Cada add-on precisa publicar seu próprio manifesto e bundle ou servidor HTTP. Ainda faltam cache e atualização de manifestos, sandbox e proxy de rede.

Plugins são confiáveis e podem chamar APIs globais. O manifesto registra I/O
externo para revisão, mas a v1 não oferece sandbox, proxy de rede, `onUnload`
mediado ou bloqueio de `fetch` direto. Esses limites são intencionais e estão
detalhados na documentação.

## Licença

MIT.
