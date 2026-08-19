# PRD — O Que o Sistema Precisa Fazer

*PRD = Product Requirements Document. É uma lista de tudo que o sistema precisa fazer. Pense como um "checklist de funcionalidades".*

---

## O Problema que a Gente tá Resolvendo

Aplicativos hoje só aceitam plugins de dois jeitos:

1. **Tudo no mesmo código** — você importa os plugins no build. Se quiser trocar, recompila tudo.
2. **Loja centralizada** — o plugin só existe se o dono da loja aprovar.

Os dois são ruins. O primeiro trava a inovação. O segundo cria um gargalo.

A gente quer um **terceiro jeito**: qualquer um publica um add-on em qualquer URL, e o app descarrega e usa. Sem pedir permissão. Sem recompilar. Sem loja.

---

## O Que o Sistema Precisa Fazer (Fase 1)

Esses são os requisitos da primeira fase. O "mínimo necessário" pra prova de conceito funcionar.

### Sobre o Manifesto

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.1 | O sistema precisa ter um formato de manifesto | Pra add-on se anunciar |
| F1.2 | O manifesto precisa ter: id, versão, entrypoint, lista de serviços | É o mínimo que o host precisa saber |
| F1.3 | O sistema precisa validar o manifesto antes de carregar | Pra não carregar lixo |

### Sobre o Registry

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.4 | Add-on precisa conseguir registrar serviços | É como ele se apresenta |
| F1.5 | Host precisa conseguir consultar serviços por ID | É como ele usa o add-on |
| F1.6 | Vários add-ons podem registrar o mesmo serviço | Concorrência saudável |
| F1.7 | Cada registro tem uma prioridade | Pra saber quem ganha |

### Sobre o Carregamento

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.8 | Host precisa carregar add-ons dinamicamente via `import()` | É o que permite URL remota |
| F1.9 | Se o setup do add-on falhar, o host não pode quebrar | Resiliência |
| F1.10 | Erro no setup desativa o add-on e descarta registros parciais | Consistência |

### Sobre o HostAPI

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.11 | Host precisa dar um `HostAPI` pro add-on usar | É a "caixa de ferramentas" |
| F1.12 | HostAPI precisa ter: registry, onUnload, log | O mínimo que o add-on precisa |

### Sobre a Interface

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.13 | O app precisa mostrar add-ons instalados numa lista | O usuário precisa ver o que tá rodando |
| F1.14 | O app precisa deixar invocar serviços dos add-ons | Pra testar se funciona |

### Sobre Testes

| ID | Requisito | Por quê |
|----|-----------|---------|
| F1.15 | Registry tem que ter testes unitários | É o coração do sistema |
| F1.16 | Validação tem que ter testes unitários | Pra não aceitar manifesto errado |
| F1.17 | Loader tem que ter testes com mock | Pra testar erro sem internet |

---

## O Que Vem Depois (Fases 2, 3, 4)

### Fase 2 — Fallback

| ID | Requisito |
|----|-----------|
| F2.1 | Se um serviço falhar, tenta o próximo automaticamente |
| F2.2 | Falhas são logadas |
| F2.3 | Add-ons podem ter interfaces tipadas (ex: `Greeter`) |
| F2.4 | Add-on pode substituir serviço de outro por prioridade |

### Fase 3 — Descoberta

| ID | Requisito |
|----|-----------|
| F3.1 | Add-ons carregados de URLs remotas (não só local) |
| F3.2 | Sistema valida se a versão do add-on é compatível com o host |
| F3.3 | Catálogo de add-ons conhecidos |
| F3.4 | Usuário pode instalar add-on colando a URL |

### Fase 3.0 — Add-ons de Texto por HTTP (estilo Stremio/Torrentio) ✅

| ID | Requisito |
|----|-----------|
| F3.0.1 | O manifesto pode usar o formato Stremio: `resources` + `types` + `catalogs` |
| F3.0.2 | Cada add-on de texto é um servidor HTTP que responde em `/<resource>/<type>/<id>.json` |
| F3.0.3 | O recurso `text` usa o formato subtitles: `{ texts: [{ id, url, lang, name }] }` |
| F3.0.4 | O core tem um cliente (`HttpTextAddonClient`) pra consumir add-ons remotos |
| F3.0.5 | O app tem uma aba Textos: navega catálogos, busca e lê conteúdo |
| F3.0.6 | Add-ons podem fazer processamento externo (buscar em APIs públicas) |
| F3.0.7 | Os servidores de add-on liberam CORS pro app principal |

### Fase 4 — Resiliência

| ID | Requisito |
|----|-----------|
| F4.1 | Erro de um add-on não afeta os outros |
| F4.2 | Add-on que falha muitas vezes perde prioridade |
| F4.3 | Usuário pode ligar/desligar add-ons |
| F4.4 | Usuário pode reordenar prioridade |

---

## O Que NÃO Está no Escopo

- Loja de add-ons com backend
- Sandbox em Web Worker (investigação futura)
- Autenticação ou login
- Publicação no npm
- Interface gráfica bonita (o app é só pra demonstrar)

---

## Como Saber se a POC Deu Certo

A prova de conceito é bem-sucedida quando:

1. Um add-on de exemplo é carregado e o serviço dele funciona
2. Dois add-ons registram o mesmo serviço com prioridades diferentes
3. O de maior prioridade é usado por padrão
4. Se o de maior prioridade falhar, o fallback assume automaticamente
5. Um add-on com erro no setup não impede o host de funcionar
6. Os testes unitários do core passam
7. Um add-on de texto servido por HTTP é descoberto pelo app via manifesto (formato Stremio)
8. Catálogo, busca e leitura de conteúdo funcionam de ponta a ponta
9. Um add-on faz processamento externo real (busca em API pública) e devolve resultados
10. O app consome add-ons remotos via HTTP sem importar o código deles