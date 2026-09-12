import { describe, expect, it } from 'vitest';
import { catalog, search, text, content, contentJson } from './handlers.js';

/** API falsa: simula busca paginada + random + summary sem rede. */
function fakeApi() {
  const searchCalls = [];
  return {
    searchCalls,
    async search(query, page) {
      searchCalls.push({ query, page });
      return {
        results: [
        { title: 'Brasil', description: 'Brasil\n\nConteúdo de Brasil', url: 'https://x/Brasil' },
        { title: 'Brasília', description: 'Brasília\n\nConteúdo de Brasília', url: 'https://x/Brasília' },
        ],
        pagination: { limit: 20, total: 2 },
      };
    },
    async random() {
      return ['Chuva', 'Mar'];
    },
    async summary(title) {
      if (title === 'Inexistente') return { title, extract: '' };
      return {
        title,
        extract: 'Extrato de ' + title,
        lang: 'pt',
        description: 'd',
        displaytitle: `Título ${title}`,
        pageid: 123,
        revision: '456',
        timestamp: '2026-09-12T12:00:00Z',
        content_urls: { desktop: { page: 'https://pt.wikipedia.org/wiki/Brasil' } },
        thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' },
        originalimage: { source: 'https://upload.wikimedia.org/original.jpg' },
      };
    },
    async summaryDetails(title) {
      const summary = await this.summary(title);
      return {
        body: {
          ...summary,
          displaytitle: `Título ${title}`,
          extract_html: `<p>Extrato de ${title}</p>`,
          pageid: 123,
          wikibase_item: 'Q123',
          namespace: { id: 0, text: '' },
          dir: 'ltr',
          revision: '456',
          timestamp: '2026-09-12T12:00:00Z',
          tid: 'tid-123',
          titles: { canonical: title, normalized: title, display: `Título ${title}` },
          content_urls: {
            desktop: { page: 'https://pt.wikipedia.org/wiki/Brasil', revisions: 'https://pt.wikipedia.org/w/index.php?title=Brasil&action=history', edit: 'https://pt.wikipedia.org/w/index.php?title=Brasil&action=edit' },
            mobile: { page: 'https://pt.m.wikipedia.org/wiki/Brasil', revisions: 'https://pt.m.wikipedia.org/w/index.php?title=Brasil&action=history', edit: 'https://pt.m.wikipedia.org/w/index.php?title=Brasil&action=edit' },
          },
          thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg', width: 100, height: 50 },
          originalimage: { source: 'https://upload.wikimedia.org/original.jpg', width: 200, height: 100 },
        },
        requestId: 'wikipedia-api-1',
        request: { url: `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}` },
        response: {
          status: 200,
          ok: true,
          headers: {
            etag: '"etag-456"',
            'last-modified': 'Sat, 12 Sep 2026 12:00:00 GMT',
            'content-language': 'pt',
            'content-length': '789',
            'content-type': 'application/json',
          },
          bodyText: '{"title":"Brasil"}',
        },
        durationMs: 37,
        collectedAt: '2026-09-12T12:00:00.037Z',
      };
    },
  };
}

describe('Wikipedia add-on handlers', () => {
  it('search usa o limite ampliado e coloca o conteúdo na descrição', async () => {
    const api = fakeApi();
    const res = await search('page', 'brasil', api);
    expect(api.searchCalls).toEqual([{ query: 'brasil', page: undefined }]);
    expect(res.metas.map((m) => m.name)).toEqual(['Brasil', 'Brasília']);
    expect(res.metas[0].type).toBe('page');
    expect(res.metas[0].description).toBe('Brasil\n\nConteúdo de Brasil');
    expect(res.metas[0].description).not.toContain('content.txt');
    expect(res.pagination).toEqual({ limit: 20, total: 2 });
  });

  it('repassa limite e cursor ao cliente externo', async () => {
    const api = fakeApi();
    const res = await search('page', 'brasil', { limit: 20, cursor: '20' }, api);

    expect(api.searchCalls).toEqual([{ query: 'brasil', page: { limit: 20, cursor: '20' } }]);
    expect(res.metas).toHaveLength(2);
  });

  it('catalog aleatorios devolve títulos aleatórios', async () => {
    const res = await catalog('page', 'aleatorios', fakeApi());
    expect(res.metas.map((m) => m.name)).toEqual(['Chuva', 'Mar']);
  });

  it('text monta item com url relativa de conteúdo', async () => {
    const res = await text('page', 'Brasil', fakeApi());
    expect(res.texts[0].url).toBe('/text/page/Brasil/content.txt');
    expect(res.texts[0].contentJsonUrl).toBe('/text/page/Brasil/content.json');
    expect(res.texts[0].name).toBe('Brasil');
    expect(res.texts[0]).toMatchObject({ pageid: 123, revision: '456', timestamp: '2026-09-12T12:00:00Z' });
    expect(res.texts[0].content_urls).toBeDefined();
    expect(res.texts[0].thumbnail).toBeDefined();
    expect(res.texts[0].originalimage).toBeDefined();
  });

  it('text lança erro quando não há extrato', async () => {
    await expect(text('page', 'Inexistente', fakeApi())).rejects.toThrow('Artigo não encontrado');
  });

  it('content devolve título + extrato', async () => {
    const body = await content('page', 'Brasil', fakeApi());
    expect(body).toBe('Brasil\n\nExtrato de Brasil');
  });

  it('contentJson devolve metadados, conteúdo, fonte e observabilidade', async () => {
    const result = await contentJson('page', 'Brasil', fakeApi());

    expect(result.headers).toEqual({
      ETag: '"etag-456"',
      'Last-Modified': 'Sat, 12 Sep 2026 12:00:00 GMT',
      'Content-Language': 'pt',
    });
    expect(result.body).toMatchObject({
      id: 'Brasil',
      type: 'page',
      title: 'Brasil',
      displaytitle: 'Título Brasil',
      description: 'd',
      extract: 'Extrato de Brasil',
      extract_html: '<p>Extrato de Brasil</p>',
      pageid: 123,
      wikibase_item: 'Q123',
      namespace: { id: 0, text: '' },
      lang: 'pt',
      dir: 'ltr',
      revision: '456',
      timestamp: '2026-09-12T12:00:00Z',
      tid: 'tid-123',
      content_urls: expect.any(Object),
      thumbnail: expect.any(Object),
      originalimage: expect.any(Object),
      content: {
        text: 'Brasil\n\nExtrato de Brasil',
        charCount: 25,
        wordCount: 4,
        contentType: 'text/plain',
        encoding: 'utf-8',
      },
      source: {
        provider: 'Wikipédia',
        origin: 'https://pt.wikipedia.org',
        url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/Brasil',
        headers: {
          ETag: '"etag-456"',
          'Last-Modified': 'Sat, 12 Sep 2026 12:00:00 GMT',
          'Content-Language': 'pt',
          'Content-Length': '789',
        },
        responseHeaders: expect.objectContaining({ 'content-type': 'application/json' }),
      },
      observability: {
        requestId: 'wikipedia-api-1',
        durationMs: 37,
        collectedAt: '2026-09-12T12:00:00.037Z',
      },
    });
  });

  it('marca artigo ausente com status 404', async () => {
    await expect(contentJson('page', 'Inexistente', fakeApi())).rejects.toMatchObject({
      status: 404,
      code: 'ARTICLE_NOT_FOUND',
      message: 'Artigo não encontrado: Inexistente',
    });
  });
});
