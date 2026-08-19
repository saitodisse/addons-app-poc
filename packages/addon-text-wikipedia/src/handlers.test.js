import { describe, expect, it } from 'vitest';
import { catalog, search, text, content } from './handlers.js';

/** API falsa: simula opensearch + random + summary sem rede. */
function fakeApi() {
  return {
    async search(query) {
      return [
        { title: 'Brasil', description: 'País da América do Sul', url: 'https://x/Brasil' },
        { title: 'Brasília', description: 'Capital do Brasil', url: 'https://x/Brasília' },
      ];
    },
    async random() {
      return ['Chuva', 'Mar'];
    },
    async summary(title) {
      if (title === 'Inexistente') return { title, extract: '' };
      return { title, extract: 'Extrato de ' + title, lang: 'pt', description: 'd' };
    },
  };
}

describe('Wikipedia add-on handlers', () => {
  it('search converte resultados em metas do tipo page', async () => {
    const res = await search('page', 'brasil', fakeApi());
    expect(res.metas.map((m) => m.name)).toEqual(['Brasil', 'Brasília']);
    expect(res.metas[0].type).toBe('page');
  });

  it('catalog aleatorios devolve títulos aleatórios', async () => {
    const res = await catalog('page', 'aleatorios', fakeApi());
    expect(res.metas.map((m) => m.name)).toEqual(['Chuva', 'Mar']);
  });

  it('text monta item com url relativa de conteúdo', async () => {
    const res = await text('page', 'Brasil', fakeApi());
    expect(res.texts[0].url).toBe('/text/page/Brasil/content.txt');
    expect(res.texts[0].name).toBe('Brasil');
  });

  it('text lança erro quando não há extrato', async () => {
    await expect(text('page', 'Inexistente', fakeApi())).rejects.toThrow('Artigo não encontrado');
  });

  it('content devolve título + extrato', async () => {
    const body = await content('page', 'Brasil', fakeApi());
    expect(body).toBe('Brasil\n\nExtrato de Brasil');
  });
});
