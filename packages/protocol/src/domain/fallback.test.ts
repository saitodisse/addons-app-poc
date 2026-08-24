import { describe, expect, it } from 'vitest';
import { ServiceRegistry } from './registry';
import { withFallback, withFallbackAsync } from './fallback';

interface Greeter {
  greet(name: string): string;
}

interface SearchProvider {
  search(query: string): Promise<string[]>;
}

describe('withFallback', () => {
  it('usa a primeira implementação quando ela funciona', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Olá de A' };
    const b: Greeter = { greet: () => 'Olá de B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Olá de A');
  });

  it('cai para a segunda quando a primeira lança erro', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Falhou'); } };
    const b: Greeter = { greet: () => 'Olá de B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Olá de B');
  });

  it('lança AggregateFallbackError quando todas falham', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Falhou A'); } };
    const b: Greeter = { greet: () => { throw new Error('Falhou B'); } };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('Todas as implementações');
  });

  it('usa a única implementação disponível', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Única' };

    registry.register('greeter', a, 'addon-a');

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Única');
  });

  it('lança AggregateFallbackError quando não há implementação', () => {
    const registry = new ServiceRegistry();

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('Todas as implementações');
  });
});

describe('withFallbackAsync', () => {
  it('usa a primeira implementação quando ela resolve', async () => {
    const registry = new ServiceRegistry();
    const a: SearchProvider = { search: async (q) => [`A:${q}`] };
    const b: SearchProvider = { search: async (q) => [`B:${q}`] };

    registry.register('search', a, 'addon-a', 10);
    registry.register('search', b, 'addon-b', 0);

    const result = await withFallbackAsync<SearchProvider, string[]>(
      registry, 'search', (p) => p.search('query'),
    );

    expect(result).toEqual(['A:query']);
  });

  it('cai para a próxima quando a primeira rejeita', async () => {
    const registry = new ServiceRegistry();
    const a: SearchProvider = { search: async () => { throw new Error('Falhou'); } };
    const b: SearchProvider = { search: async (q) => [`B:${q}`] };

    registry.register('search', a, 'addon-a', 10);
    registry.register('search', b, 'addon-b', 0);

    const result = await withFallbackAsync<SearchProvider, string[]>(
      registry, 'search', (p) => p.search('query'),
    );

    expect(result).toEqual(['B:query']);
  });

  it('lança AggregateFallbackError quando todas rejeitam', async () => {
    const registry = new ServiceRegistry();
    const a: SearchProvider = { search: async () => { throw new Error('Falhou A'); } };
    const b: SearchProvider = { search: async () => { throw new Error('Falhou B'); } };

    registry.register('search', a, 'addon-a', 10);
    registry.register('search', b, 'addon-b', 0);

    await expect(
      withFallbackAsync<SearchProvider, string[]>(registry, 'search', (p) => p.search('q')),
    ).rejects.toThrow('Todas as implementações');
  });

  it('lança erro quando não há implementação', async () => {
    const registry = new ServiceRegistry();

    await expect(
      withFallbackAsync<SearchProvider, string[]>(registry, 'search', (p) => p.search('q')),
    ).rejects.toThrow('Todas as implementações');
  });
});