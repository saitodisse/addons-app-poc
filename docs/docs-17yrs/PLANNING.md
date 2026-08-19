# Planejamento — A História Completa

*Como a gente chegou na ideia de criar esse projeto?*

---

## Capítulo 1: O Problema Original

Tudo começou num repositório chamado **AC**. Era um conjunto de projetos de música — cifras, tablaturas, visualização de acordes. Tinha vários pacotes:

- `musical-domain` — os tipos fundamentais (notas, acordes, escalas)
- `tab-renderer` — renderizador de tablaturas
- `svguitar-react` — diagramas de braço de guitarra
- `source-catalog` — catálogo de músicas
- E mais uns tantos

O problema é que esses pacotes dependiam uns dos outros **diretamente**. O `tab-renderer` importava o `musical-domain` no código. O `svguitar-react` também importava o `musical-domain`. Se você quisesse trocar o `svguitar-react` por outro renderizador, precisava mudar o código e rebuildar tudo.

A pergunta era: **como deixar esses pacotes intercambiáveis sem precisar recompilar?**

---

## Capítulo 2: A Descoberta do Cordis

Alguém mencionou o **Cordis** — um framework que o DeepSeek Harness usa. O Cordis permite que plugins se registrem por nome, declarem dependências, e sejam montados como peças de Lego via arquivos de configuração.

A ideia era: "e se a gente usasse o Cordis pra ligar os pacotes do AC?"

Só que o Cordis é um framework complexo. Ele foi feito pra um sistema específico. Usar ele no AC seria como trocar o motor de um carro pra resolver um barulho no porta-malas.

Mas o insight foi importante: **o padrão de registro de serviços é o caminho certo**. Não precisava do Cordis. Precisava do *conceito* que ele representava.

---

## Capítulo 3: O Stremio Entra na Sala

Foi quando alguém disse: "Isso não seria algo como os add-ons do Stremio?"

Se você não conhece o Stremio: é um aplicativo que todo mundo usa pra assistir filmes e séries. O Stremio em si é **completamente legal**. Ele tá na Google Play, na Apple Store, na loja da Samsung. Ele só mostra capas, sinopses, e trailers.

A mágica acontece nos **add-ons**. Você instala o Torrentio, e de repente o Stremio "descobre" links pra assistir os filmes. O Torrentio não é do Stremio. Foi feito por um desenvolvedor independente. O Stremio só fornece o palco.

E aí veio o estalo: **o AC precisava desse mesmo modelo**.

---

## Capítulo 4: A Arquitetura Indestrutível do Stremio

O Stremio não é bom porque tem muitos filmes. Ele é bom porque é **indestrutível**. Vamos ver as camadas:

### Camada 1: O Player
O aplicativo em si. O código é aberto. Se a empresa do Stremio fechar, qualquer um pode compilar e continuar usando.

### Camada 2: Os Add-ons
Torrentio, KnightCrawler, Annatar. São scripts rodando em servidores gratuitos (Cloudflare Workers, Vercel). Se um cair, outro aparece. Se derrubarem o Torrentio, no dia seguinte tem três alternativas.

### Camada 3: O Cache
Serviços como Real-Debrid que baixam os arquivos e servem via HTTPS. Rápido, seguro, e substituível.

### Camada 4: O Armazenamento Distribuído
A rede BitTorrent + DHT. Milhões de computadores ao redor do mundo compartilhando arquivos. Não tem um servidor central pra derrubar.

O que torna isso indestrutível? **Cada camada é independente.** Você pode derrubar qualquer uma que as outras continuam funcionando.

---

## Capítulo 5: Como o AC se Parece com o Stremio

A gente mapeou cada camada do Stremio pro AC:

| Stremio | AC |
|---------|-----|
| Player | Os portais web (catalog-portal, ac15-web) |
| Catálogo IMDb | Os tipos do `@achorde/musical-domain` |
| Add-ons (Torrentio) | Renderizadores, editores, provedores de catálogo |
| Cache (Real-Debrid) | Cache local (IndexedDB, Dexie) |
| DHT (rede distribuída) | Sync-engine (sincronização entre dispositivos) |

O AC já tinha todas as peças. Só não tinha o **sistema de add-ons** pra ligar elas.

---

## Capítulo 6: Três Coisas que DI Não Faz

A gente percebeu que o que o AC precisava não era um sistema de injeção de dependência mais bonito. Era um **sistema de add-ons** de verdade. A diferença?

1. **Descoberta**: num sistema de DI, você precisa importar o pacote no código. Num sistema de add-ons, o add-on se anuncia via manifesto. O host descobre ele sem saber que ele existe.
2. **Isolamento**: num sistema de DI, se um serviço quebra, o que chama ele quebra junto. Num sistema de add-ons, o erro fica isolado no add-on. O host não sente.
3. **Escolha do usuário**: num sistema de DI, o desenvolvedor decide qual implementação usar. Num sistema de add-ons, o usuário decide qual instalar, qual ativar, qual priorizar.

---

## Capítulo 7: As Cinco Famílias de Add-ons

A gente identificou cinco áreas onde add-ons fariam sentido no AC:

1. **Renderização de diagramas** — SVGuitar, tab-renderer, visualização 3D, versão simplificada
2. **Editores** — editor de texto, editor visual, Monaco, drag-and-drop
3. **Provedores de catálogo** — busca local, busca remota, contribution-protocol, arquivo
4. **Mecanismos de busca** — por artista, por tom, por dificuldade, difusa
5. **Armazenamento** — IndexedDB, SQLite, API remota, IPFS

Cada uma seria uma **interface TypeScript**. Qualquer add-on que implementasse a interface poderia ser ligado.

---

## Capítulo 8: O Cenário do Joaquim

Pra ficar mais concreto, a gente imaginou o **Joaquim**:

> Joaquim é um desenvolvedor que toca violão. Ele criou um algoritmo novo de visualização de acordes em 3D usando Three.js. Ele quer disponibilizar isso pra comunidade AC.

No modelo antigo, Joaquim precisaria:
1. Fazer um fork do repositório AC
2. Implementar a visualização
3. Abrir um pull request
4. Esperar alguém aprovar
5. Esperar o próximo release

No modelo novo, Joaquim:
1. Cria um pacote que depende só de `@achorde/musical-domain`
2. Implementa a interface `ChordDiagramRenderer`
3. Publica o manifesto num GitHub Pages
4. Publica o bundle num CDN
5. Avisa no fórum

Um usuário cola a URL, e pronto. Joaquim não pediu permissão de ninguém.

---

## Capítulo 9: A Decisão de Criar um POC

Depois de toda essa discussão, a gente decidiu: **não vamos tentar implementar isso dentro do AC agora**. Vamos criar um projeto separado, pequeno, que teste se a ideia funciona.

Nasceu o `addons-app-poc`.

---

## Capítulo 10: O Grilling

Antes de começar a programar, a gente fez 13 perguntas sobre cada detalhe do design. Tipo:

- "Como o add-on é identificado?"
- "O que acontece se ele quebrar?"
- "Qual o formato do manifesto?"

Cada pergunta foi discutida e respondida. As respostas viraram as regras do projeto. (Tá tudo detalhado no `RESUMO-PLANO.md`.)

---

## Capítulo 11: O Que Vem Depois

Agora a documentação tá pronta. A fase 1 de implementação (o núcleo do protocolo) é a próxima. Depois a gente adiciona fallback, descoberta remota, e isolamento.

Cada fase é funcional por si só. No final da fase 1, já dá pra abrir o navegador e ver add-ons sendo carregados.

---

*Essa é a história de como a gente chegou aqui. O próximo capítulo é escrito com código.*