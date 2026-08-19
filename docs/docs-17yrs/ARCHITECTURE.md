# Arquitetura: Como Tudo Funciona por Dentro

*Um guia visual, passo a passo, para você entender perfeitamente como as peças deste sistema se encaixam e conversam entre si.*

---

## 1. A Grande Ideia

Imagine que você está construindo um aplicativo incrível (o **Host**) e quer permitir que outras pessoas criem extensões para ele (os **Add-ons**). O grande desafio arquitetural aqui é: como fazer o Host usar os Add-ons sem que eles fiquem eternamente "amarrados" um ao outro?

A resposta é introduzir um intermediário: o **ServiceRegistry** (Registro de Serviços).

Pense no ServiceRegistry como um grande painel de classificados. Os Add-ons vão até o painel e colam um anúncio: *"Eu sei fazer saudações!"*. Quando o Host precisa saudar um usuário, ele não procura por um Add-on específico. Ele simplesmente vai ao painel e pergunta: *"Alguém aqui sabe fazer saudações?"*.

Dessa forma, o Host não conhece os Add-ons, e os Add-ons não conhecem o Host. Ambos conhecem apenas o intermediário.

```text
┌───────────────────────────────────────────────┐
│                   Host App                    │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │           ServiceRegistry               │  │
│  │  ┌──────────┐  ┌──────────┐             │  │
│  │  │ greeter  │  │ counter  │  ...        │  │
│  │  │ [impl1]  │  │ [impl1]  │             │  │
│  │  │ [impl2]  │  │          │             │  │
│  │  └──────────┘  └──────────┘             │  │
│  └─────────────────────────────────────────┘  │
│         ▲                      ▲              │
│         │ setup(hostAPI)       │ get/getAll   │
│         ▼                      │              │
│  ┌──────────────┐  ┌────────────────────┐     │
│  │ addon-hello  │  │  addon-counter     │     │
│  │ ┌──────────┐ │  │  ┌──────────────┐  │     │
│  │ │ manifest │ │  │  │ manifest     │  │     │
│  │ │ setup()  │─┼──┼──┤ setup()      │  │     │
│  │ └──────────┘ │  │  └──────────────┘  │     │
│  └──────────────┘  └────────────────────┘     │
└───────────────────────────────────────────────┘

```

---

## 2. As Camadas do Sistema

Para manter tudo organizado e fácil de manter, nós dividimos o sistema em três grandes camadas. Vamos construir a complexidade aos poucos:

### A Camada Core (`@addons/core`)

Este é o cérebro da operação. A regra de ouro aqui é a **pureza**. O Core não sabe o que é React, Vite, navegador ou internet. Ele é escrito puramente em TypeScript.

Nós dividimos o Core em três zonas para separar as regras de negócio dos detalhes técnicos:

1. **Domínio (`domain/`):** A essência do sistema. Aqui vivem as regras puras, sem efeitos colaterais (como o próprio `ServiceRegistry`). O Domínio não faz ideia de como o mundo exterior funciona.
2. **Portas (`ports/`):** As interfaces. É como se o Domínio dissesse: *"Eu preciso de algo que carregue add-ons, não me importa como"*.
3. **Adaptadores (`adapters/`):** As tomadas. São as implementações reais que se conectam às "portas". Por exemplo, um adaptador que usa HTTP para carregar um Add-on da internet.

**Por que essa separação é importante?**
Imagine que você precisa testar se o `ServiceRegistry` está funcionando. Como ele está isolado no Domínio, você pode testá-lo instantaneamente, sem precisar de conexão com a internet ou de um navegador. Além disso, se amanhã você quiser parar de carregar add-ons via internet (HTTP) e passar a carregá-los de um banco de dados local, basta trocar a "tomada" (Adaptador). O resto do sistema continua intacto!

### A Camada Add-ons (`@addons/addon-*`)

São as extensões independentes. Cada Add-on precisa fornecer apenas duas coisas para o sistema:

* **`manifest`**: Sua identidade (Quem sou eu? O que eu ofereço?).
* **`setup`**: Uma função que, quando chamada, registra seus serviços no painel do Host.

### A Camada Host App (`@addons/host-app`)

Este é o aplicativo que você vê na tela (sua interface de usuário). Ele funciona como um grande "Adaptador de Interface" que conecta o cérebro (Core) ao usuário. Seu trabalho é:

