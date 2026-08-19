# O Mapa da Jornada: Fases do Projeto

*Como construímos um sistema complexo sem perder a sanidade? Um passo de cada vez. Enxergue cada fase deste projeto como um degrau de uma escada. Ao final de cada etapa, não temos apenas um pedaço de código solto, mas um sistema vivo, funcional e pronto para entregar valor.*

---

## Fase 1 — O Alicerce (Entregue ✅)

**O Problema:** Antes de criarmos extensões mirabolantes que buscam dados na internet, precisamos de um chão firme. Precisamos de um aplicativo capaz de carregar e gerenciar extensões (add-ons) de forma segura e organizada.
**O Objetivo:** Criar o "núcleo" do sistema, focado puramente em carregar e registrar add-ons simples.

### Como nós construímos isso:

**1. A Arquitetura Central (`@addons/core`)**
Criamos o cérebro do sistema totalmente isolado do mundo exterior.

* **O Domínio (`domain/`):** As regras puras. Aqui definimos os formatos de identidade (Manifestos), o estado de um add-on carregado (Instância) e, claro, o nosso famoso intermediário, o `ServiceRegistry`.
* **As Portas (`ports/`):** Os "contratos". Onde o sistema diz: *"Preciso de algo que baixe arquivos e algo que anote logs"*.
* **Os Adaptadores (`adapters/`):** As implementações reais dessas portas, como o `FetchAddonLoader` (que baixa arquivos da web) e o `ConsoleLogger`.

**2. A Prova de Fogo (Testes e Exemplos)**

* **Testes do Core:** Garantimos que a lógica pura funciona com dezenas de testes unitários rápidos, sem depender de internet.
* **Add-ons Pioneiros:** Criamos o `addon-hello` (um serviço simples de saudação) e o `addon-counter` (um contador interativo) para provar que a teoria funciona na prática.

**3. O Aplicativo Anfitrião (Host App)**
A interface final que junta tudo. Ele liga o registro, baixa os add-ons de exemplo, exibe uma lista bonita na tela e permite que você clique e teste os serviços rodando ao vivo.

---

## Fase 2 — O Plano B Automático (Entregue ✅)

**O Problema:** No mundo real, coisas quebram. Se o Host tentar usar um serviço que falhou ou sumiu, o aplicativo inteiro não pode travar. Precisamos de redundância.
**O Objetivo:** Implementar um sistema inteligente de *Fallback* (Plano B) e refinar a forma como o Host conversa com os serviços.

### Como nós construímos isso:

* **Comunicação Tipada:** Em vez do Host pedir um serviço às cegas, agora ele usa TypeScript para garantir que o serviço devolvido tenha o formato exato esperado (ex: `registry.get<Greeter>("greeter")`).
* **Fallback Invisível (`withFallback`):** Se o serviço principal falhar no meio do trabalho, o sistema intercepta o erro e tenta o próximo serviço da fila automaticamente. O usuário nem percebe o tropeço.
* **A Batalha das Prioridades:** Criamos um novo add-on (`addon-hello-pt`) que faz a mesma coisa que o saudador original, mas com uma **prioridade maior** (10 contra 0). O sistema é inteligente o suficiente para trocar de implementação sozinho, escolhendo sempre a melhor opção disponível.
* **Rede de Segurança:** Se *todos* os serviços de uma fila falharem, o sistema coleta todos os erros em um único pacote (`AggregateFallbackError`) para facilitar a investigação.

---

## Fase 3 — A Revolução dos Servidores (Entregue ✅)

**O Problema:** Até agora, todo add-on precisava ser baixado para dentro do aplicativo. Isso limita o tamanho deles e dificulta atualizações. E se os add-ons pudessem morar na nuvem, sendo mantidos por outras pessoas?
**O Objetivo:** Permitir que add-ons funcionem como servidores HTTP independentes (inspirado na brilhante arquitetura do Stremio e seu add-on Torrentio).

### Como nós construímos isso:

**1. O Novo Modelo Stremio**
O manifesto do add-on evoluiu. Agora, ele pode declarar que possui catálogos, sistemas de busca e entrega de conteúdo (`resources`, `types`, `catalogs`). O Host não baixa mais o código do add-on, ele apenas conversa com o servidor dele.

**2. As Novas "Portas" de Comunicação**
O add-on agora é um servidor de internet que responde a perguntas específicas (endpoints):

| Pergunta (Endpoint) | O que o Host quer saber? |
| --- | --- |
| `GET /manifest.json` | *"Quem é você e o que você oferece?"* |
| `GET /catalog/<tipo>/<id>.json` | *"Me mostre a lista de itens deste catálogo."* |
| `GET /search/<tipo>/<busca>.json` | *"Tem algo relacionado a essa palavra?"* |
| `GET /text/<tipo>/<id>.json` | *"Quais versões deste texto você tem?"* |

**3. Carregamento Preguiçoso (Lazy Loading)**
Copiamos o jeito que o Stremio lida com legendas de filmes. O add-on não envia um livro inteiro pela internet. Ele envia apenas um "link" (`{ url: "..." }`). O aplicativo só baixa o conteúdo de verdade (`content.txt`) se o usuário clicar para ler.

**4. Integração com o Mundo Real**
Criamos três servidores independentes na nossa máquina para provar o conceito:

* **Biblioteca:** Textos guardados no próprio servidor.
* **Citações:** Busca frases inspiradoras conversando com uma API externa (`DummyJSON`).
* **Poemas:** Busca poemas reais em uma base de dados pública na internet (`PoetryDB`).

*(Nota: Na próxima iteração desta fase, implementaremos o cache do manifesto para economizar banda e a negociação de versões entre Host e Add-on).*

---

## Fase 4 — Blindagem Total (Planejado 🚧)

**O Problema:** Mesmo com o *Fallback*, um add-on que roda código malicioso ou incrivelmente pesado dentro do aplicativo ainda pode causar lentidão ou problemas de segurança.
**O Objetivo:** Isolar os add-ons completamente. Nenhum add-on, sob nenhuma circunstância, pode derrubar o Host.

### O que vamos construir:

* **Zonas de Quarentena (Error Boundaries):** Um isolamento visual e lógico no React. Se a interface de um add-on quebrar, apenas a "caixinha" dele na tela fica vermelha, o resto do app segue intacto.
* **Controle nas Mãos do Usuário:** Uma tela de configurações onde o usuário poderá ligar/desligar add-ons com um clique, reordenar prioridades arrastando os itens, e salvar essas preferências.
* **Pesquisa de Sandboxing:** Vamos investigar a fundo se devemos colocar os add-ons para rodar dentro de `Web Workers` (threads separadas) ou `Iframes`, garantindo que eles se comuniquem com o Host apenas através de mensagens restritas, sem acesso ao coração do sistema.

---

## O Resumo da Ópera

Veja onde estamos agora. Cada bloco concluído é um sistema que já funciona sozinho e gera valor:

```text
Fase 1: [████████████████░░] 80% — O alicerce e o núcleo funcionando.
Fase 2: [████████████████░░] 80% — Plano B e trocas automáticas perfeitas.
Fase 3: [████████████████░░] 80% — Add-ons morando na nuvem e buscando dados.
Fase 4: [░░░░░░░░░░░░░░░░░░] 0%  — A blindagem final do sistema.

```
