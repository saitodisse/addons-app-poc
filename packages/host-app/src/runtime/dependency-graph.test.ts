import { describe, expect, it } from 'vitest';
import type { AddonManifest, ServiceInteraction } from '@addons-poc/protocol';
import { analyzeAddonDependencies } from './dependency-graph';

function manifest(id: string, services: ServiceInteraction[]): AddonManifest {
  return {
    id,
    version: '1.0.0',
    name: id,
    description: id,
    author: 'Teste',
    license: 'MIT',
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services,
      ui: { title: id, body: id, fields: [], actions: [] },
      state: [],
      http: [],
      logs: [],
    },
  };
}

function service(id: string, role: ServiceInteraction['role'], version: string, priority?: number): ServiceInteraction {
  return { id, role, version, name: id, description: id, priority, methods: [{ id: 'run', description: 'Executa.' }] };
}

describe('analyzeAddonDependencies', () => {
  it('seleciona o provedor compatível de maior prioridade', () => {
    const result = analyzeAddonDependencies([
      { key: 'low', manifest: manifest('low', [service('addons.shared.runner', 'provides', '1.0.0', 0)]) },
      { key: 'high', manifest: manifest('high', [service('addons.shared.runner', 'provides', '1.0.0', 10)]) },
      { key: 'consumer', manifest: manifest('consumer', [service('addons.shared.runner', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.statuses.get('consumer')).toMatchObject({ status: 'ready', providers: { 'addons.shared.runner': 'high' } });
  });

  it('bloqueia um consumidor quando o serviço obrigatório está ausente', () => {
    const result = analyzeAddonDependencies([
      { key: 'consumer', manifest: manifest('consumer', [service('addons.missing.runner', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.statuses.get('consumer')?.status).toBe('blocked');
    expect(result.statuses.get('consumer')?.errors.join(' ')).toContain('Serviço obrigatório ausente');
  });

  it('bloqueia ciclos de serviços obrigatórios', () => {
    const result = analyzeAddonDependencies([
      { key: 'a', manifest: manifest('a', [service('addons.a', 'provides', '1.0.0'), service('addons.b', 'consumes', '^1.0.0')]) },
      { key: 'b', manifest: manifest('b', [service('addons.b', 'provides', '1.0.0'), service('addons.a', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.cycles).toEqual([['a', 'b']]);
    expect(result.statuses.get('a')?.status).toBe('blocked');
    expect(result.statuses.get('b')?.status).toBe('blocked');
  });
});
