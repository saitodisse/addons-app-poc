# Glossário

Este glossário traduz os nomes técnicos usados no projeto. Leia a definição curta primeiro; a segunda frase aprofunda quando necessário.

| Termo | Definição progressiva |
|---|---|
| **Adaptador** | Código que conecta uma regra abstrata a uma tecnologia concreta. `HttpTextAddonClient`, por exemplo, implementa uma porta usando `fetch`. |
| **Add-on** | Extensão independente que oferece uma capacidade ao host. Pode ser um módulo executado no host ou um servidor consultado por HTTP. |
| **AddonInstance** | Registro do resultado de um carregamento. Contém manifesto, URL de identidade, estado, erro opcional e serviços anunciados como carregados. |
| **AddonLoader** | Componente que transforma a URL de um manifesto em uma `AddonInstance`. `FetchAddonLoader` busca, valida, importa e inicializa add-ons em processo. |
| **API** | Contrato usado por dois componentes para conversar. Neste projeto, pode ser uma interface TypeScript ou um conjunto de rotas HTTP. |
| **Bundle** | Arquivo JavaScript pronto para execução. O loader importa o bundle ESM indicado por `entrypoint`. |
| **Catálogo** | Coleção navegável anunciada por um add-on HTTP. A rota de catálogo devolve itens no campo `metas`. |
| **Composição de serviços** | Construção de um serviço a partir de outros serviços do registro. Favoritos, por exemplo, consome `bookmarkStore` sem importar o host. |
| **CORS** | Regra do navegador para requisições entre origens diferentes. Os servidores locais liberam CORS para que o host na porta `5280` consulte as portas `5291` a `5294`. |
| **Domínio** | Parte que contém as regras centrais do problema. O diretório `domain/` evita dependências de React, rede e armazenamento concreto. |
| **Endpoint** | Combinação de método e rota de uma API HTTP. `GET /manifest.json` é um endpoint. |
| **Entrypoint** | URL do bundle ESM de um add-on em processo. É usada pelo `FetchAddonLoader` com `import()`. |
| **ESM** | Formato moderno de módulos JavaScript, abreviação de ECMAScript Modules. Usa `import` e `export`. |
| **Fallback** | Tentativa automática de uma alternativa após uma falha. `withFallback` percorre serviços pela ordem de prioridade. |
| **Formato HTTP** | Add-on executado como servidor independente. Declara `resources` e responde a rotas previsíveis. |
| **Formato em processo** | Add-on executado no mesmo processo JavaScript do host. Declara `services`, aponta um `entrypoint` e exporta `setup`. |
| **Handler** | Função que responde a uma operação do servidor. O `addon-server` recebe handlers de catálogo, busca, texto e conteúdo. |
| **Host** | Aplicativo anfitrião que ativa add-ons e usa seus serviços. A demonstração atual é o pacote `@addons/host-app`. |
| **HostAPI** | Pequena API entregue ao add-on durante o `setup`. Expõe registro, consulta de serviços, descarregamento futuro e logs. |
| **Identidade** | Valor usado para dizer se duas referências apontam para o mesmo add-on. Neste protocolo, é a URL completa do manifesto. |
| **Lazy loading** | Carregamento feito apenas quando necessário. O host baixa o texto completo somente depois que o usuário abre um resultado. |
| **Manifesto** | Documento que apresenta um add-on antes de seu uso. Declara metadados e capacidades em formato compatível com JSON. |
| **Metas** | Lista de metadados devolvida por catálogo e busca. Cada item contém pelo menos `id`, `type` e `name`. |
| **Porta** | Interface que descreve uma necessidade do núcleo. Não confundir com porta TCP, como `5291`. |
| **Prioridade** | Número que ordena implementações do mesmo serviço. Quanto maior o número, mais cedo ela será consultada. |
| **Processamento externo** | Trabalho que um add-on delega a outra API. Os add-ons de poemas e Wikipédia transformam respostas públicas no contrato desta POC. |
| **POC** | Prova de conceito. É um experimento para validar uma ideia, não uma promessa de prontidão para produção. |
| **Recurso** | Capacidade declarada por um add-on HTTP, como `catalog`, `search` ou `text`. Cada recurso corresponde a uma família de rotas. |
| **Registry** | Forma curta de `ServiceRegistry`. É o ponto de encontro entre quem oferece e quem usa serviços. |
| **Sandbox** | Ambiente isolado que limita o que um código pode acessar. Ainda não existe para os add-ons em processo desta POC. |
| **SemVer** | Convenção de versão no formato principal, secundária e correção, como `2.4.1`. O validador atual aceita apenas a forma numérica simples `X.Y.Z`. |
| **ServiceEntry** | Entrada interna do registro. Guarda identificador do serviço, implementação, origem e prioridade. |
| **ServiceRegistration** | Declaração de um serviço no manifesto. Contém `id`, `version`, `name` e `description`. |
| **ServiceRegistry** | Estrutura que guarda implementações por identificador. Oferece registro, consulta, ordenação e limpeza, mas não executa fallback sozinho. |
| **Serviço** | Capacidade oferecida por um add-on ou pelo host. `greeter`, `favorites` e `bookmarkStore` são exemplos. |
| **Setup** | Função que ativa um add-on em processo. Recebe `HostAPI` e normalmente registra uma ou mais implementações. |
| **Texts** | Lista de opções de conteúdo devolvida pelo recurso `text`. Cada item informa `id`, `url`, `lang` e `name`. |
| **Validação** | Verificação estrutural feita antes do consumo. Ela reduz entradas inválidas, mas não prova segurança, disponibilidade ou veracidade. |
