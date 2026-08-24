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
  services: [{ id: 'addons.hello.greeter', role: 'provides' as const, version: '1.0.0', name: 'Greeter', description: 'Cria saudações.', methods: [{ id: 'greet', description: 'Saúda um nome.', receives: stringPayload('Nome.'), returns: stringPayload('Saudação.') }] }],
  ui: {
    title: 'Hello', body: 'Uma saudação.',
    fields: [{ id: 'name', label: 'Nome', description: 'Nome para a saudação.', required: true, schema: stringPayload('Nome informado.').schema }],
    actions: [{ id: 'greet', label: 'Saudar', description: 'Cria uma saudação.', receives: ['name'], returns: stringPayload('Saudação criada.') }],
  },
  state: [],
  http: [],
  logs: [],
};

const validManifest = defineAddonManifest({
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Um add-on simples',
  author: 'Joaquim',
  license: 'MIT',
  ui: { title: 'Hello', body: 'Uma saudação.' },
  entrypoint: 'https://example.com/bundle.js',
  services: [
    { id: 'addons.hello.greeter', version: '1.0.0', name: 'Greeter', description: 'Saudação' },
  ],
  contract: processInteractions,
});

// Manifesto estilo Stremio: add-on servido por HTTP com resources (como o Torrentio)
const stremioManifest = defineAddonManifest({
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo e busca de textos',
  author: 'Equipe AC',
  license: 'MIT',
  ui: { title: 'Biblioteca', body: 'Textos para leitura.' },
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
  contract: {
    version: '1.0.0' as const,
    protocol: { version: '1.0.0' as const, range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { title: 'Biblioteca', body: 'Textos.', fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming' as const, method: 'GET' as const, path: '/catalog/{type}/{catalogId}.json', purpose: 'Lista textos.', resource: 'catalog', returns: stringPayload('Itens do catálogo.') },
      { id: 'search', direction: 'incoming' as const, method: 'GET' as const, path: '/search/{type}/{query}.json', purpose: 'Busca textos.', resource: 'search', receives: stringPayload('Termo buscado.'), returns: stringPayload('Itens encontrados.') },
      { id: 'text', direction: 'incoming' as const, method: 'GET' as const, path: '/text/{type}/{id}.json', purpose: 'Lista versões do texto.', resource: 'text', receives: stringPayload('Identificador do texto.'), returns: stringPayload('Versões do texto.') },
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
      id: 'vazio',
      version: '1.0.0',
      name: 'Vazio',
      description: 'Sem serviços nem recursos',
      author: 'X',
      license: 'MIT',
      ui: { title: 'Vazio', body: 'Sem capacidade.' },
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

  it('returns invalid when catalogs reference an unknown type', () => {
    const result = validateManifest({
      ...stremioManifest,
      contract: { ...stremioManifest.contract, catalogs: [{ type: 'filme', id: 'top', name: 'Filmes' }] },
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
          { id: 'addons.shared.search', role: 'consumes', version: '^1.0.0', name: 'Search', description: 'Busca compartilhada.', methods: [] },
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
    expect(result.errors.some((error) => error.includes('versão exata'))).toBe(true);
  });

  it('returns invalid when the interaction contract is absent', () => {
    const { contract: _contract, ...withoutContract } = validManifest;
    const result = validateManifest(withoutContract);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Campo 'contract' é obrigatório");
  });

  it('returns invalid when legacy fields are placed outside contract', () => {
    const result = validateManifest({ ...validManifest, ui: { title: 'legado', body: 'não usar' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('legado'))).toBe(true);
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
      fields: [{ id: 'name', label: 'Nome', required: true }],
      actions: [{ id: 'remove', label: 'Remover' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('ação não presente'))).toBe(true);
  });

  it('passes only the fields declared by an action to the add-on', () => {
    const input = validateTabActionInput(processInteractions, 'greet', { name: 'Ana', ignored: 'não enviar' });
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
      services: [...processInteractions.services, { id: 'state-store', role: 'consumes', version: '1.0.0', name: 'State store', description: 'Estado opcional.', methods: [{ id: 'get', description: 'Lê.' }, { id: 'set', description: 'Grava.' }] }],
      state: [{ id: 'tab', description: 'Estado da aba.', key: 'hello:tab', operations: ['read', 'write'], value: stringPayload('Estado da aba.'), retention: 'Temporário.', deletionTrigger: 'Limpeza.', fallback: 'memory' }],
    });
    const guarded = access.use<typeof stateStore>({ id: 'state-store' })!;
    await guarded.set('hello:tab', 'ok');
    expect(() => guarded.set('other:tab', 'bloqueado')).toThrow('Operação de estado não declarada');
  });
});
