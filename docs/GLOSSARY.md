# Glossário

**Status: Planejado**

---

| Termo | Definição |
|-------|-----------|
| **Add-on** | Módulo JavaScript independente que implementa um ou mais serviços e se registra num host via manifesto |
| **AddonInstance** | Representação de um add-on carregado no host, com status, manifesto, e lista de serviços |
| **AddonLoader** | Classe responsável por baixar manifesto, importar bundle, e chamar setup do add-on |
| **Bundle** | Arquivo JavaScript compilado (ESM) que contém o código do add-on |
| **Catálogo** | Lista anunciada no manifesto (`catalogs[]`) que o host pode navegar via recurso `catalog` |
| **CORS** | Cross-Origin Resource Sharing — mecanismo que permite o host (porta 5280) chamar os servidores dos add-ons (5291–5293) no navegador |
| **Entrypoint** | URL do bundle JavaScript que o host carrega via `import()` (formato em-processo) |
| **ESM** | ECMAScript Module — formato nativo de módulos do JavaScript moderno |
| **Fallback** | Mecanismo onde, se um serviço falha, o sistema tenta automaticamente a próxima implementação disponível |
| **Formato Stremio** | Segundo formato de add-on: um servidor HTTP que declara `resources` e responde em `/<resource>/<type>/<id>.json`. Referência: Torrentio no Stremio |
| **Handlers** | Funções que um add-on de texto implementa (`catalog`, `search`, `text`, `content`) e que o `@addons/addon-server` expõe como endpoints HTTP |
| **Host** | Aplicação que carrega e gerencia add-ons, provê o HostAPI, e consome os serviços registrados |
| **HostAPI** | Interface que o host expõe para o add-on no momento do setup. Contém registry, onUnload, e log |
| **Identidade** | No contexto deste projeto, a URL do manifesto é a identidade única do add-on |
| **Loader** | Veja AddonLoader |
| **Manifesto** | Arquivo JSON que declara a identidade, metadados, entrypoint, e serviços de um add-on |
| **Metas** | Formato de resposta dos recursos `catalog` e `search` do Stremio: `{ metas: [{ id, type, name, ... }] }` |
| **Prioridade** | Número que determina a ordem de resolução de serviços. Maior prioridade = mais preferido |
| **Processamento externo** | Quando um add-on busca dados de APIs públicas na web (ex.: PoetryDB, DummyJSON) — análogo ao Torrentio buscando em indexadores de torrent |
| **Registry** | Veja ServiceRegistry |
| **Resource** | Recurso declarado no manifesto Stremio: `catalog`, `search`, `text`, `meta`, `subtitles`, `stream` |
| **ServiceEntry** | Registro individual de um serviço no registry, contendo instância, addonId, e prioridade |
| **ServiceRegistration** | Declaração de um serviço no manifesto: id, version, name, description |
| **ServiceRegistry** | Mapa central que armazena implementações de serviços indexadas por serviceId |
| **Serviço** | Unidade funcional que um add-on oferece. Identificado por um serviceId único |
| **Setup** | Função que o host chama para ativar o add-on, passando o HostAPI. É onde o add-on registra seus serviços |
| **Texts** | Formato de resposta do recurso `text` (espelha `subtitles` do Stremio): `{ texts: [{ id, url, lang, name }] }` — a `url` aponta para o conteúdo em texto puro |
| **Meta-search / Agregador** | Serviço `searchProvider` do addon-aggregator: consulta vários add-ons de texto remotos em paralelo e mescla os resultados, tolerando falhas individuais |
| **textFormatter** | Serviço do addon-markdown que converte título+conteúdo em Markdown e HTML |
| **bookmarkStore** | Serviço de infraestrutura registrado pelo host (ex.: `LocalStorageBookmarkStore`) que o addon-favorites consome para persistir marcadores |
| **Composição de serviços** | Quando um add-on consome serviços de outros add-ons ou do host via `host.services.get(...)` — ex.: aggregator buscando em add-ons remotos, favorites usando `bookmarkStore` |
| **healthCheck** | Serviço do addon-health que verifica disponibilidade e latência dos add-ons de texto remotos (busca o manifesto e mede o tempo de resposta) |
| **URL** | No contexto deste projeto, URL do manifesto = identidade do add-on |
| **Validação** | Processo de verificar se um manifesto é estruturalmente e semanticamente válido |