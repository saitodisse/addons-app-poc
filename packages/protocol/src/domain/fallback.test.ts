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
  it('uses the first implementation when it works', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Hello from A' };
    const b: Greeter = { greet: () => 'Hello from B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Hello from A');
  });

  it('falls back to the second when the first throws', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Failed'); } };
    const b: Greeter = { greet: () => 'Hello from B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Hello from B');
  });

  it('throws AggregateFallbackError when all fail', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Failed A'); } };
    const b: Greeter = { greet: () => { throw new Error('Failed B'); } };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('All implementations');
  });

  it('uses the only available implementation', () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Only one' };

    registry.register('greeter', a, 'addon-a');

    const result = withFallback<Greeter, string>(
      registry, 'greeter', (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Only one');
  });

  it('throws AggregateFallbackError when no implementation exists', () => {
    const registry = new ServiceRegistry();

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('All implementations');
  });
});

describe('withFallbackAsync', () => {
  it('uses the first implementation when it resolves', async () => {
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

  it('falls back to the next when the first rejects', async () => {
    const registry = new ServiceRegistry();
    const a: SearchProvider = { search: async () => { throw new Error('Failed'); } };
    const b: SearchProvider = { search: async (q) => [`B:${q}`] };

    registry.register('search', a, 'addon-a', 10);
    registry.register('search', b, 'addon-b', 0);

    const result = await withFallbackAsync<SearchProvider, string[]>(
      registry, 'search', (p) => p.search('query'),
    );

    expect(result).toEqual(['B:query']);
  });

  it('throws AggregateFallbackError when all reject', async () => {
    const registry = new ServiceRegistry();
    const a: SearchProvider = { search: async () => { throw new Error('Failed A'); } };
    const b: SearchProvider = { search: async () => { throw new Error('Failed B'); } };

    registry.register('search', a, 'addon-a', 10);
    registry.register('search', b, 'addon-b', 0);

    await expect(
      withFallbackAsync<SearchProvider, string[]>(registry, 'search', (p) => p.search('q')),
    ).rejects.toThrow('All implementations');
  });

  it('throws when no implementation exists', async () => {
    const registry = new ServiceRegistry();

    await expect(
      withFallbackAsync<SearchProvider, string[]>(registry, 'search', (p) => p.search('q')),
    ).rejects.toThrow('All implementations');
  });
});
