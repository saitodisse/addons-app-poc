# Resumo do Plano — As 13 Decisões Explicadas Passo a Passo

*Um guia para entender cada escolha que fizemos, do jeito mais simples possível.*

---

## Antes de começar

Imagina que você vai construir um sistema de add-ons do zero. Você tem que responder várias perguntas:

- Como um add-on se identifica?
- O que ele precisa ter pra funcionar?
- O que o app principal precisa dar pra ele?
- E se um add-on quebrar?

Cada pergunta desse resumo foi uma escolha que a gente fez. Aqui está cada uma, explicada.

---

## 1. A URL é o RG do Add-on

### O problema

Um add-on precisa ser identificado de alguma forma. Se dois add-ons diferentes tiverem o mesmo nome, como o sistema sabe qual é qual?

### As opções que a gente considerou

- **Nome simples**: tipo `"hello"`, `"counter"`. Fácil, mas se dois criadores chamarem de "hello", vira bagunça.
- **Nome com namespace**: tipo `"@joaquim/hello"`, `"@maria/counter"`. Estilo npm. Resolve colisão, mas você precisa garantir que o namespace é seu.
- **URL como identidade**: a URL do manifesto é o que identifica o add-on. Se o manifesto tá em `https://exemplo.com/addons/legal/manifest.json`, aquela URL é a identidade.

### O que a gente escolheu

**A URL é a identidade.** Ponto final.

### Por quê?

Porque URL é única por natureza. Não tem como duas URLs serem iguais. E isso resolve vários problemas de uma vez:

- **Não precisa de sistema de cadastro**: não tem um "banco central" que precisa aprovar seu nome
- **Não precisa de namespace**: a URL já é o namespace
- **Mobilidade**: se você mudar o add-on de lugar, a URL muda, e a identidade muda junto

### Exemplo na vida real

No Stremio, quando você instala o Torrentio, você cola a URL. O Stremio não pergunta "qual é o nome do seu add-on". Ele usa a URL como identidade. Se você quiser instalar outro add-on que também se chama "Torrentio" mas tá numa URL diferente, pode — os dois coexistem.

### Como isso funciona no código

O host guarda o add-on assim:

```
AddonInstance {
  manifestUrl: "https://exemplo.com/addons/legal/manifest.json"
  manifest: { ... }
  status: "ready"
}
```

A `manifestUrl` é a chave. Não o `id` dentro do manifesto. O `id` vira só um campo de exibição — um nome bonito pra mostrar pro usuário.

---

## 2. O Add-on é um Módulo com Duas Partes

### O problema

O host precisa saber o que o add-on oferece antes de executar ele. Mas como? Se o host executar o add-on pra descobrir, e o add-on tiver um vírus, já era.

### A solução

O add-on exporta **duas coisas separadas**:

1. **`manifest`** — um objeto com os dados do add-on. É o "cartão de visita". O host lê isso **sem executar o add-on**.
2. **`setup`** — uma função que o host chama pra ativar o add-on. É aqui que o add-on realmente faz alguma coisa.

### Por que separado?

Porque o manifesto é **dados**, não código. Dados não explodem. Dados não apagam seus arquivos. Dados não abrem conexões suspeitas. O host pode ler, validar, e decidir se confia antes de chamar o `setup`.

### O que acontece em ordem

```
1. Host descobre a URL do manifesto
2. Host faz fetch do manifesto (JSON puro, seguro)
3. Host valida o manifesto (tem todos os campos? A versão é compatível?)
4. Se tudo ok, host faz import() do bundle (código JavaScript)
5. Host chama setup(hostAPI) — agora sim o add-on roda
```

### Exemplo visual

```javascript
// O que o add-on exporta:

export const manifest = {
  id: "hello",
  name: "Hello Add-on",
  version: "1.0.0",
  entrypoint: "https://exemplo.com/hello/bundle.js",
  services: [{ id: "greeter", version: "1.0.0", name: "Greeter", description: "Dá bom dia" }]
};

export function setup(host) {
  // Aqui o add-on registra os serviços dele
  host.services.register("greeter", {
    greet: (nome) => `Olá, ${nome}!`
  });
}
```

O host pode ler o `manifest` sem chamar o `setup`. Isso significa que ele pode mostrar pro usuário: "Esse add-on oferece o serviço Greeter. Quer instalar?" antes de executar qualquer código.

---

## 3. O HostAPI é o que o Add-on Pode Usar

