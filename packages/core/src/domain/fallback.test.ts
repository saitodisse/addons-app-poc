import { describe, expect, it } from 'vitest';
import { ServiceRegistry } from './registry';
import { withFallback } from './fallback';

interface Greeter {
  greet(name: string): string;
}

describe('withFallback', () => {

  it('usa a primeira implementação quando ela funciona', async () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Olá de A' };
    const b: Greeter = { greet: () => 'Olá de B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry,
      'greeter',
      (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Olá de A');
  });

  it('cai para a segunda quando a primeira lança erro', async () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Falhou'); } };
    const b: Greeter = { greet: () => 'Olá de B' };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    const result = withFallback<Greeter, string>(
      registry,
      'greeter',
      (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Olá de B');
  });

  it('lança AggregateFallbackError quando todas falham', async () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => { throw new Error('Falhou A'); } };
    const b: Greeter = { greet: () => { throw new Error('Falhou B'); } };

    registry.register('greeter', a, 'addon-a', 10);
    registry.register('greeter', b, 'addon-b', 0);

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('Todas as implementações');
  });

  it('usa a única implementação disponível', async () => {
    const registry = new ServiceRegistry();
    const a: Greeter = { greet: () => 'Única' };

    registry.register('greeter', a, 'addon-a');

    const result = withFallback<Greeter, string>(
      registry,
      'greeter',
      (g) => g.greet('Mundo'),
    );

    expect(result).toBe('Única');
  });

  it('lança AggregateFallbackError quando não há implementação', async () => {
    const registry = new ServiceRegistry();

    expect(() =>
      withFallback<Greeter, string>(registry, 'greeter', (g) => g.greet('Mundo')),
    ).toThrow('Todas as implementações');
  });
});