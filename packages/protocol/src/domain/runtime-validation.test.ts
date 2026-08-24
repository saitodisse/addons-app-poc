import { describe, expect, it } from 'vitest';
import {
  checkContractCompatibility,
  checkServiceCompatibility,
  createContractServiceAccess,
  getInteractionContractFingerprint,
  semverSatisfies,
} from './contract';
import { validateLogEvent, validateTabResult, validateValueAgainstSchema } from './runtime-validation';
import type { AddonInteractionContract } from './contract';

const textSchema = { type: 'string', description: 'Texto', classification: 'public' as const };

const contract: AddonInteractionContract = {
  version: '1.0.0',
  protocol: { version: '1.0.0', range: '^1.0.0' },
  capabilities: { required: ['registry.services'], optional: ['logs'] },
  services: [{
    id: 'addons.test.echo', role: 'provides', version: '1.0.0', name: 'Echo', description: 'Repete texto.',
    methods: [{ id: 'echo', description: 'Repete.', receives: { description: 'Entrada.', schema: textSchema }, returns: { description: 'Saída.', schema: textSchema } }],
  }],
  ui: { title: 'Teste', body: 'Teste', fields: [], actions: [] },
  state: [],
  http: [],
  logs: [{ id: 'event', level: 'info', message: 'Evento', description: 'Evento de teste.' }],
};

describe('runtime validation and service negotiation', () => {
  it('negocia SemVer, capabilities, methods and schemas', () => {
    expect(semverSatisfies('1.2.0', '^1.0.0')).toBe(true);
    expect(semverSatisfies('2.0.0', '^1.0.0')).toBe(false);
    expect(semverSatisfies('0.2.4', '^0.2.0')).toBe(true);
    expect(semverSatisfies('0.3.0', '^0.2.0')).toBe(false);
    expect(checkContractCompatibility(contract, {
      protocolVersion: '1.0.0',
      capabilities: new Set(['registry.services', 'ui.tab', 'logs']),
      services: new Map([['addons.test.echo', { version: '1.0.0', methods: new Map([['echo', { receives: { description: 'Entrada.', schema: textSchema }, returns: { description: 'Saída.', schema: textSchema } }]]) }]]),
    }).compatible).toBe(true);
    expect(checkServiceCompatibility(contract.services[0]!, { id: 'addons.test.echo', version: '1.0.0', methods: new Set(['other']) }).compatible).toBe(false);
  });

  it('mediates arguments and outputs through services.use', async () => {
    const access = createContractServiceAccess({ get: <T,>() => ({ echo: async (value: string) => value.toUpperCase(), secret: () => 'não exposto' }) as unknown as T }, contract);
    const echo = access.use<{ echo(value: string): Promise<string> }>({ id: 'addons.test.echo' })!;
    await expect(echo.echo('ok')).resolves.toBe('OK');
    expect(() => echo.echo(42 as unknown as string)).toThrow('Entrada rejeitada');
    expect((echo as { secret?: () => string }).secret).toBeUndefined();
  });

  it('não aplica a política de estado de um provedor ao próprio serviço', async () => {
    const stateStore = {
      get: async <T,>(_key: string) => 42 as T,
      set: async <T,>(_key: string, _value: T) => {},
      remove: async (_key: string) => {},
      listKeys: async () => [],
      clear: async () => {},
    };
    const providerContract: AddonInteractionContract = {
      ...contract,
      services: [{ id: 'state-store', role: 'provides', version: '1.0.0', name: 'State store', description: 'Armazena estado.', methods: [{ id: 'get', description: 'Lê.' }] }],
      state: [{ id: 'objects', description: 'Estado do provedor.', keyPattern: '*', operations: ['read'], value: { description: 'Objeto.', schema: { type: 'object', description: 'Objeto.', classification: 'personal' } }, retention: 'Sessão.', deletionTrigger: 'Limpeza.' }],
    };
    const access = createContractServiceAccess({ get: <T,>() => stateStore as unknown as T }, providerContract);
    await expect(access.use<typeof stateStore>({ id: 'state-store' })?.get<number>('counter:value')).resolves.toBe(42);
  });

  it('validates schema, logs and tab results', () => {
    expect(validateValueAgainstSchema('ok', textSchema).valid).toBe(true);
    expect(validateValueAgainstSchema(42, textSchema).valid).toBe(false);
    expect(validateLogEvent(contract, 'debug', 'x').valid).toBe(false);
    expect(validateTabResult({ status: 'success', body: 'ok', items: [{ label: 'x', value: 'y', details: { complete: true } }] }).valid).toBe(true);
    expect(validateTabResult({ status: 'success' }).valid).toBe(false);
  });

  it('normaliza campos undefined para comparar manifesto JSON e bundle', () => {
    expect(getInteractionContractFingerprint({ ...contract, resources: undefined })).toBe(getInteractionContractFingerprint(contract));
  });
});
