# Glossário — O Dicionário do Projeto

*Cada termo que você precisa saber, explicado em uma frase.*

---

| Termo | Definição |
|-------|-----------|
| **Add-on** | Um pedaço de código independente que oferece serviços pra um aplicativo host. Tipo um plugin, mas mais solto. |
| **AddonInstance** | A representação de um add-on dentro do host depois que ele foi carregado. Tem o manifesto, o status (loading/ready/error), e a lista de serviços. |
| **AddonLoader** | O "motor de carregamento". Ele baixa o manifesto, importa o JavaScript, chama o setup, e devolve um AddonInstance pronto. |
| **API pública** | Uma API na internet que qualquer pessoa pode usar de graça, sem cadastro. Ex.: DummyJSON (citações) e PoetryDB (poemas). |
| **Bundle** | O arquivo JavaScript final que o add-on vira depois de compilado. É o que o host importa com `import()`. |
| **Catálogo** | Uma lista de itens que o add-on anuncia no manifesto (ex.: "Textos em Destaque"). O usuário navega os catálogos pra achar conteúdo. |
| **CORS** | Uma regra dos navegadores que decide se um site pode chamar outro. Os servidores de add-on liberam CORS pra o app principal poder falar com eles. |
| **Endpoint** | Uma "porta" do servidor do add-on. Ex.: `GET /catalog/text/destaques.json`. Cada rota responde com um JSON. |
| **Entrypoint** | A URL do bundle. O host faz `import(entrypoint)` pra carregar o add-on de verdade. |
| **ESM** | ECMAScript Module. É o formato de módulo que o JavaScript moderno usa nativamente. O navegador entende sem precisar de biblioteca extra. |
| **Fallback** | Plano B. Se o serviço principal falhar, o sistema tenta o próximo automaticamente. É tipo "se o YouTube cair, tenta o Vimeo". |
| **Formato Stremio** | Um segundo jeito de fazer add-on: o add-on é um servidor na internet que declara `resources` e responde em rotas estilo Stremio. Referência: o add-on Torrentio. |
| **Handler** | Uma função que o add-on de texto implementa (catalog, search, text, content). O mini-servidor transforma cada uma numa rota HTTP. |
| **Host** | O aplicativo principal que carrega os add-ons. Ele fornece o HostAPI e consome os serviços registrados. |
| **HostAPI** | A "caixa de ferramentas" que o host dá pro add-on no momento do setup. Tem o registry, o onUnload, e o log. |
| **Identidade** | O que identifica um add-on de forma única. Neste projeto, a URL do manifesto é a identidade. |
| **Loader** | Outro nome pro AddonLoader. |
| **Manifesto** | O cartão de visita do add-on. Um arquivo JSON com nome, versão, entrypoint (ou resources), e lista de serviços. |
| **Metas** | O formato de resposta dos recursos catalog e search: `{ metas: [{ id, type, name, ... }] }`. É assim que o Stremio lista conteúdo. |
| **Prioridade** | Um número que define a ordem de preferência entre serviços. Maior número = mais importante. |
| **Processamento externo** | Quando o add-on busca dados em APIs públicas na internet — igual o Torrentio busca em indexadores de torrent. |
| **Registry** | Outro nome pro ServiceRegistry. |
| **Resource** | Um recurso declarado no manifesto estilo Stremio: `catalog`, `search`, `text`, `meta`, `subtitles`, `stream`. |
| **ServiceEntry** | Um registro individual dentro do ServiceRegistry. Contém a implementação do serviço, o addonId de origem, e a prioridade. |
| **ServiceRegistration** | A declaração de um serviço dentro do manifesto. Diz o id, a versão, o nome, e a descrição. |
| **ServiceRegistry** | O mapa central que guarda todos os serviços registrados pelos add-ons. É o coração do sistema. |
| **Serviço** | Uma funcionalidade que um add-on oferece. Exemplo: um serviço de saudação, um serviço de contagem. |
| **Setup** | A função que o add-on exporta e que o host chama pra ativar ele. É dentro do setup que o add-on registra os serviços. |
| **Texts** | O formato de resposta do recurso text: `{ texts: [{ id, url, lang, name }] }`. É igual ao formato de legendas do Stremio — a `url` aponta pro conteúdo. |
| **URL** | A URL do manifesto. É a identidade do add-on. |
| **Validação** | O processo de verificar se um manifesto é válido antes de carregar o add-on. |