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

describe('validateManifest', () => {
  it('returns valid for a correct manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
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