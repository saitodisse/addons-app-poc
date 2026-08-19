# addons-app-poc

## Um jeito totalmente novo de pensar em plugins

Esse projeto é um experimento. A ideia é criar um sisteminha onde **qualquer pessoa** pode criar um pedaço de código, publicar na internet, e esse código vira parte de um aplicativo — sem pedir permissão, sem passar por loja, sem depender de ninguém.

Parece mágica, mas é só arquitetura de software bem feita.

---

### Mas por que isso existe?

Imagina que você tem um app que toca música. Um dia você quer adicionar um visualizador de ondas sonoras. Você pode:

1. Pedir pro dono do app adicionar (e esperar ele aceitar)
2. Criar um plugin no formato que o app exige (e esperar ele aprovar)
3. **Instalar um add-on de qualquer lugar da internet** (essa é a ideia aqui)

O Stremio — aquele app que todo mundo usa pra assistir filme — já faz isso. Você instala o Torrentio, o KnightCrawler, e de repente seu app tem funcionalidades que o criador original nunca colocou. E o melhor: se um add-on cair, você instala outro. O app principal nunca quebra.

Esse projeto é uma tentativa de trazer essa mesma liberdade para o mundo de aplicações web.

---

### O que tem aqui dentro

| Pasta | O que é |
|-------|---------|
| `packages/core` | O coração do sistema — as regras, o registro, o carregador |
| `packages/host-app` | Um app de exemplo que aceita add-ons |
| `packages/addon-hello` | Um add-on simples que dá bom dia |
| `packages/addon-hello-pt` | Um add-on que dá bom dia com prioridade maior |
| `packages/addon-counter` | Um add-on que faz contagem |
| `packages/addon-server` | Um "mini-servidor" pronto pra add-on de texto |
| `packages/addon-text-biblioteca` | Um add-on de texto com acervo embutido (porta 5291) |
| `packages/addon-text-citacoes` | Um add-on de citações que busca na internet (porta 5292) |
| `packages/addon-text-poemas` | Um add-on de poemas que busca na internet (porta 5293) |
| `docs-17yrs/` | A documentação explicada pra você entender tudo |

---

### Como ler isso

Se você está começando do zero, a ordem é:

1. `docs/RESUMO-PLANO.md` — as 13 decisões principais explicadas uma a uma
2. `docs/ARCHITECTURE.md` — como o sistema funciona por dentro
3. `docs/GLOSSARY.md` — os termos que você precisa saber
4. `docs/PHASES.md` — o que vem primeiro, o que vem depois
5. O resto na ordem que quiser

---

### Como rodar

```bash
pnpm install

# Terminal 1 — sobe os servidores dos add-ons de texto (5291, 5292, 5293)
pnpm dev:addons

# Terminal 2 — sobe o app principal (http://localhost:5280)
pnpm dev
```

No app, abre a aba **📄 Textos**: os três add-ons de texto aparecem sozinhos. Você navega catálogos, busca (os de citações e poemas buscam em APIs reais da internet) e lê o conteúdo.

```bash
pnpm test   # roda todos os testes
```

---

### Licença

MIT — pode usar, copiar, estudar, modificar. É livre.