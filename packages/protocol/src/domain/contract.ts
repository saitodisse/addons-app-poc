/** Versão do protocolo público. Mudanças incompatíveis exigem uma major nova. */
import { validateServiceCallInput, validateServiceCallOutput, validateStateValue, validateValueAgainstSchema } from './runtime-validation';

export const PROTOCOL_VERSION = '1.0.0';
export const INTERACTION_CONTRACT_VERSION = PROTOCOL_VERSION;

export type DataClassification = 'public' | 'personal' | 'secret';

/** Subconjunto declarativo de JSON Schema aceito pelo protocolo. */
export interface InteractionSchema {
  type: string;
  description: string;
  classification: DataClassification;
  format?: string;
  enum?: Array<string | number | boolean | null>;
  properties?: Record<string, InteractionSchema>;
  required?: string[];
  items?: InteractionSchema;
}

export interface InteractionPayload {
  description: string;
  schema: InteractionSchema;
}

export interface ServiceInteraction {
  id: string;
  role: 'provides' | 'consumes';
  description: string;
  /** Versão exata do provedor ou faixa SemVer exigida por um consumidor. */
  version?: string;
  /** Nome legível do descritor serializado. */
  name?: string;
  /** Prioridade determinística do provedor; maior valor vence. */
  priority?: number;
  required?: boolean;
  methods?: Array<{
    id: string;
    description: string;
    receives?: InteractionPayload;
    returns?: InteractionPayload;
  }>;
}

export interface TabFieldInteraction {
  id: string;
  label: string;
  description: string;
  required?: boolean;
  schema: InteractionSchema;
}

export interface TabActionInteraction {
  id: string;
  label: string;
  description: string;
  receives?: string[];
  returns: InteractionPayload;
}

export interface StateInteraction {
  id: string;
  description: string;
  key?: string;
  keyPattern?: string;
  operations: string[];
  value: InteractionPayload;
  retention: string;
  deletionTrigger: string;
  fallback?: string;
}

export interface HttpInteraction {
  id: string;
  direction: string;
  method: string;
  path: string;
  origin?: string;
  purpose: string;
  receives?: InteractionPayload;
  returns: InteractionPayload;
  resource?: string;
}

export interface LogInteraction {
  id: string;
  level: string;
  message: string;
  description: string;
  details?: InteractionPayload;
}

export interface AddonInteractionContract {
  /** Perfil da especificação do protocolo. */
  version: typeof PROTOCOL_VERSION;
  /** Faixa SemVer do protocolo que o add-on aceita. */
  protocol?: { version: typeof PROTOCOL_VERSION; range: string };
  /** Capacidades canônicas exigidas ou opcionais no host. */
  capabilities?: { required: string[]; optional: string[] };
  services: ServiceInteraction[];
  ui: {
    title?: string;
    body?: string;
    fields: TabFieldInteraction[];
    actions: TabActionInteraction[];
  };
  state: StateInteraction[];
  http: HttpInteraction[];
  logs: LogInteraction[];
  resources?: import('./manifest').AddonResource[];
  types?: string[];
  idPrefixes?: string[];
  catalogs?: import('./manifest').AddonCatalog[];
}

/** Nome público do contrato; o alias antigo só existe dentro da migração desta POC. */
export type AddonContract = AddonInteractionContract;

export interface AddonServiceAccess {
  /** Obtém uma implementação compatível com o descritor solicitado. */
  use<T>(contract: ServiceContractRef): T | undefined;
}

export interface ServiceContractRef {
  id: string;
  version?: string;
  methods?: Array<{
    id: string;
    receives?: InteractionPayload;
    returns?: InteractionPayload;
  }>;
}

