import { describe, expect, it } from 'vitest';
import { LOCAL_MANIFEST_PORTS, LOCAL_MANIFEST_URLS, loadLocalManifestSuggestions, localManifestUrl } from './local-manifest-suggestions';

describe('manifestos locais sugeridos', () => {
  it('mantém URLs locais mesmo antes de ler os metadados', () => {
    expect(LOCAL_MANIFEST_URLS).toEqual([
      'http://localhost:5294/manifest.json',
      'http://localhost:5304/manifest.json',
      'http://localhost:5306/manifest.json',
      'http://localhost:5307/manifest.json',
      'http://localhost:5308/manifest.json',
    ]);
  });

  it('monta uma URL local a partir da porta', () => {
    expect(localManifestUrl(5304)).toBe('http://localhost:5304/manifest.json');
    expect(LOCAL_MANIFEST_URLS).toHaveLength(LOCAL_MANIFEST_PORTS.length);
  });

  it('usa título e descrição publicados pelo manifesto sem importar o add-on', async () => {
    const suggestions = await loadLocalManifestSuggestions(async (url) => ({
      ok: url.endsWith(':5294/manifest.json'),
      json: async () => ({ name: 'Wikipédia', description: 'Resumos e buscas' }),
    }));

    expect(suggestions[0]).toMatchObject({ title: 'Wikipédia', description: 'Resumos e buscas' });
    expect(suggestions[1]).toMatchObject({ title: 'Manifesto local (porta 5304)', description: 'URL local de manifesto da demonstração.' });
  });
});
