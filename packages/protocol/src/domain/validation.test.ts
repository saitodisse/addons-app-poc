import { describe, expect, it } from 'vitest';
import { validateManifest, validateTabContract } from './validation';
import { createContractServiceAccess, validateTabActionInput } from './contract';
import { defineAddonManifest } from './manifest';

const stringPayload = (description: string) => ({
  description,
  schema: { type: 'string', description, classification: 'public' as const },
});

const processInteractions = {
  version: '1.0.0' as const,
  protocol: { version: '1.0.0' as const, range: '^1.0.0' },
  capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
  services: [{ id: 'addons.hello.greeter', role: 'provides' as const, version: '1.0.0', name: 'Greeter', description: 'Creates greetings.', methods: [{ id: 'greet', description: 'Greets a name.', receives: stringPayload('Name.'), returns: stringPayload('Greeting.') }] }],
  ui: {
    title: 'Hello', body: 'A greeting.',
    fields: [{ id: 'name', label: 'Name', description: 'Name for the greeting.', required: true, schema: stringPayload('Provided name.').schema }],
    actions: [{ id: 'greet', label: 'Greet', description: 'Creates a greeting.', receives: ['name'], returns: stringPayload('Created greeting.') }],
  },
  state: [],
  http: [],
  logs: [],
};

const validManifest = defineAddonManifest({
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'A simple add-on',
  author: 'Joaquim',
  license: 'MIT',
  ui: { title: 'Hello', body: 'A greeting.' },
  entrypoint: 'https://example.com/bundle.js',
  services: [
    { id: 'addons.hello.greeter', version: '1.0.0', name: 'Greeter', description: 'Greeting' },
  ],
  contract: processInteractions,
});

