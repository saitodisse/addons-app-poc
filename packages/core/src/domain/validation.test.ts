import { describe, expect, it } from 'vitest';
import { validateManifest, validateTabContract } from './validation';
import { createContractServiceAccess, validateTabActionInput } from './interactions';

const stringPayload = (description: string) => ({
  description,
  schema: { type: 'string', description, classification: 'public' as const },
});

const processInteractions = {
  version: '1.0.0' as const,
  services: [{ id: 'greeter', role: 'provides' as const, description: 'Cria saudações.' }],
  tab: {
    fields: [{ id: 'name', label: 'Nome', description: 'Nome para a saudação.', required: true, schema: stringPayload('Nome informado.').schema }],
    actions: [{ id: 'greet', label: 'Saudar', description: 'Cria uma saudação.', receives: ['name'], returns: stringPayload('Saudação criada.') }],
  },
  state: [],
  http: [],
  logs: [],
};

const validManifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Um add-on simples',
  author: 'Joaquim',
  license: 'MIT',
  tab: { title: 'Hello', body: 'Uma saudação.' },
  entrypoint: 'https://example.com/bundle.js',
  services: [
    { id: 'greeter', version: '1.0.0', name: 'Greeter', description: 'Saudação' },
  ],
  interactions: processInteractions,
};

// Manifesto estilo Stremio: add-on servido por HTTP com resources (como o Torrentio)
const stremioManifest = {
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo e busca de textos',
  author: 'Equipe AC',
  license: 'MIT',
  tab: { title: 'Biblioteca', body: 'Textos para leitura.' },
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
  interactions: {
    version: '1.0.0' as const,
    services: [],
    tab: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming' as const, method: 'GET' as const, path: '/catalog/{type}/{catalogId}.json', purpose: 'Lista textos.', resource: 'catalog', returns: stringPayload('Itens do catálogo.') },
      { id: 'search', direction: 'incoming' as const, method: 'GET' as const, path: '/search/{type}/{query}.json', purpose: 'Busca textos.', resource: 'search', receives: stringPayload('Termo buscado.'), returns: stringPayload('Itens encontrados.') },
      { id: 'text', direction: 'incoming' as const, method: 'GET' as const, path: '/text/{type}/{id}.json', purpose: 'Lista versões do texto.', resource: 'text', receives: stringPayload('Identificador do texto.'), returns: stringPayload('Versões do texto.') },
    ],
    logs: [],
  },
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
      tab: { title: 'Vazio', body: 'Sem capacidade.' },
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

  it('returns invalid when the tab is incomplete', () => {
    const result = validateManifest({ ...validManifest, tab: { title: 'Sem corpo' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tab'))).toBe(true);
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

  it('returns invalid when the interaction contract is absent', () => {
    const { interactions: _interactions, ...withoutInteractions } = validManifest;
    const result = validateManifest(withoutInteractions);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('interactions é obrigatório e deve ser um objeto');
  });

  it('returns invalid when a tab action receives a field that was not declared', () => {
    const result = validateManifest({
      ...validManifest,
      interactions: {
        ...processInteractions,
        tab: {
          ...processInteractions.tab,
          actions: [{ ...processInteractions.tab.actions[0], receives: ['unknown'] }],
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('receives'))).toBe(true);
  });

  it('returns invalid when the executable tab introduces an undeclared action', () => {
    const result = validateTabContract(validManifest, {
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
    const access = createContractServiceAccess({ get: () => stateStore }, {
      ...processInteractions,
      services: [...processInteractions.services, { id: 'addonStateStore', role: 'consumes', description: 'Estado opcional.' }],
      state: [{ id: 'tab', description: 'Estado da aba.', key: 'hello:tab', operations: ['read', 'write'], value: stringPayload('Estado da aba.'), retention: 'Temporário.', deletionTrigger: 'Limpeza.', fallback: 'memory' }],
    });
    const guarded = access.get<typeof stateStore>('addonStateStore')!;
    await guarded.set('hello:tab', 'ok');
    expect(() => guarded.set('other:tab', 'bloqueado')).toThrow('Operação de estado não declarada');
  });
});