### O problema

O add-on precisa de acesso a algumas coisas do host pra funcionar, mas não pode ter acesso a tudo. Se o add-on pudesse acessar o DOM, ele poderia roubar dados. Se pudesse acessar o `window.location`, poderia redirecionar o usuário.

### A solução

O host cria um **"kit de ferramentas"** limitado que o add-on recebe no `setup`. Esse kit se chama `HostAPI`.

### O que o HostAPI tem (na Fase 1)

| Ferramenta | O que faz |
|------------|-----------|
| `services` | O registro. O add-on cadastra os serviços dele aqui |
| `onUnload` | Um gancho pra dizer "quando me desinstalar, faz isso aqui" |
| `log` | Um jeito de escrever mensagens de log (tipo console.log, mas elegante) |

### O que o HostAPI NÃO tem

- Acesso ao DOM (`document`, `window`)
- Acesso ao roteador do host
- Acesso ao sistema de arquivos
- Acesso à rede além do que o navegador já permite

### Por que tão limitado?

Porque segurança. Um add-on que só pode registrar serviços e logar mensagens não consegue fazer muita coisa ruim. Ele consegue fazer o trabalho dele — oferecer um serviço — e só.

### Exemplo

```javascript
export function setup(host) {
  // Pode fazer: registrar serviço
  host.services.register("greeter", { ... });

  // Pode fazer: agendar limpeza
  host.onUnload(() => {
    console.log("Tchau!");
  });

  // Pode fazer: logar
  host.log("info", "Add-on hello carregado com sucesso");

  // NÃO pode fazer: document.body.innerHTML = ""
  // NÃO pode fazer: window.location = "https://malware.com"
}
```

---

## 4. O Registry é o Coração

### O problema

O host precisa de um lugar pra guardar os serviços que os add-ons registram. E precisa de um jeito de encontrar serviços depois.

### A solução

O **ServiceRegistry** é um mapa. Uma gaveta com várias pastas. Cada pasta tem o nome de um serviço (`"greeter"`, `"counter"`, etc.) e dentro dela tem as implementações que os add-ons registraram.

### Como funciona

```
registry = new ServiceRegistry()

// Add-on hello registra:
registry.register("greeter", objetoGreeter, "url-do-hello", 0)

// Add-on hello-pt registra o mesmo serviço com prioridade maior:
registry.register("greeter", objetoGreeterPT, "url-do-hello-pt", 10)

// Host pede o serviço:
registry.get("greeter")
// → retorna o objetoGreeterPT (prioridade 10, maior que 0)

// Host pede todos (pra fallback):
registry.getAll("greeter")
// → retorna [objetoGreeterPT, objetoGreeter] (ordenado por prioridade)
```

### As operações

| Operação | O que faz |
|----------|-----------|
| `register(serviceId, instancia, addonId, prioridade?)` | Guarda um serviço |
| `unregister(serviceId, addonId)` | Remove um serviço específico |
| `get(serviceId)` | Pega o de maior prioridade |
| `getAll(serviceId)` | Pega todos ordenados por prioridade |
| `has(serviceId)` | Pergunta se existe pelo menos um |
| `clear()` | Limpa tudo |
| `clearAddon(addonId)` | Remove tudo de um add-on específico |

### Por que é o coração?

Porque **toda comunicação entre host e add-ons passa por ele**. O host não chama o add-on diretamente. Ele pergunta ao registry "quem implementa isso?" e o registry responde. O add-on não fala com o host diretamente. Ele registra no registry e pronto.

É um intermediário que desacopla todo mundo.

---

## 5. Prioridade Define Quem Ganha

### O problema

Dois add-ons diferentes podem registrar o mesmo serviço. Qual deles o host usa?

### A solução

**Prioridade.** Cada registro tem um número. Quanto maior o número, mais preferência.

### Como funciona

```
Addon A registra "greeter" com prioridade 0
Addon B registra "greeter" com prioridade 10

registry.get("greeter") → retorna o do Addon B
```

O usuário também pode reordenar. A prioridade final é uma combinação do que o add-on declarou + a ordem que o usuário definiu na interface.

### E se o de maior prioridade falhar?

Aí entra o fallback (próximo item dessa lista). O registry tenta o de maior prioridade, se falhar, tenta o próximo, e assim por diante.

### Analogia

É como uma lista de música. Você tem duas versões da mesma música — a original e um remix. A que está no topo da lista toca primeiro. Se o arquivo estiver corrompido, toca a próxima.

