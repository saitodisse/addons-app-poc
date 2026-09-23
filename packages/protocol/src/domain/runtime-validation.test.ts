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

const textSchema = { type: 'string', description: 'Text', classification: 'public' as const };

const contract: AddonInteractionContract = {
  version: '1.0.0',
  protocol: { version: '1.0.0', range: '^1.0.0' },
  capabilities: { required: ['registry.services'], optional: ['logs'] },
  services: [{
    id: 'addons.test.echo', role: 'provides', version: '1.0.0', name: 'Echo', description: 'Repeats text.',
    methods: [{ id: 'echo', description: 'Repeats.', receives: { description: 'Input.', schema: textSchema }, returns: { description: 'Output.', schema: textSchema } }],
  }],
  ui: { title: 'Test', body: 'Test', fields: [], actions: [] },
  state: [],
  http: [],
  logs: [{ id: 'event', level: 'info', message: 'Event', description: 'Test event.' }],
};

describe('runtime validation and service negotiation', () => {
  it('negotiates SemVer, capabilities, methods, and schemas', () => {
    expect(semverSatisfies('1.2.0', '^1.0.0')).toBe(true);
    expect(semverSatisfies('2.0.0', '^1.0.0')).toBe(false);
    expect(semverSatisfies('0.2.4', '^0.2.0')).toBe(true);
    expect(semverSatisfies('0.3.0', '^0.2.0')).toBe(false);
    expect(checkContractCompatibility(contract, {
      protocolVersion: '1.0.0',
      capabilities: new Set(['registry.services', 'ui.tab', 'logs']),
      services: new Map([['addons.test.echo', { version: '1.0.0', methods: new Map([['echo', { receives: { description: 'Input.', schema: textSchema }, returns: { description: 'Output.', schema: textSchema } }]]) }]]),
    }).compatible).toBe(true);
    expect(checkServiceCompatibility(contract.services[0]!, { id: 'addons.test.echo', version: '1.0.0', methods: new Set(['other']) }).compatible).toBe(false);
  });

  it('mediates arguments and outputs through services.use', async () => {
    const access = createContractServiceAccess({ get: <T,>() => ({ echo: async (value: string) => value.toUpperCase(), secret: () => 'not exposed' }) as unknown as T }, contract);
    const echo = access.use<{ echo(value: string): Promise<string> }>({ id: 'addons.test.echo' })!;
    await expect(echo.echo('ok')).resolves.toBe('OK');
    expect(() => echo.echo(42 as unknown as string)).toThrow('Input rejected');
    expect((echo as { secret?: () => string }).secret).toBeUndefined();
  });

  it('does not apply a provider state policy to its own service', async () => {
    const stateStore = {
      get: async <T,>(_key: string) => 42 as T,
      set: async <T,>(_key: string, _value: T) => {},
      remove: async (_key: string) => {},
      listKeys: async () => [],
      clear: async () => {},
    };
    const providerContract: AddonInteractionContract = {
      ...contract,
      services: [{ id: 'state-store', role: 'provides', version: '1.0.0', name: 'State store', description: 'Stores state.', methods: [{ id: 'get', description: 'Reads.' }] }],
      state: [{ id: 'objects', description: 'Provider state.', keyPattern: '*', operations: ['read'], value: { description: 'Object.', schema: { type: 'object', description: 'Object.', classification: 'personal' } }, retention: 'Session.', deletionTrigger: 'Cleanup.' }],
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

  it('accepts control values returned by an action', () => {
    expect(validateTabResult({ status: 'success', body: 'ok', values: { fontSize: '22' } }).valid).toBe(true);
    expect(validateTabResult({ status: 'success', body: 'ok', values: {} }).valid).toBe(true);
    expect(validateTabResult({ status: 'success', body: 'ok', values: { fontSize: 22 } }).valid).toBe(false);
    expect(validateTabResult({ status: 'success', body: 'ok', values: ['22'] }).valid).toBe(false);
  });

  it('accepts a rendered view and rejects a malformed one', () => {
    expect(validateTabResult({ status: 'success', body: 'ok', view: { kind: 'text' } }).valid).toBe(true);
    expect(validateTabResult({ status: 'success', body: 'ok', view: { kind: 'html', html: '<p>chart</p>' } }).valid).toBe(true);
    expect(validateTabResult({ status: 'success', body: 'ok', view: { kind: 'html' } }).valid).toBe(false);
    expect(validateTabResult({ status: 'success', body: 'ok', view: { kind: 'html', html: '   ' } }).valid).toBe(false);
    expect(validateTabResult({ status: 'success', body: 'ok', view: { kind: 'image' } }).valid).toBe(false);
  });

  it('normalizes undefined fields when comparing manifest JSON and bundle', () => {
    expect(getInteractionContractFingerprint({ ...contract, resources: undefined })).toBe(getInteractionContractFingerprint(contract));
  });
});
