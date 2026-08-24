import { describe, expect, it } from 'vitest';
import { ServiceRegistry } from './registry';

describe('ServiceRegistry', () => {
  it('register and get a service', () => {
    const registry = new ServiceRegistry();
    const greeter = { greet: (name: string) => `Olá, ${name}!` };

    registry.register('greeter', greeter, 'addon-hello');

    expect(registry.get('greeter')).toBe(greeter);
  });

  it('getAll returns services ordered by priority descending', () => {
    const registry = new ServiceRegistry();
    const low = { greet: () => 'baixa' };
    const high = { greet: () => 'alta' };

    registry.register('greeter', low, 'addon-a', 0);
    registry.register('greeter', high, 'addon-b', 10);

    const all = registry.getAll('greeter');
    expect(all).toHaveLength(2);
    expect(all[0]).toBe(high);
    expect(all[1]).toBe(low);
  });

  it('get returns the highest priority service', () => {
    const registry = new ServiceRegistry();
    const low = { greet: () => 'baixa' };
    const high = { greet: () => 'alta' };

    registry.register('greeter', low, 'addon-a', 0);
    registry.register('greeter', high, 'addon-b', 10);

    expect(registry.get('greeter')).toBe(high);
  });

  it("get returns undefined when service doesn't exist", () => {
    const registry = new ServiceRegistry();
    expect(registry.get('inexistente')).toBeUndefined();
  });

  it('has returns true when service exists', () => {
    const registry = new ServiceRegistry();
    registry.register('greeter', { greet: () => '' }, 'addon-a');
    expect(registry.has('greeter')).toBe(true);
  });

  it('has returns false when service does not exist', () => {
    const registry = new ServiceRegistry();
    expect(registry.has('greeter')).toBe(false);
  });

  it('unregister removes a specific service registration', () => {
    const registry = new ServiceRegistry();
    const a = { greet: () => 'a' };
    const b = { greet: () => 'b' };
    registry.register('greeter', a, 'addon-a');
    registry.register('greeter', b, 'addon-b');

    registry.unregister('greeter', 'addon-a');

    expect(registry.get('greeter')).toBe(b);
    expect(registry.getAll('greeter')).toHaveLength(1);
  });

  it('clear removes all services', () => {
    const registry = new ServiceRegistry();
    registry.register('a', { val: 1 }, 'addon-a');
    registry.register('b', { val: 2 }, 'addon-b');

    registry.clear();

    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(false);
  });

  it('clearAddon removes all services from a specific addon', () => {
    const registry = new ServiceRegistry();
    registry.register('a', { val: 1 }, 'addon-a');
    registry.register('b', { val: 2 }, 'addon-a');
    registry.register('c', { val: 3 }, 'addon-b');

    registry.clearAddon('addon-a');

    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(false);
    expect(registry.has('c')).toBe(true);
  });
});