interface StateStoreLike {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

interface ServiceReader {
  get<T>(serviceId: string): T | undefined;
}

function stateMatches(state: StateInteraction, key: string): boolean {
  return state.key === key || state.keyPattern === '*' || (typeof state.keyPattern === 'string' && state.keyPattern.endsWith('*') && key.startsWith(state.keyPattern.slice(0, -1)));
}

function ensureStateOperation(contract: AddonInteractionContract, operation: string, key?: string): void {
  const allowed = contract.state.some((state) => state.operations.includes(operation) && (key === undefined || stateMatches(state, key)));
  if (!allowed) throw new Error(`Operação de estado não declarada no contrato: ${operation}${key ? ` ${key}` : ''}`);
}

function assertRuntime(valid: { valid: boolean; errors: string[] }, context: string): void {
  if (!valid.valid) throw new Error(`${context}: ${valid.errors.join('; ')}`);
}

function guardedStateStore(store: StateStoreLike, contract: AddonInteractionContract): StateStoreLike {
  return {
    get: <T>(key: string) => {
      ensureStateOperation(contract, 'read', key);
      return store.get<T>(key).then((value) => {
        if (value !== undefined) assertRuntime(validateStateValue(contract, key, value), 'Estado incompatível');
        return value;
      });
    },
    set: <T>(key: string, value: T) => {
      ensureStateOperation(contract, 'write', key);
      assertRuntime(validateStateValue(contract, key, value), 'Estado incompatível');
      return store.set(key, value);
    },
    remove: (key: string) => {
      ensureStateOperation(contract, 'remove', key);
      return store.remove(key);
    },
    listKeys: () => {
      ensureStateOperation(contract, 'list');
      return store.listKeys();
    },
    clear: () => {
      ensureStateOperation(contract, 'clear');
      return store.clear();
    },
  };
}

export function assertProvidedService(contract: AddonInteractionContract, serviceId: string): void {
  if (!contract.services.some((service) => service.role === 'provides' && service.id === serviceId)) {
    throw new Error(`Serviço não declarado como fornecido no contrato: ${serviceId}`);
  }
}

/** Entrega ao add-on somente os serviços e chaves de estado declarados por ele. */
export function createContractServiceAccess(registry: ServiceReader, contract: AddonInteractionContract): AddonServiceAccess {
  const declared = new Map(contract.services.map((service) => [service.id, service]));
  const wrapped = new WeakMap<object, unknown>();

  const mediate = <T>(service: T, serviceId: string): T => {
    if ((typeof service !== 'object' || service === null) && typeof service !== 'function') return service;
    const objectService = service as object;
    const cached = wrapped.get(objectService);
    if (cached) return cached as T;
    const proxy = new Proxy(service as object, {
      get(target, property, receiver) {
        const member = Reflect.get(target, property, receiver);
        if (typeof property !== 'string' || typeof member !== 'function') return member;
        const declaration = declared.get(serviceId);
        const method = declaration?.methods?.find((item) => item.id === property);
        if (!method) return undefined;
        return (...args: unknown[]) => {
          assertRuntime(validateServiceCallInput(contract, serviceId, property, args), `Entrada rejeitada em ${serviceId}.${property}`);
          const result = member.apply(target, args);
          if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            return (result as PromiseLike<unknown>).then((value) => {
              assertRuntime(validateServiceCallOutput(contract, serviceId, property, value), `Saída rejeitada em ${serviceId}.${property}`);
              return value;
            });
          }
          assertRuntime(validateServiceCallOutput(contract, serviceId, property, result), `Saída rejeitada em ${serviceId}.${property}`);
          return result;
        };
      },
    });
    wrapped.set(objectService, proxy);
    return proxy as T;
  };

