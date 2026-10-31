import { describe, expect, it } from 'vitest';
import { LOCAL_MANIFEST_PORTS, LOCAL_MANIFEST_URLS, loadLocalManifestSuggestions, localManifestUrl, manifestSuggestions, PUBLISHED_MANIFEST_URLS } from './local-manifest-suggestions';

describe('suggested local manifests', () => {
  it('keeps local URLs even before reading metadata', () => {
    expect(LOCAL_MANIFEST_URLS).toEqual([
      'http://localhost:5294/manifest.json',
      'http://localhost:5295/manifest.json',
      'http://localhost:5304/manifest.json',
      'http://localhost:5305/manifest.json',
      'http://localhost:5306/manifest.json',
      'http://localhost:5307/manifest.json',
      'http://localhost:5308/manifest.json',
      'http://localhost:5309/manifest.json',
    ]);
  });

  it('selects only the manifests for the current environment', () => {
    expect(manifestSuggestions('localhost').map((item) => item.manifestUrl)).toEqual(LOCAL_MANIFEST_URLS);
    expect(manifestSuggestions('127.0.0.1').map((item) => item.manifestUrl)).toEqual(LOCAL_MANIFEST_URLS);
    expect(manifestSuggestions('addons-app-poc.vercel.app').map((item) => item.manifestUrl)).toEqual([...PUBLISHED_MANIFEST_URLS]);
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

    expect(suggestions.find((suggestion) => suggestion.manifestUrl.endsWith(':5294/manifest.json'))).toMatchObject({ title: 'Wikipedia', description: 'Summaries and search' });
    const unanswered = suggestions.find((suggestion) => suggestion.manifestUrl.endsWith(':5304/manifest.json'));
    expect(unanswered).toMatchObject({ title: 'Local manifest (port 5304)', description: 'Local demonstration manifest URL.' });
  });
});
