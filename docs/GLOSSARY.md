# Glossário

**Status: Planejado**

---

| Termo | Definição |
|-------|-----------|
| **Add-on** | Módulo JavaScript independente que implementa um ou mais serviços e se registra num host via manifesto |
| **AddonInstance** | Representação de um add-on carregado no host, com status, manifesto, e lista de serviços |
| **AddonLoader** | Classe responsável por baixar manifesto, importar bundle, e chamar setup do add-on |
| **Bundle** | Arquivo JavaScript compilado (ESM) que contém o código do add-on |
| **Entrypoint** | URL do bundle JavaScript que o host carrega via `import()` |
| **ESM** | ECMAScript Module — formato nativo de módulos do JavaScript moderno |
| **Fallback** | Mecanismo onde, se um serviço falha, o sistema tenta automaticamente a próxima implementação disponível |
| **Host** | Aplicação que carrega e gerencia add-ons, provê o HostAPI, e consome os serviços registrados |
| **HostAPI** | Interface que o host expõe para o add-on no momento do setup. Contém registry, onUnload, e log |
| **Identidade** | No contexto deste projeto, a URL do manifesto é a identidade única do add-on |
| **Loader** | Veja AddonLoader |
| **Manifesto** | Arquivo JSON que declara a identidade, metadados, entrypoint, e serviços de um add-on |
| **Prioridade** | Número que determina a ordem de resolução de serviços. Maior prioridade = mais preferido |
| **Registry** | Veja ServiceRegistry |
| **ServiceEntry** | Registro individual de um serviço no registry, contendo instância, addonId, e prioridade |
| **ServiceRegistration** | Declaração de um serviço no manifesto: id, version, name, description |
| **ServiceRegistry** | Mapa central que armazena implementações de serviços indexadas por serviceId |
| **Serviço** | Unidade funcional que um add-on oferece. Identificado por um serviceId único |
| **Setup** | Função que o host chama para ativar o add-on, passando o HostAPI. É onde o add-on registra seus serviços |
| **URL** | No contexto deste projeto, URL do manifesto = identidade do add-on |
| **Validação** | Processo de verificar se um manifesto é estruturalmente e semanticamente válido |