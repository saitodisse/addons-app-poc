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
| `packages/addon-counter` | Um add-on que faz contagem |
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

### Licença

MIT — pode usar, copiar, estudar, modificar. É livre.