  return {
    use<T>(requested: ServiceContractRef): T | undefined {
      const declaration = declared.get(requested.id);
      if (!declaration) {
        throw new Error(`Serviço não declarado como consumido ou fornecido no contrato: ${requested.id}`);
      }
      if (requested.version && declaration.role === 'provides' && declaration.version && !semverSatisfies(declaration.version, requested.version)) {
        throw new Error(`Versão incompatível do serviço ${requested.id}: solicitado ${requested.version}, declarado ${declaration.version}`);
      }
      for (const method of requested.methods ?? []) {
        const declaredMethod = declaration.methods?.find((candidate) => candidate.id === method.id);
        if (!declaredMethod) throw new Error(`Método não declarado no contrato: ${requested.id}.${method.id}`);
        if (method.receives && (!declaredMethod.receives || stableJson(method.receives.schema) !== stableJson(declaredMethod.receives.schema))) {
          throw new Error(`Entrada incompatível no contrato: ${requested.id}.${method.id}`);
        }
        if (method.returns && (!declaredMethod.returns || stableJson(method.returns.schema) !== stableJson(declaredMethod.returns.schema))) {
          throw new Error(`Saída incompatível no contrato: ${requested.id}.${method.id}`);
        }
      }
      const service = registry.get<T>(requested.id);
      if (requested.id === 'state-store' && service && declaration.role === 'consumes') {
        return mediate(guardedStateStore(service as unknown as StateStoreLike, contract), requested.id) as T;
      }
      if (requested.id === 'state-store' && service && declaration.role === 'provides') return service;
      return service === undefined ? undefined : mediate(service, requested.id);
    },
  };
}

