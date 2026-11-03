import { describe, expect, it } from 'vitest';
import { LOCAL_MANIFEST_PORTS, LOCAL_MANIFEST_URLS, loadLocalManifestSuggestions, localManifestUrl, manifestSuggestions, olderManifestUrls, peekMosaicManifestUrl, prioritizePublishedAddonSuggestions, PUBLISHED_MANIFEST_URLS } from './local-manifest-suggestions';

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
    expect(manifestSuggestions('www.peekmosaic.com').map((item) => item.manifestUrl)).toEqual([...PUBLISHED_MANIFEST_URLS]);
    expect(PUBLISHED_MANIFEST_URLS).toEqual([
      'https://www.peekmosaic.com/addons/1.17.2/chord-catalog/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.2/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.2/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.1/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.1/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.0/chord-catalog/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.0/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.0/storage-local/manifest.json',
      'https://www.peekmosaic.com/addons/1.17.0/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.2/chord-catalog/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.2/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.2/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.1/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.1/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.0/chord-catalog/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.0/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.16.0/chord-editor/manifest.json',
      'https://www.peekmosaic.com/addons/1.15.0/chord-catalog/manifest.json',
      'https://www.peekmosaic.com/addons/1.15.0/chord-viewer/manifest.json',
      'https://www.peekmosaic.com/addons/1.15.0/chord-editor/manifest.json',
    ]);
  });

  it('maps known fixed release manifest URLs to branded aliases', () => {
    expect(peekMosaicManifestUrl('https://addons-poc-release-1-17-2.vercel.app/chord-catalog/manifest.json'))
      .toBe('https://www.peekmosaic.com/addons/1.17.2/chord-catalog/manifest.json');
    expect(peekMosaicManifestUrl('https://addons-poc-release-1-17-1.vercel.app/chord-viewer/manifest.json'))
      .toBe('https://www.peekmosaic.com/addons/1.17.1/chord-viewer/manifest.json');
    expect(peekMosaicManifestUrl('https://addons-poc-release-1-16-2.vercel.app/chord-viewer/manifest.json'))
      .toBe('https://www.peekmosaic.com/addons/1.16.2/chord-viewer/manifest.json');
    expect(peekMosaicManifestUrl('https://addons-poc-release-9-99-0.vercel.app/chord-viewer/manifest.json'))
      .toBe('https://addons-poc-release-9-99-0.vercel.app/chord-viewer/manifest.json');
  });

  it('builds a local URL from the port', () => {
    expect(localManifestUrl(5304)).toBe('http://localhost:5304/manifest.json');
    expect(LOCAL_MANIFEST_URLS).toHaveLength(LOCAL_MANIFEST_PORTS.length);
  });

  it('identifies older versions only for the same manifest ID and comparable versions', () => {
    const item = (manifestUrl: string, id?: string, version?: string) => ({ manifestUrl, id, version, title: manifestUrl, description: '' });
    expect([...olderManifestUrls([
      item('old', 'viewer', '1.9.0'), item('new', 'viewer', '1.10.0'),
      item('same', 'viewer', '1.10.0'), item('other', 'catalog', '1.0.0'),
      item('unknown', 'viewer'), item('prerelease', 'viewer', '1.0.0-beta'), item('no-id', undefined, '1.0.0'),
    ])]).toEqual(['old']);
  });

  it('keeps production add-ons ahead of local-only suggestions', () => {
    const suggestions = [
      { manifestUrl: 'http://localhost:5304/manifest.json', id: 'wikipedia', title: 'Wikipedia', description: '' },
      { manifestUrl: 'https://www.peekmosaic.com/addons/1.17.2/chord-catalog/manifest.json', id: 'chord-catalog', title: 'Catalogue', description: '' },
      { manifestUrl: 'http://localhost:5309/manifest.json', title: 'Local example', description: '' },
    ];
    expect(prioritizePublishedAddonSuggestions(suggestions).map(({ manifestUrl }) => manifestUrl)).toEqual([
      'https://www.peekmosaic.com/addons/1.17.2/chord-catalog/manifest.json',
      'http://localhost:5304/manifest.json',
      'http://localhost:5309/manifest.json',
    ]);
  });

  it('uses the title and description published by the manifest without importing the add-on', async () => {
    const suggestions = await loadLocalManifestSuggestions(async (url) => ({
      ok: url.endsWith(':5294/manifest.json'),
      json: async () => ({ id: 'wikipedia', name: 'Wikipedia', description: 'Summaries and search', version: '2.3.4' }),
    }));

    expect(suggestions.find((suggestion) => suggestion.manifestUrl.endsWith(':5294/manifest.json'))).toMatchObject({ id: 'wikipedia', title: 'Wikipedia', description: 'Summaries and search', version: '2.3.4' });
    const unanswered = suggestions.find((suggestion) => suggestion.manifestUrl.endsWith(':5304/manifest.json'));
    expect(unanswered).toMatchObject({ title: 'Local manifest (port 5304)', description: 'Local demonstration manifest URL.' });
  });
});
