# Arquitetura de Add-ons: A Jornada e o Planejamento

Bem-vindo! Este documento é um registro vivo de como repensamos toda a arquitetura do nosso projeto. Aqui, você vai acompanhar a evolução das nossas ideias: desde o problema que nos travava até as decisões técnicas que nos levaram a criar um sistema modular, resiliente e incrivelmente flexível.

Se você está chegando agora, não se preocupe com termos complexos. Vamos construir o entendimento camada por camada.

---

## 1. O Ponto de Partida: Por que mudar?

Tudo começou no ecossistema **AC**, um ambiente que abrigava cinco projetos diferentes (como portais de artistas, bibliotecas de música e sistemas de sincronização) dentro de um único repositório de código (um *monorepo*).

O grande problema era **como esses projetos se conectavam**.

A arquitetura antiga usava dependências diretas. Isso significa que, se o Projeto A precisasse do Projeto B, o código do A mencionava o B explicitamente. Era como ter um carro onde as rodas estão soldadas no eixo: para trocar um pneu, você precisava desmontar o carro inteiro e reconstruí-lo do zero (o que chamamos de *rebuildar*). Precisávamos de uma forma de trocar os "pneus" com o carro em movimento.

## 2. A Semente da Ideia: A Inspiração no Cordis

A virada de chave começou com uma pergunta simples: *"E se os pacotes pudessem ser trocados sem mexer no código principal?"*

Olhamos para um framework chamado **Cordis**. Ele usa um conceito inteligente conhecido como **Inversão de Controle (IoC)**. O nome pode parecer assustador, mas a ideia é simples: em vez do seu código dizer *"Eu quero usar a ferramenta exata X"*, ele diz *"Eu preciso de uma ferramenta que faça este trabalho, me dê a melhor que você tiver registrada"*.

Isso resolve a parte técnica, mas logo percebemos que o buraco era mais embaixo. Não queríamos apenas organizar o código; queríamos mudar a forma como o sistema sobrevivia no mundo real.

## 3. O Paradigma Stremio: Construindo algo Indestrutível

Foi então que trouxemos o aplicativo **Stremio** para a mesa. No início, parecia apenas uma metáfora, mas logo vimos que era o **padrão arquitetural perfeito**.

O Stremio é famoso por ser um sistema à prova de balas. O segredo dele? Ele é fatiado em quatro camadas totalmente independentes. Se uma camada cai, as outras continuam de pé:

| Camada | O que faz? | O Exemplo no Stremio |
| --- | --- | --- |
| **1. Player (Interface)** | O aplicativo oficial que o usuário vê. | App nas lojas oficiais, 100% legal e de código aberto. |
| **2. Add-ons (Extensões)** | Scripts independentes que encontram o conteúdo. | Mantidos pela comunidade, rodam separadamente. |
| **3. Cache** | Memória rápida para entregar o conteúdo na hora. | Serviços comerciais externos, facilmente substituíveis. |
| **4. Armazenamento** | Onde o conteúdo realmente vive (descentralizado). | Rede global (BitTorrent/DHT), sem um servidor central. |

> **A grande sacada:** O que torna um sistema "indestrutível" não é usar uma tecnologia mágica, mas sim desenhar fronteiras claras entre suas partes.

## 4. O Sistema de Add-ons do AC

Ao mapear a genialidade do Stremio para as nossas necessidades no AC, percebemos que não precisávamos de um gerenciador de dependências mais complexo. **Precisávamos de um verdadeiro sistema de Add-ons.**

Veja como o AC se espelha no Stremio:

* **Player:** Nossos aplicativos e portais web.
* **Identificadores universais:** Nossa biblioteca de contratos de música (`@achorde/musical-domain`).
* **Add-ons:** Ferramentas que renderizam diagramas, editores de partituras e catálogos.
* **Cache:** Bancos de dados locais no navegador do usuário (como o IndexedDB).
* **Armazenamento Descentralizado:** Nosso motor de sincronização entre os dispositivos do usuário.

Optar por add-ons nos trouxe três superpoderes:

1. **Descoberta:** O sistema encontra as ferramentas via internet, e não lendo arquivos de código.
2. **Isolamento:** Se um add-on quebrar, o aplicativo principal continua funcionando normalmente.
3. **Poder de Escolha:** É o usuário quem decide qual add-on ativar, não o programador.

---

## 5. Como Funciona na Prática? O Motor do Sistema

Agora que entendemos o "Por que" e o "O que", vamos descer uma camada e ver o "Como".

### As Interfaces (Os Contratos)

Criamos cinco famílias de add-ons (ex: *Renderizadores de Diagramas*, *Editores*, *Mecanismos de Busca*). Cada família possui uma interface rigorosa escrita em TypeScript. É como uma tomada: se o seu add-on tem o formato certo para encaixar naquela tomada, ele vai funcionar.

### O Manifesto (O Documento de Identidade)