/** Faixa mínima de SemVer usada pelo protocolo, sem dependência de runtime. */
export function parseSemVer(value: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function semverSatisfies(version: string, range: string): boolean {
  const parsed = parseSemVer(version);
  if (!parsed) return false;
  const normalized = range.trim();
  if (normalized === '*' || normalized === '') return true;
  const exact = parseSemVer(normalized);
  if (exact) return parsed.every((part, index) => part === exact[index]);
  const caret = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (caret) {
    const major = Number(caret[1]);
    const minor = Number(caret[2]);
    const patch = Number(caret[3]);
    if (parsed[0] !== major) return false;
    if (major > 0) return parsed[1] > minor || (parsed[1] === minor && parsed[2] >= patch);
    if (minor > 0) return parsed[1] === minor && parsed[2] >= patch;
    return parsed[1] === 0 && parsed[2] === patch;
  }
  const tilde = /^~(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (tilde) return parsed[0] === Number(tilde[1]) && parsed[1] === Number(tilde[2]) && parsed[2] >= Number(tilde[3]);
  return false;
}

export interface HostCompatibility {
  protocolVersion: string;
  capabilities: ReadonlySet<string>;
  services: ReadonlyMap<string, { version: string; methods: ReadonlySet<string> | ReadonlyMap<string, { receives?: InteractionPayload; returns?: InteractionPayload }> }>;
}

export interface CompatibilityResult {
  compatible: boolean;
  errors: string[];
}

export interface ServiceCompatibilityDescriptor {
  id: string;
  version: string;
  methods: ReadonlyMap<string, { receives?: InteractionPayload; returns?: InteractionPayload }> | ReadonlySet<string>;
}

/** Compara um consumidor com um provedor do mesmo identificador. */
export function checkServiceCompatibility(required: ServiceInteraction, provided: ServiceCompatibilityDescriptor): CompatibilityResult {
  const errors: string[] = [];
  if (required.id !== provided.id) errors.push(`Identificador de serviço incompatível: ${required.id}`);
  if (required.version && !semverSatisfies(provided.version, required.version)) errors.push(`Versão incompatível do serviço ${required.id}`);
  for (const method of required.methods ?? []) {
    const providedMethod = provided.methods instanceof Map
      ? provided.methods.get(method.id)
      : provided.methods.has(method.id) ? {} : undefined;
    if (providedMethod === undefined) {
      errors.push(`Método ausente em ${required.id}: ${method.id}`);
      continue;
    }
    const providedReceives = 'receives' in providedMethod ? providedMethod.receives : undefined;
    const providedReturns = 'returns' in providedMethod ? providedMethod.returns : undefined;
    if (method.receives && (!providedReceives || stableJson(method.receives.schema) !== stableJson(providedReceives.schema))) {
      errors.push(`Entrada incompatível em ${required.id}.${method.id}`);
    }
    if (method.returns && (!providedReturns || stableJson(method.returns.schema) !== stableJson(providedReturns.schema))) {
      errors.push(`Saída incompatível em ${required.id}.${method.id}`);
    }
  }
  return { compatible: errors.length === 0, errors };
}

/** Negocia protocolo, capacidades e dependências obrigatórias antes da execução. */
export function checkContractCompatibility(contract: AddonInteractionContract, host: HostCompatibility): CompatibilityResult {
  const errors: string[] = [];
  if (contract.version !== PROTOCOL_VERSION) errors.push(`Versão do contrato não suportada: ${contract.version}`);
  if (contract.protocol?.version !== PROTOCOL_VERSION) errors.push(`Versão do protocolo não suportada: ${contract.protocol?.version ?? 'ausente'}`);
  const range = contract.protocol?.range ?? '^1.0.0';
  if (!semverSatisfies(host.protocolVersion, range)) errors.push(`Host não atende à faixa de protocolo ${range}`);
  for (const capability of contract.capabilities?.required ?? []) {
    if (!host.capabilities.has(capability)) errors.push(`Capacidade obrigatória ausente: ${capability}`);
  }
  for (const service of contract.services.filter((item) => item.role === 'consumes' && item.required !== false)) {
    const provided = host.services.get(service.id);
    if (!provided) {
      errors.push(`Serviço obrigatório ausente: ${service.id}`);
      continue;
    }
    errors.push(...checkServiceCompatibility(service, { id: service.id, version: provided.version, methods: provided.methods }).errors);
  }
  return { compatible: errors.length === 0, errors };
}

export function getStateDestination(contract: AddonInteractionContract, availableProviders: ReadonlySet<string>): string {
  if (contract.state.length === 0) return 'Não persiste estado próprio.';
  if (availableProviders.has('storage-local')) return 'localStorage deste navegador (`addons:state:*`)';
  if (availableProviders.has('storage-session')) return 'sessionStorage desta aba (`addons:state:*`)';
  return contract.state.some((state) => state.fallback === 'memory')
    ? 'memória temporária; será perdido ao recarregar'
    : 'nenhum destino disponível';
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return value === undefined ? 'null' : JSON.stringify(value);
}

/** Identifica mudanças declaradas; não substitui assinatura ou verificação de integridade. */
export function getInteractionContractFingerprint(contract: AddonInteractionContract): string {
  const source = stableJson(contract);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export interface InteractionInputValidation {
  valid: boolean;
  errors: string[];
  values: Record<string, string>;
}

/** Filtra e valida os valores que uma ação da aba declarou poder receber. */
export function validateTabActionInput(contract: AddonInteractionContract, actionId: string, values: Record<string, string>): InteractionInputValidation {
  const action = contract.ui.actions.find((candidate) => candidate.id === actionId);
  if (!action) return { valid: false, errors: [`Ação não declarada no contrato: ${actionId}`], values: {} };
  const allowed = new Set(action.receives ?? []);
  const filtered = Object.fromEntries(Object.entries(values).filter(([id]) => allowed.has(id)));
  const errors: string[] = [];
  for (const fieldId of allowed) {
    const field = contract.ui.fields.find((candidate) => candidate.id === fieldId);
    if (!field) {
      errors.push(`Ação ${actionId} referencia o campo ausente ${fieldId}`);
      continue;
    }
    const value = filtered[fieldId] ?? '';
    if (field.required && !value.trim()) errors.push(`Preencha o campo “${field.label}”.`);
    if (value || field.required) {
      errors.push(...validateValueAgainstSchema(value, field.schema, `Campo “${field.label}”`).errors);
    }
  }
  return { valid: errors.length === 0, errors, values: filtered };
}
