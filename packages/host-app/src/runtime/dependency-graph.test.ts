import { describe, expect, it } from 'vitest';
import type { AddonManifest, ServiceInteraction } from '@addons-poc/protocol';
import { analyzeAddonDependencies, orderAddonKeysByDependencies } from './dependency-graph';

function manifest(id: string, services: ServiceInteraction[]): AddonManifest {
  return {
    id,
    version: '1.0.0',
    name: id,
    description: id,
    author: 'Test team',
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

function service(id: string, role: ServiceInteraction['role'], version: string, priority?: number, required = true): ServiceInteraction {
  return {
    id,
    role,
    version,
    name: id,
    description: id,
    priority,
    ...(role === 'consumes' ? { required } : {}),
    methods: [{ id: 'run', description: 'Runs the service.' }],
  };
}

describe('analyzeAddonDependencies', () => {
  it('selects the compatible provider with the highest priority', () => {
    const result = analyzeAddonDependencies([
      { key: 'low', manifest: manifest('low', [service('addons.shared.runner', 'provides', '1.0.0', 0)]) },
      { key: 'high', manifest: manifest('high', [service('addons.shared.runner', 'provides', '1.0.0', 10)]) },
      { key: 'consumer', manifest: manifest('consumer', [service('addons.shared.runner', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.statuses.get('consumer')).toMatchObject({ status: 'ready', providers: { 'addons.shared.runner': 'high' } });
  });

  it('blocks a consumer when the required service is missing', () => {
    const result = analyzeAddonDependencies([
      { key: 'consumer', manifest: manifest('consumer', [service('addons.missing.runner', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.statuses.get('consumer')?.status).toBe('blocked');
    expect(result.statuses.get('consumer')?.errors.join(' ')).toContain('Missing required service');
  });

  it('blocks required service cycles', () => {
    const result = analyzeAddonDependencies([
      { key: 'a', manifest: manifest('a', [service('addons.a', 'provides', '1.0.0'), service('addons.b', 'consumes', '^1.0.0')]) },
      { key: 'b', manifest: manifest('b', [service('addons.b', 'provides', '1.0.0'), service('addons.a', 'consumes', '^1.0.0')]) },
    ]);

    expect(result.cycles).toEqual([['a', 'b']]);
    expect(result.statuses.get('a')?.status).toBe('blocked');
    expect(result.statuses.get('b')?.status).toBe('blocked');
  });

  it('orders requested required providers before consumers and ignores optional dependencies', () => {
    const editorUrl = 'editor';
    const viewerUrl = 'viewer';
    const storageUrl = 'storage';
    const inputs = [
      { key: editorUrl, manifest: manifest('editor', [
        service('addons.chords.viewer', 'consumes', '^1.0.0'),
        service('state-store', 'consumes', '^1.0.0'),
        service('addons.chords.drafts', 'provides', '1.0.0'),
      ]) },
      { key: viewerUrl, manifest: manifest('viewer', [
        service('addons.chords.viewer', 'provides', '1.0.0'),
        service('addons.chords.drafts', 'consumes', '^1.0.0', undefined, false),
      ]) },
      { key: storageUrl, manifest: manifest('storage', [service('state-store', 'provides', '1.0.0')]) },
    ];

    expect(orderAddonKeysByDependencies([editorUrl, viewerUrl], inputs)).toEqual([viewerUrl, editorUrl]);
  });
});
