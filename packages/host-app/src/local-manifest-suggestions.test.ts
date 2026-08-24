import { describe, expect, it } from 'vitest';
import { LOCAL_MANIFEST_PORTS, LOCAL_MANIFEST_URLS, loadLocalManifestSuggestions, localManifestUrl } from './local-manifest-suggestions';

describe('manifestos locais sugeridos', () => {
  it('mantém URLs locais mesmo antes de ler os metadados', () => {
    expect(LOCAL_MANIFEST_URLS).toEqual([
      'http://localhost:5291/manifest.json',
      'http://localhost:5292/manifest.json',
      'http://localhost:5293/manifest.json',
      'http://localhost:5294/manifest.json',
      'http://localhost:5301/manifest.json',
      'http://localhost:5302/manifest.json',
      'http://localhost:5303/manifest.json',
      'http://localhost:5304/manifest.json',
      'http://localhost:5305/manifest.json',
      'http://localhost:5306/manifest.json',
      'http://localhost:5307/manifest.json',
      'http://localhost:5308/manifest.json',
      'http://localhost:5309/manifest.json',
      'http://localhost:5310/manifest.json',
    ]);
  });

  it('monta uma URL local a partir da porta', () => {
    expect(localManifestUrl(5301)).toBe('http://localhost:5301/manifest.json');
    expect(LOCAL_MANIFEST_URLS).toHaveLength(LOCAL_MANIFEST_PORTS.length);
  });

  it('usa título e descrição publicados pelo manifesto sem importar o add-on', async () => {
    const suggestions = await loadLocalManifestSuggestions(async (url) => ({
      ok: url.endsWith(':5291/manifest.json'),
      json: async () => ({ name: 'Biblioteca', description: 'Textos locais' }),
    }));

    expect(suggestions[0]).toMatchObject({ title: 'Biblioteca', description: 'Textos locais' });
    expect(suggestions[1]).toMatchObject({ title: 'Manifesto local (porta 5292)', description: 'URL local de manifesto da demonstração.' });
  });
});
