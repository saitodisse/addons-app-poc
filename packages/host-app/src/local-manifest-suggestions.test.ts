import { describe, expect, it } from 'vitest';
import { LOCAL_MANIFEST_PORTS, LOCAL_MANIFEST_URLS, loadLocalManifestSuggestions, localManifestUrl } from './local-manifest-suggestions';

describe('suggested local manifests', () => {
  it('keeps local URLs even before reading metadata', () => {
    expect(LOCAL_MANIFEST_URLS).toEqual([
      'http://localhost:5294/manifest.json',
      'http://localhost:5304/manifest.json',
      'http://localhost:5306/manifest.json',
      'http://localhost:5307/manifest.json',
      'http://localhost:5308/manifest.json',
    ]);
  });

  it('builds a local URL from the port', () => {
    expect(localManifestUrl(5304)).toBe('http://localhost:5304/manifest.json');
    expect(LOCAL_MANIFEST_URLS).toHaveLength(LOCAL_MANIFEST_PORTS.length);
  });

  it('uses the title and description published by the manifest without importing the add-on', async () => {
    const suggestions = await loadLocalManifestSuggestions(async (url) => ({
      ok: url.endsWith(':5294/manifest.json'),
      json: async () => ({ name: 'Wikipedia', description: 'Summaries and search' }),
    }));

    expect(suggestions[0]).toMatchObject({ title: 'Wikipedia', description: 'Summaries and search' });
    expect(suggestions[1]).toMatchObject({ title: 'Local manifest (port 5304)', description: 'Local demonstration manifest URL.' });
  });
});
