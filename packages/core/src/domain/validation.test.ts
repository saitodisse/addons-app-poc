import { describe, expect, it } from 'vitest';
import { validateManifest } from './validation';

const validManifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Um add-on simples',
  author: 'Joaquim',
  license: 'MIT',
  entrypoint: 'https://example.com/bundle.js',
  services: [
    { id: 'greeter', version: '1.0.0', name: 'Greeter', description: 'Saudação' },
  ],
};

// Manifesto estilo Stremio: add-on servido por HTTP com resources (como o Torrentio)
const stremioManifest = {
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo e busca de textos',
  author: 'Equipe AC',
  license: 'MIT',
  resources: [
    { name: 'catalog', types: ['text'], idPrefixes: [] },
    { name: 'search', types: ['text'], idPrefixes: [] },
    { name: 'text', types: ['text'], idPrefixes: [] },
  ],
  types: ['text'],
  idPrefixes: [],
  catalogs: [
    { type: 'text', id: 'classicos', name: 'Textos Clássicos' },
  ],
};

describe('validateManifest', () => {
  it('returns valid for a correct manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for a Stremio-style manifest with resources', () => {
    const result = validateManifest(stremioManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for a manifest without services nor resources', () => {
    const result = validateManifest({
      id: 'vazio',
      version: '1.0.0',
      name: 'Vazio',
      description: 'Sem serviços nem recursos',
      author: 'X',
      license: 'MIT',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services') || e.includes('resources'))).toBe(true);
  });

  it('returns invalid when a resource has an unknown name', () => {
    const result = validateManifest({
      ...stremioManifest,
      resources: [{ name: 'banana', types: ['text'] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('resources'))).toBe(true);
  });

  it('returns invalid when a resource has no types', () => {
    const result = validateManifest({
      ...stremioManifest,
      resources: [{ name: 'search', types: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('resources'))).toBe(true);
  });

  it('returns invalid when catalogs reference an unknown type', () => {
    const result = validateManifest({
      ...stremioManifest,
      catalogs: [{ type: 'filme', id: 'top', name: 'Filmes' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('catalogs'))).toBe(true);
  });

  it('returns invalid when data is not an object', () => {
    const result = validateManifest(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid when required fields are missing', () => {
    const result = validateManifest({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid when id is not kebab-case', () => {
    const result = validateManifest({ ...validManifest, id: 'Hello Addon' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('returns invalid when version is not semver', () => {
    const result = validateManifest({ ...validManifest, version: '1.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('returns invalid when entrypoint is not a URL', () => {
    const result = validateManifest({ ...validManifest, entrypoint: '/local/path.js' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('entrypoint'))).toBe(true);
  });

  it('returns invalid when services array is empty', () => {
    const result = validateManifest({ ...validManifest, services: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services'))).toBe(true);
  });

  it('returns invalid when a service is missing fields', () => {
    const result = validateManifest({
      ...validManifest,
      services: [{ id: 'only-id' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services'))).toBe(true);
  });
});