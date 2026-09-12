import { describe, expect, it } from 'vitest';
import { validateManifest } from '@addons-poc/protocol';
import { manifest } from './manifest.js';

describe('manifesto da Wikipédia', () => {
  it('é válido e declara a observabilidade local', () => {
    expect(validateManifest(manifest)).toEqual({ valid: true, errors: [] });
    expect(manifest.contract.http.map((entry) => entry.id)).toEqual([
      'catalog',
      'search',
      'text',
      'content',
      'content-json',
      'debug-traffic',
      'search-api',
      'extracts-api',
      'random-api',
      'summary-api',
    ]);
  });

  it('descreve os campos reais enviados e recebidos pela API externa', () => {
    const searchApi = manifest.contract.http.find((entry) => entry.id === 'search-api');
    const requestSchema = searchApi?.receives?.schema;
    const responseSchema = searchApi?.returns.schema;

    expect(requestSchema?.properties?.url?.format).toBe('uri');
    expect(requestSchema?.properties?.query?.properties?.srsearch?.classification).toBe('personal');
    expect(responseSchema?.properties?.query?.properties?.search?.items?.properties?.snippet).toMatchObject({ type: 'string' });
  });

  it('declara o conteúdo estruturado e o descriptor enriquecido', () => {
    const contentJsonApi = manifest.contract.http.find((entry) => entry.id === 'content-json');
    const contentSchema = contentJsonApi?.returns?.schema;
    const textSchema = manifest.contract.http.find((entry) => entry.id === 'text')?.returns?.schema;
    const textItemSchema = textSchema?.properties?.texts?.items;

    expect(contentJsonApi?.path).toBe('/text/{type}/{id}/content.json');
    expect(contentSchema?.properties?.displaytitle).toMatchObject({ type: 'string' });
    expect(contentSchema?.properties?.extract_html).toMatchObject({ type: 'string' });
    expect(contentSchema?.properties?.content?.properties?.charCount).toMatchObject({ type: 'integer' });
    expect(contentSchema?.properties?.source?.properties?.headers?.required).toEqual([
      'ETag',
      'Last-Modified',
      'Content-Language',
      'Content-Length',
    ]);
    expect(contentSchema?.properties?.observability?.required).toEqual(['requestId', 'durationMs', 'collectedAt']);
    expect(textItemSchema?.properties?.pageid).toMatchObject({ type: 'integer' });
    expect(textItemSchema?.properties?.content_urls).toBeDefined();
    expect(textItemSchema?.properties?.thumbnail).toBeDefined();
    expect(textItemSchema?.properties?.originalimage).toBeDefined();
  });
});