---

## 6. Erro no Setup = Add-on Desativado

### O problema

Um add-on começa a carregar, mas o `setup` dele lança um erro. O que acontece? O host inteiro quebra?

### A resposta

**Não.** O host nunca quebra por causa de um add-on.

### O que acontece

1. Host chama `setup(hostAPI)` do add-on
2. Add-on lança uma exceção (qualquer erro)
3. Host captura o erro
4. Host marca o add-on como `"error"` na lista
5. Host **descarta qualquer registro** que o add-on tenha feito antes de quebrar
6. Host loga o erro
7. Host **continua funcionando normalmente**

O usuário vê na lista que o add-on está com erro. Pode tentar recarregar, desinstalar, ou ignorar. O app principal não sente nada.

### Por que descartar os registros parciais?

Porque se o add-on quebrou no meio do setup, ele pode ter registrado só metade dos serviços. Melhor descartar tudo do que ter serviços corrompidos rodando.

---

## 7. Erro no Serviço = Fallback Automático

### O problema

O add-on carregou, registrou o serviço, tudo lindo. Mas quando o host chama o serviço, ele dá erro. E agora?

### A solução

**Fallback automático.** O registry tenta o próximo da lista.

### O que acontece

```
1. Host chama registry.get("greeter")
2. Registry retorna o de maior prioridade (Addon B)
3. Host chama o serviço: greeter.greet("João")
4. O serviço do Addon B lança um erro
5. Registry captura o erro
6. Registry tenta o próximo: Addon A
7. Addon A funciona: "Olá, João!"
8. Host recebe o resultado sem saber que houve falha
```

### O que o host vê

O host vê apenas o resultado. Ele não sabe que o primeiro add-on falhou. Isso é proposital — o host não precisa se preocupar com fallback. O registry cuida disso.

---

## 8. O Manifesto Completo

### O problema

O manifesto precisa ter informações suficientes pro host decidir se carrega o add-on, mas também precisa ter metadados bonitos pra mostrar pro usuário.

### O que o manifesto tem

| Campo | O que é | Exemplo |
|-------|---------|---------|
| `id` | Nome curto pro sistema | `"hello"` |
| `version` | Versão do add-on | `"1.0.0"` |
| `name` | Nome bonito pro usuário | `"Hello Add-on"` |
| `description` | O que ele faz | `"Um add-on que dá bom dia"` |
| `author` | Quem fez | `"Joaquim Silva"` |
| `icon` | URL de um ícone | `"https://.../icon.svg"` |
| `license` | Licença de uso | `"MIT"` |
| `entrypoint` | URL do código JavaScript | `"https://.../bundle.js"` |
| `services` | Lista de serviços | `[{ id: "greeter", ... }]` |

### E cada serviço tem

| Campo | O que é |
|-------|---------|
| `id` | Identificador do serviço, tipo `"greeter"` |
| `version` | Versão da interface do serviço |
| `name` | Nome amigável |
| `description` | O que o serviço faz |

### Por que tantos campos?

Porque o manifesto é também a **fonte de informação pra interface do usuário**. Quando o usuário vai instalar um add-on, ele vê: nome, descrição, autor, ícone, licença. É como a página de um aplicativo na loja. O host precisa de tudo isso pra exibir bonito.

---

## 9. O Bundle é ESM Puro

### O problema

O add-on precisa ser um arquivo JavaScript que o host consiga carregar dinamicamente. Mas JavaScript tem vários formatos. Qual usar?

### A solução

**ESM puro** — ECMAScript Module, o formato de módulo nativo do JavaScript moderno.

### O que isso significa

- O desenvolvedor escreve em TypeScript
- O Vite compila pra um arquivo `.js` no formato ESM
- O host carrega com `import(url)` — nativo no navegador

### Exemplo

```javascript
// O navegador já entende isso nativamente:
const modulo = await import("https://exemplo.com/addons/hello/bundle.js");
// Pronto. O módulo está carregado.
```

### Por que ESM?

- **Nativo**: não precisa de biblioteca extra, não precisa de carregador
- **Moderno**: funciona em todos os navegadores atuais
- **Assíncrono**: não bloqueia a página enquanto carrega
- **Seguro**: roda no mesmo sandbox que qualquer outro script

---

## 10. Add-ons Compartilham o Workspace (na Fase 1)

### O problema