// Stremio-style manifest: add-on served over HTTP with resources (like Torrentio).
const stremioManifest = defineAddonManifest({
  id: 'text-library',
  version: '1.0.0',
  name: 'Text Library',
  description: 'Text catalog and search',
  author: 'AC Team',
  license: 'MIT',
  ui: { title: 'Library', body: 'Texts to read.' },
  resources: [
    { name: 'catalog', types: ['text'], idPrefixes: [] },
    { name: 'search', types: ['text'], idPrefixes: [] },
    { name: 'text', types: ['text'], idPrefixes: [] },
  ],
  types: ['text'],
  idPrefixes: [],
  catalogs: [
    { type: 'text', id: 'classics', name: 'Classic Texts' },
  ],
  contract: {
    version: '1.0.0' as const,
    protocol: { version: '1.0.0' as const, range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { title: 'Library', body: 'Texts.', fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming' as const, method: 'GET' as const, path: '/catalog/{type}/{catalogId}.json', purpose: 'Lists texts.', resource: 'catalog', returns: stringPayload('Catalog items.') },
      { id: 'search', direction: 'incoming' as const, method: 'GET' as const, path: '/search/{type}/{query}.json', purpose: 'Searches texts.', resource: 'search', receives: stringPayload('Searched term.'), returns: stringPayload('Found items.') },
      { id: 'text', direction: 'incoming' as const, method: 'GET' as const, path: '/text/{type}/{id}.json', purpose: 'Lists text versions.', resource: 'text', receives: stringPayload('Text identifier.'), returns: stringPayload('Text versions.') },
    ],
    logs: [],
  },
});

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
      id: 'empty',
      version: '1.0.0',
      name: 'Empty',
      description: 'No services or resources',
      author: 'X',
      license: 'MIT',
      ui: { title: 'Empty', body: 'No capability.' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services') || e.includes('resources') || e.includes('contract'))).toBe(true);
  });

  it('returns invalid when a resource has an unknown name', () => {
    const result = validateManifest({
      ...stremioManifest,
      contract: { ...stremioManifest.contract, resources: [{ name: 'banana', types: ['text'] }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('resources'))).toBe(true);
  });

  it('returns invalid when a resource has no types', () => {
    const result = validateManifest({
      ...stremioManifest,
      contract: { ...stremioManifest.contract, resources: [{ name: 'search', types: [] }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('resources'))).toBe(true);
  });

  it('returns invalid when resource languages are not a non-empty list', () => {
    const result = validateManifest({
      ...stremioManifest,
      contract: { ...stremioManifest.contract, resources: [{ name: 'search', types: ['text'], languages: [''] }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('languages'))).toBe(true);
  });

  it('returns invalid when catalogs reference an unknown type', () => {
    const result = validateManifest({
      ...stremioManifest,
      contract: { ...stremioManifest.contract, catalogs: [{ type: 'movie', id: 'top', name: 'Movies' }] },
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

  it('returns invalid when the tab is incomplete', () => {
    const result = validateManifest({ ...validManifest, contract: { ...validManifest.contract, ui: { ...validManifest.contract.ui, body: '' } } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ui'))).toBe(true);
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
    const result = validateManifest({ ...validManifest, contract: { ...validManifest.contract, services: [] } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services'))).toBe(true);
  });

  it('returns invalid when a service is missing fields', () => {
    const result = validateManifest({
      ...validManifest,
      contract: { ...validManifest.contract, services: [{ id: 'only-id' }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('services'))).toBe(true);
  });

  it('accepts a SemVer range for a consumed service', () => {
    const result = validateManifest({
      ...validManifest,
      contract: {
        ...validManifest.contract,
        services: [
          ...validManifest.contract.services,
          { id: 'addons.shared.search', role: 'consumes', version: '^1.0.0', name: 'Search', description: 'Shared search.', methods: [] },
        ],
      },
    });
    expect(result.valid).toBe(true);
  });

  it('requires an exact version for a provided service', () => {
    const result = validateManifest({
      ...validManifest,
      contract: {
        ...validManifest.contract,
        services: validManifest.contract.services.map((service) => ({ ...service, version: '^1.0.0' })),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('exact version'))).toBe(true);
  });

  it('returns invalid when the interaction contract is absent', () => {
    const { contract: _contract, ...withoutContract } = validManifest;
    const result = validateManifest(withoutContract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'contract' is required");
  });

  it('returns invalid when legacy fields are placed outside contract', () => {
    const result = validateManifest({ ...validManifest, ui: { title: 'legacy', body: 'do not use' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.toLowerCase().includes('legacy'))).toBe(true);
  });

  it('returns invalid when a tab action receives a field that was not declared', () => {
    const result = validateManifest({
      ...validManifest,
      contract: {
        ...processInteractions,
        ui: {
          ...processInteractions.ui,
          actions: [{ ...processInteractions.ui.actions[0], receives: ['unknown'] }],
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('receives'))).toBe(true);
  });

  it('returns invalid when the executable tab introduces an undeclared action', () => {
    const result = validateTabContract(validManifest as unknown as Record<string, unknown>, {
      fields: [{ id: 'name', label: 'Name', required: true }],
      actions: [{ id: 'remove', label: 'Remove' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('action not present'))).toBe(true);
  });

  it('passes only the fields declared by an action to the add-on', () => {
    const input = validateTabActionInput(processInteractions, 'greet', { name: 'Ana', ignored: 'do not send' });
    expect(input).toEqual({ valid: true, errors: [], values: { name: 'Ana' } });
  });

  it('blocks a state key that the add-on did not declare', async () => {
    const values = new Map<string, unknown>();
    const stateStore = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      set: async <T>(key: string, value: T) => { values.set(key, value); },
      remove: async (key: string) => { values.delete(key); },
      listKeys: async () => [...values.keys()],
      clear: async () => { values.clear(); },
    };
    const access = createContractServiceAccess({ get: <T,>() => stateStore as unknown as T }, {
      ...processInteractions,
      services: [...processInteractions.services, { id: 'state-store', role: 'consumes', version: '1.0.0', name: 'State store', description: 'Optional state.', methods: [{ id: 'get', description: 'Reads.' }, { id: 'set', description: 'Writes.' }] }],
      state: [{ id: 'tab', description: 'Tab state.', key: 'hello:tab', operations: ['read', 'write'], value: stringPayload('Tab state.'), retention: 'Temporary.', deletionTrigger: 'Cleanup.', fallback: 'memory' }],
    });
    const guarded = access.use<typeof stateStore>({ id: 'state-store' })!;
    await guarded.set('hello:tab', 'ok');
    expect(() => guarded.set('other:tab', 'blocked')).toThrow('State operation not declared');
  });
});