Todo add-on precisa de um "RG" em formato JSON, chamado Manifesto. Ele conta ao sistema tudo sobre a extensão:

* **Quem sou eu:** Nome, autor, versão, descrição.
* **Como eu funciono:** Onde está o meu código e quais serviços eu presto.
* **Do que eu preciso:** Com quais versões do aplicativo eu sou compatível.

### A Magia do Fallback (O Plano B, C e D)

O que acontece se um serviço falhar no meio do uso? O sistema usa uma rede de segurança chamada **Cadeia de Fallback**.
Se o seu aplicativo precisa renderizar um diagrama de guitarra, ele tenta o *Add-on 1*. Falhou? Ele tenta o *Add-on 2* automaticamente, sem que o usuário perceba. No fim da linha, sempre há uma opção básica e nativa garantindo que a tela não fique em branco.

---

## 6. A História do Joaquim: O Sistema Visto de Fora

Para visualizar como isso é poderoso, imagine o Joaquim. Ele é um desenvolvedor independente e teve uma ideia brilhante: um visualizador de acordes em 3D.

Com a nossa nova arquitetura, o fluxo do Joaquim é o seguinte:

1. Ele cria seu código usando nossos "contratos" (interfaces).
2. Ele hospeda o código dele e o seu Manifesto (JSON) na nuvem, de graça.
3. Ele posta o link em um fórum.

Um usuário vê o post, copia o link e cola no seu aplicativo AC. O aplicativo lê o Manifesto, carrega a ferramenta do Joaquim e... *voilà!* O usuário agora vê acordes em 3D. O Joaquim não precisou pedir permissão para a nossa equipe e nós não precisamos atualizar o nosso aplicativo.

---

## 7. O "Grilling": 13 Perguntas Difíceis, 13 Decisões Claras

Antes de escrever a primeira linha de código, decidimos criar uma Prova de Conceito (o projeto `addons-app-poc`). Para garantir que a ideia era sólida, nós a submetemos a um "grilling" (um interrogatório intenso). Aqui estão as decisões mais importantes que tomamos:

* **Identidade:** Como sabemos quem é quem? A própria URL (link) do manifesto é o CPF único do add-on.
* **Falhas na Inicialização:** Se um add-on der erro ao ligar, ele é ignorado e o aplicativo principal segue a vida.
* **Carregamento:** Usamos o padrão web nativo (ESM) para importar os arquivos JavaScript diretamente pelo navegador.
* **Estrutura Inicial:** Separamos rigorosamente o motor do sistema (`core`), o aplicativo principal (`host-app`) e os add-ons de teste (`addon-hello`, `addon-counter`).

E a estrutura final de pastas refletiu essa clareza:

```text
addons-app-poc/
├── packages/
│   ├── core/              (O motor: registros, validadores, carregamento)
│   ├── host-app/          (O aplicativo que o usuário vê)
│   ├── addon-hello/       (Add-on de teste 1)
│   └── addon-counter/     (Add-on de teste 2)
└── docs/                  (Toda a nossa documentação viva)

```

---

## 8. A Evolução: O que Aconteceu Depois do Plano

Um bom planejamento permite que o projeto evolua de forma orgânica. Depois da Fase 1, alcançamos marcos impressionantes:

### Fase 2: O Sistema Visual e as Redes de Segurança

Criamos a função `withFallback`, tornando a transição entre add-ons que falham super elegante. Também desenvolvemos o painel visual no `host-app`, onde o usuário pode instalar e gerenciar os add-ons livremente como se fosse uma "App Store" particular.

### Fase 3: A Virada para Servidores Remotos (O Modelo Torrentio)

A evolução mais espetacular. O usuário pediu: *"Vamos nos inspirar no Torrentio do Stremio"*.
No Stremio, muitos add-ons não são apenas pedaços de código no navegador; eles são **servidores inteiros** na nuvem que respondem a pedidos do aplicativo.

Adaptamos isso para o nosso ecossistema focando em **textos e dados**.

* **O Novo Manifesto:** O arquivo JSON agora pode declarar "recursos" em servidores remotos (ex: catálogos de busca, bibliotecas de texto).
* **Servidores Independentes:** Criamos uma ferramenta (`@addons/addon-server`) que permite que qualquer desenvolvedor suba um servidor de add-on em minutos, comunicando-se perfeitamente com o nosso aplicativo via internet (HTTP).
* **Resultados Mágicos:** Implementamos add-ons reais que buscam dados em APIs públicas (como bibliotecas de poemas ou citações). O aplicativo pede a lista de poemas para o add-on remoto, o add-on vai até a base de dados, processa e devolve tudo formatado para a tela do usuário.

Hoje, nossa prova de conceito conta com dezenas de testes passando perfeitamente. O que começou como uma tentativa de limpar um código espaguete, se tornou uma plataforma descentralizada, extensível e pronta para o futuro.