Na Fase 1, os add-ons ainda estão sendo desenvolvidos junto com o host. Como fazer eles se enxergarem sem precisar de build separado?

### A solução

Usar o **workspace do pnpm**. O host e os add-ons estão no mesmo repositório. O Vite resolve os imports entre eles automaticamente.

### Como funciona

```
addons-app-poc/
├── packages/
│   ├── core/           ← @addons/core
│   ├── host-app/       ← @addons/host-app (depende de core)
│   ├── addon-hello/    ← @addons/addon-hello (depende de core)
│   └── addon-counter/  ← @addons/addon-counter (depende de core)
```

O host faz `import("@addons/core")` e o pnpm workspace resolve pro pacote local. O Vite compila tudo junto.

### Isso é temporário

Na Fase 3, os add-ons vão ser carregados de URLs remotas. Aí eles vão precisar ser pré-compilados e publicados em CDNs. Mas na Fase 1, a simplicidade é mais importante.

---

## 11. Testes: Foco no Core

### O problema

O que testar primeiro? Tudo? Só algumas partes?

### A decisão

**Testar o core** (registry, validation, loader). O resto (host app, add-ons) testamos manualmente no navegador.

### Por quê?

- O core é a parte mais crítica. Se ele falhar, tudo falha.
- O core é fácil de testar: registry e validation são funções puras (dado entra, resultado sai).
- O host app e add-ons envolvem UI e navegador, que são mais trabalhosos de testar.

### O que é testado

- **Registry**: registrar, desregistrar, pegar, prioridade, fallback, limpar
- **Validation**: manifesto válido, inválido, campos faltando, url errada
- **Loader**: carregamento com mock, erro de carregamento não quebra o sistema

---

## 12. A Estrutura Final

Depois de todas as decisões, a estrutura do projeto ficou assim:

```
addons-app-poc/                          ← raiz
├── package.json                         ← configuração do workspace
├── pnpm-workspace.yaml                  ← declara os pacotes
├── tsconfig.base.json                   ← configuração do TypeScript
├── README.md                            ← visão geral
├── AGENTS.md                            ← regras pra IA
├── docs/                                ← documentação técnica
│   ├── PLANNING.md                      ← conversa completa
│   ├── PRD.md                           ← requisitos
│   ├── ARCHITECTURE.md                  ← arquitetura
│   ├── MANIFEST-SPEC.md                 ← especificação do manifesto
│   ├── PHASES.md                        ← fases do projeto
│   └── GLOSSARY.md                      ← glossário
├── docs-17yrs/                          ← essa versão jovem da doc
└── packages/
    ├── core/                            ← @addons/core — o protocolo
    │   └── src/
    │       ├── index.ts                 ← re-exporta tudo
    │       ├── manifest.ts              ← tipos do manifesto
    │       ├── registry.ts              ← ServiceRegistry
    │       ├── loader.ts                ← AddonLoader
    │       └── validation.ts            ← validação
    ├── host-app/                        ← @addons/host-app — o app
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx
    │       └── components/
    │           ├── AddonList.tsx         ← mostra add-ons instalados
    │           └── AddonViewer.tsx       ← detalhes de um add-on
    ├── addon-hello/                     ← @addons/addon-hello
    │   └── src/index.ts
    └── addon-counter/                   ← @addons/addon-counter
        └── src/index.ts
```

---

## 13. A Ordem de Implementação

A ordem em que as coisas vão ser construídas:

1. **Tipos do manifesto** (`manifest.ts`) — define as interfaces
2. **Validação** (`validation.ts`) — valida os manifests
3. **Registry** (`registry.ts`) — o coração do sistema
4. **Testes do registry** — antes de seguir
5. **Loader** (`loader.ts`) — carregamento dinâmico
6. **Testes do loader** — com mocks
7. **Add-on hello** — primeiro add-on real
8. **Add-on counter** — segundo add-on
9. **Host app** — o app que junta tudo
10. **Teste manual** — abrir no navegador e ver funcionando

---

### O Resumo em Uma Frase Só (de novo, porque é importante)

> Um add-on é um arquivo JavaScript publicado em qualquer URL, que se apresenta com um manifesto, registra serviços num registry central, e o host usa esses serviços sem saber quem implementa — com fallback automático se um add-on falhar.

---

*Esse documento foi feito pra ser lido em ordem, do começo ao fim. Cada seção assume que você leu a anterior. Se chegou até aqui, você já entende 90% do que precisa pra trabalhar nesse projeto.*