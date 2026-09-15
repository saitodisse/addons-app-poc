import { describe, expect, it } from 'vitest';
import { catalog, search, text, content, contentJson } from './handlers.js';

/** Fake API: simulates paginated search + random + summary without a network. */
function fakeApi() {
  const searchCalls = [];
  return {
    searchCalls,
    async search(query, page) {
      searchCalls.push({ query, page });
      return {
        results: [
        { title: 'Brazil', description: 'Brazil\n\nContent of Brazil', url: 'https://x/Brazil' },
        { title: 'Brasilia', description: 'Brasilia\n\nContent of Brasilia', url: 'https://x/Brasilia' },
        ],
        pagination: { limit: 20, total: 2 },
      };
    },
    async random() {
      return ['Rain', 'Sea'];
    },
    async summary(title) {
      if (title === 'Missing') return { title, extract: '' };
      return {
        title,
        extract: 'Extract of ' + title,
        lang: 'pt',
        description: 'd',
        displaytitle: `Title ${title}`,
        pageid: 123,
        revision: '456',
        timestamp: '2026-09-12T12:00:00Z',
        content_urls: { desktop: { page: 'https://pt.wikipedia.org/wiki/Brazil' } },
        thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' },
        originalimage: { source: 'https://upload.wikimedia.org/original.jpg' },
      };
    },
    async summaryDetails(title) {
      const summary = await this.summary(title);
      return {
        body: {
          ...summary,
          displaytitle: `Title ${title}`,
          extract_html: `<p>Extract of ${title}</p>`,
          pageid: 123,
          wikibase_item: 'Q123',
          namespace: { id: 0, text: '' },
          dir: 'ltr',
          revision: '456',
          timestamp: '2026-09-12T12:00:00Z',
          tid: 'tid-123',
          titles: { canonical: title, normalized: title, display: `Title ${title}` },
          content_urls: {
            desktop: { page: 'https://pt.wikipedia.org/wiki/Brazil', revisions: 'https://pt.wikipedia.org/w/index.php?title=Brazil&action=history', edit: 'https://pt.wikipedia.org/w/index.php?title=Brazil&action=edit' },
            mobile: { page: 'https://pt.m.wikipedia.org/wiki/Brazil', revisions: 'https://pt.m.wikipedia.org/w/index.php?title=Brazil&action=history', edit: 'https://pt.m.wikipedia.org/w/index.php?title=Brazil&action=edit' },
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
          bodyText: '{"title":"Brazil"}',
        },
        durationMs: 37,
        collectedAt: '2026-09-12T12:00:00.037Z',
      };
    },
  };
}

describe('Wikipedia add-on handlers', () => {
  it('includes the selected language in result URLs', async () => {
    const api = fakeApi();
    api.language = 'en';

    const res = await search('page', 'brazil', { lang: 'en' }, api);

    expect(res.metas[0]).toMatchObject({
      url: '/text/page/Brazil/content.txt?lang=en',
    });
  });

  it('search uses the expanded limit and puts content in the description', async () => {
    const api = fakeApi();
    const res = await search('page', 'brazil', api);
    expect(api.searchCalls).toEqual([{ query: 'brazil', page: undefined }]);
    expect(res.metas.map((m) => m.name)).toEqual(['Brazil', 'Brasilia']);
    expect(res.metas[0].type).toBe('page');
    expect(res.metas[0].description).toBe('Brazil\n\nContent of Brazil');
    expect(res.metas[0].description).not.toContain('content.txt');
    expect(res.pagination).toEqual({ limit: 20, total: 2 });
  });

  it('passes the limit and cursor to the external client', async () => {
    const api = fakeApi();
    const res = await search('page', 'brazil', { limit: 20, cursor: '20' }, api);

    expect(api.searchCalls).toEqual([{ query: 'brazil', page: { limit: 20, cursor: '20' } }]);
    expect(res.metas).toHaveLength(2);
  });

  it('random catalog returns random titles', async () => {
    const res = await catalog('page', 'random', fakeApi());
    expect(res.metas.map((m) => m.name)).toEqual(['Rain', 'Sea']);
  });

  it('text builds an item with a relative content URL', async () => {
    const res = await text('page', 'Brazil', fakeApi());
    expect(res.texts[0].url).toBe('/text/page/Brazil/content.txt');
    expect(res.texts[0].contentJsonUrl).toBe('/text/page/Brazil/content.json');
    expect(res.texts[0].name).toBe('Brazil');
    expect(res.texts[0]).toMatchObject({ pageid: 123, revision: '456', timestamp: '2026-09-12T12:00:00Z' });
    expect(res.texts[0].content_urls).toBeDefined();
    expect(res.texts[0].thumbnail).toBeDefined();
    expect(res.texts[0].originalimage).toBeDefined();
  });

  it('text throws when no extract is available', async () => {
    await expect(text('page', 'Missing', fakeApi())).rejects.toThrow('Article not found');
  });

  it('content returns title + extract', async () => {
    const body = await content('page', 'Brazil', fakeApi());
    expect(body).toBe('Brazil\n\nExtract of Brazil');
  });

  it('contentJson returns metadata, content, source, and observability', async () => {
    const result = await contentJson('page', 'Brazil', fakeApi());

    expect(result.headers).toEqual({
      ETag: '"etag-456"',
      'Last-Modified': 'Sat, 12 Sep 2026 12:00:00 GMT',
      'Content-Language': 'pt',
    });
    expect(result.body).toMatchObject({
      id: 'Brazil',
      type: 'page',
      title: 'Brazil',
      displaytitle: 'Title Brazil',
      description: 'd',
      extract: 'Extract of Brazil',
      extract_html: '<p>Extract of Brazil</p>',
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
        text: 'Brazil\n\nExtract of Brazil',
        charCount: 25,
        wordCount: 4,
        contentType: 'text/plain',
        encoding: 'utf-8',
      },
      source: {
        provider: 'Wikipedia',
        origin: 'https://pt.wikipedia.org',
        url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/Brazil',
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

  it('marks a missing article with status 404', async () => {
    await expect(contentJson('page', 'Missing', fakeApi())).rejects.toMatchObject({
      status: 404,
      code: 'ARTICLE_NOT_FOUND',
      message: 'Article not found: Missing',
    });
  });
});