1. Criar o `ServiceRegistry`.
2. Ligar as tomadas (como logs no console e carregadores de internet).
3. Encontrar e carregar os Add-ons.
4. Chamar a função `setup` de cada um.
5. Consumir os serviços e mostrá-los na tela para o usuário.

---

## 3. O Ciclo de Vida de um Add-on

O que exatamente acontece nos bastidores quando o aplicativo tenta carregar um Add-on? É um processo rigoroso de validação para garantir que nada quebre o seu aplicativo principal.

### Passo a passo do Carregamento:

1. O Host descobre a URL de um manifesto.
2. O Host faz o download (via HTTP GET) desse manifesto.
3. **Validação:** O Host checa se os campos obrigatórios e a versão estão corretos.
4. *Se inválido:* O erro é registrado e o carregamento é abortado imediatamente.
5. *Se válido:* O Host importa o código-fonte do Add-on.
6. O Host verifica se o código exporta o `manifest` e a função `setup`.
7. O Host executa o `setup(hostAPI)`.
8. *Se falhar:* O Add-on é marcado com erro e ignorado.
9. *Se der tudo certo:* O Add-on é marcado como **"ready"** (pronto) e seus serviços ficam disponíveis!

### Como o Host consome um serviço:

Quando o Host precisa de algo (por exemplo, o serviço `"greeter"`), o fluxo é simples:

1. O Host pede ao Registry: `registry.get("greeter")`.
2. O Registry olha na sua lista quem oferece esse serviço.
3. Se houver mais de um, ele ordena pela **prioridade** (quem tiver o número maior, ganha).
4. O Registry devolve a melhor implementação disponível.

> **Dica de mestre:** O Host também pode usar `registry.getAll("greeter")` para pegar a lista inteira de opções. Isso é útil se ele quiser tentar a opção A e, caso ela falhe, ter a opção B como plano de segurança (fallback).

---

## 4. O Novo Modelo: Add-ons como Servidores (Estilo Stremio)

Até aqui, vimos Add-ons que são pedaços de código importados para dentro do aplicativo. Mas existe um segundo modelo muito mais poderoso: **o Add-on como um servidor independente na internet**.

Pense no *Torrentio*, o famoso add-on do *Stremio*. O Torrentio não vive dentro do código do Stremio; ele é um servidor externo mantido pela comunidade. O Stremio apenas faz perguntas a ele via internet.

### Por que isso é incrível?

* **Atualizações invisíveis:** O criador do Add-on pode atualizá-lo a qualquer momento no servidor dele, e o usuário recebe a melhoria sem precisar atualizar o aplicativo principal.
* **Resiliência:** Se o Add-on cair ou bugar, o aplicativo principal continua funcionando perfeitamente.
* **Liberdade:** Qualquer pessoa pode criar e hospedar um Add-on em qualquer lugar do mundo.

### Comparando os dois mundos

| Característica | Formato Interno (Em-processo) | Formato Servidor (Estilo Stremio) |
| --- | --- | --- |
| **O que é?** | Um módulo de código importado | Um servidor HTTP independente |
| **Identidade** | Arquivo de código (`manifest` + `setup`) | Arquivo `manifest.json` via URL |
| **O que oferece?** | Serviços programáticos (`services`) | Catálogos e Recursos de dados |
| **Como o Host usa?** | Executa as funções diretamente | Faz requisições web (HTTP GET) |

### O Formato de "Entrega Preguiçosa" (Lazy Loading)

Para economizar internet e memória, usamos uma tática inteligente para entrega de conteúdo. Em vez de o Add-on enviar um texto ou livro inteiro de uma vez, ele entrega apenas um **menu** (uma lista com o nome e a URL de onde o texto mora):

```json
{ 
  "texts": [
    { 
      "id": "1", 
      "url": "http://localhost:5291/text/1/content.txt", 
      "name": "O Amanhecer" 
    }
  ] 
}

```

O aplicativo principal recebe essa lista, mostra os títulos para o usuário e **só faz o download do texto real (acessando a URL) se o usuário decidir clicar para ler**.

---

## 5. Os Tipos Principais (Dicionário de Dados)

Para os desenvolvedores, estas são as principais "fichas cadastrais" que usamos no código TypeScript:

**1. `AddonManifest` (O Cartão de Visita):**

Diz quem o add-on é (id, versão, nome, autor, descrição) e o que ele faz. Dependendo do modelo, ele lista os `services` (para add-ons de código) ou os `resources` e `catalogs` (para add-ons de servidor).

**2. `ServiceRegistration` (O Serviço Específico):**

O anúncio de um talento. Ex: `"Eu sou o serviço 'greeter', versão 1.0, e eu saúdo pessoas."`

**3. `ServiceEntry` (O Registro Efetivado):**

É a ficha que fica guardada no ServiceRegistry, contendo a lógica real do serviço, de onde ele veio e qual a sua prioridade.

**4. `HostAPI` (O Kit de Ferramentas):**

Quando o Host chama a função `setup` de um Add-on, ele entrega esse "kit", que contém acesso ao ServiceRegistry (para o add-on se registrar) e a um sistema de logs.

---

## 6. A API do ServiceRegistry

O painel de controle tem comandos simples e diretos:

```typescript
class ServiceRegistry {
  // Cadastra um novo serviço
  register<T>(serviceId: string, instance: T, addonId: string, priority?: number): void;

  // Remove um serviço específico
  unregister(serviceId: string, addonId: string): void;

  // Pega a melhor opção de um serviço (a de maior prioridade)
  get<T>(serviceId: string): T | undefined;

  // Pega todas as opções disponíveis, ordenadas por prioridade
  getAll<T>(serviceId: string): T[];

  // Checa se alguém oferece um determinado serviço
  has(serviceId: string): boolean;

  // Apaga todos os serviços de um add-on específico
  clearAddon(addonId: string): void;
}

```

---

## 7. Lidando com Imprevistos (Tratamento de Erros)

O Host foi desenhado para ser como um ótimo goleiro: ele pode até tomar boladas, mas não cai. **Nenhum erro de um Add-on deve ser capaz de quebrar (crashar) o aplicativo principal.**

| O que deu errado? | Como o sistema reage? |
| --- | --- |
| **Link fora do ar** (O manifesto não baixa) | O erro é logado e o Add-on é ignorado. |
| **Manifesto inválido** (Faltam dados essenciais) | O erro é logado e o Add-on é ignorado. |
| **Erro no código do Add-on** (O `setup` falha) | O Add-on é marcado com "Erro". O sistema limpa tudo que ele tentou registrar e segue a vida. |
| **O serviço falhou na hora do uso** | O Host lida com o erro e pode tentar usar a próxima implementação da lista (fallback). |

---

## 8. Arquitetura de Dependências

A regra de quem conhece quem é estrita para evitar bagunça:

* O **Core** fica no centro absoluto. Ele não depende de ninguém.
* Os **Add-ons** e o **Host** dependem do Core para entender os formatos e ferramentas.
* Os **Add-ons NUNCA** dependem do Host.
* O **Host NUNCA** depende dos Add-ons diretamente na hora de programar (ele só os descobre enquanto o aplicativo está rodando).

---

## 9. Decisões Arquiteturais Importantes (ADRs)

Para finalizar, aqui está o resumo do *porquê* tomamos certas decisões de design ao longo do tempo:

* **A URL é a Identidade (ADR-001):** Não usamos IDs complexos. A própria URL de onde o Add-on vem serve como seu identificador único. É universal e dispensa cadastros centrais.
* **Separação entre Manifesto e Código (ADR-002):** Lemos os dados de identidade (JSON) antes de executar o código do Add-on. É mais seguro e rápido.
* **Uso de Prioridades (ADR-003):** Quando há empate (dois add-ons oferecendo o mesmo serviço), um número de prioridade resolve a disputa de forma previsível.
* **Core Livre de Frameworks (ADR-004):** O coração do sistema não usa React, Vite, ou qualquer framework visual. Isso garante que ele viverá por anos, independente da tecnologia da moda.
* **O Modelo de Servidor HTTP (ADR-005):** Ao permitir que Add-ons vivam em servidores remotos, criamos um ecossistema descentralizado onde atualizações são transparentes.
* **Servidores JS Puros (ADR-007):** Os servidores de Add-on não precisam do motor TypeScript pesado do Core. Eles podem ser escritos em JavaScript puro para rodarem de forma levíssima em qualquer servidor simples na nuvem.
