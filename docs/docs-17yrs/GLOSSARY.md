# Glossário — O Dicionário do Projeto

*Cada termo que você precisa saber, explicado em uma frase.*

---

| Termo | Definição |
|-------|-----------|
| **Add-on** | Um pedaço de código independente que oferece serviços pra um aplicativo host. Tipo um plugin, mas mais solto. |
| **AddonInstance** | A representação de um add-on dentro do host depois que ele foi carregado. Tem o manifesto, o status (loading/ready/error), e a lista de serviços. |
| **AddonLoader** | O "motor de carregamento". Ele baixa o manifesto, importa o JavaScript, chama o setup, e devolve um AddonInstance pronto. |
| **Bundle** | O arquivo JavaScript final que o add-on vira depois de compilado. É o que o host importa com `import()`. |
| **Entrypoint** | A URL do bundle. O host faz `import(entrypoint)` pra carregar o add-on de verdade. |
| **ESM** | ECMAScript Module. É o formato de módulo que o JavaScript moderno usa nativamente. O navegador entende sem precisar de biblioteca extra. |
| **Fallback** | Plano B. Se o serviço principal falhar, o sistema tenta o próximo automaticamente. É tipo "se o YouTube cair, tenta o Vimeo". |
| **Host** | O aplicativo principal que carrega os add-ons. Ele fornece o HostAPI e consome os serviços registrados. |
| **HostAPI** | A "caixa de ferramentas" que o host dá pro add-on no momento do setup. Tem o registry, o onUnload, e o log. |
| **Identidade** | O que identifica um add-on de forma única. Neste projeto, a URL do manifesto é a identidade. |
| **Loader** | Outro nome pro AddonLoader. |
| **Manifesto** | O cartão de visita do add-on. Um arquivo JSON com nome, versão, entrypoint, e lista de serviços. |
| **Prioridade** | Um número que define a ordem de preferência entre serviços. Maior número = mais importante. |
| **Registry** | Outro nome pro ServiceRegistry. |
| **ServiceEntry** | Um registro individual dentro do ServiceRegistry. Contém a implementação do serviço, o addonId de origem, e a prioridade. |
| **ServiceRegistration** | A declaração de um serviço dentro do manifesto. Diz o id, a versão, o nome, e a descrição. |
| **ServiceRegistry** | O mapa central que guarda todos os serviços registrados pelos add-ons. É o coração do sistema. |
| **Serviço** | Uma funcionalidade que um add-on oferece. Exemplo: um serviço de saudação, um serviço de contagem. |
| **Setup** | A função que o add-on exporta e que o host chama pra ativar ele. É dentro do setup que o add-on registra os serviços. |
| **URL** | A URL do manifesto. É a identidade do add-on. |
| **Validação** | O processo de verificar se um manifesto é válido antes de carregar o add-on. |