export const INTERACTION_CONTRACT_VERSION = '1.0.0';

export type DataClassification = string;

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
  role: string;
  description: string;
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
  version: string;
  services: ServiceInteraction[];
  tab: {
    fields: TabFieldInteraction[];
    actions: TabActionInteraction[];
  };
  state: StateInteraction[];
  http: HttpInteraction[];
  logs: LogInteraction[];
}

export interface AddonServiceAccess {
  get<T>(serviceId: string): T | undefined;
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

function guardedStateStore(store: StateStoreLike, contract: AddonInteractionContract): StateStoreLike {
  return {
    get: <T>(key: string) => {
      ensureStateOperation(contract, 'read', key);
      return store.get<T>(key);
    },
    set: <T>(key: string, value: T) => {
      ensureStateOperation(contract, 'write', key);
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
  const allowedIds = new Set(contract.services.map((service) => service.id));
  return {
    get<T>(serviceId: string): T | undefined {
      if (!allowedIds.has(serviceId)) {
        throw new Error(`Serviço não declarado como consumido ou fornecido no contrato: ${serviceId}`);
      }
      const service = registry.get<T>(serviceId);
      if (serviceId === 'addonStateStore' && service) {
        return guardedStateStore(service as unknown as StateStoreLike, contract) as T;
      }
      return service;
    },
  };
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
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
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
  const action = contract.tab.actions.find((candidate) => candidate.id === actionId);
  if (!action) return { valid: false, errors: [`Ação não declarada no contrato: ${actionId}`], values: {} };
  const allowed = new Set(action.receives ?? []);
  const filtered = Object.fromEntries(Object.entries(values).filter(([id]) => allowed.has(id)));
  const errors: string[] = [];
  for (const fieldId of allowed) {
    const field = contract.tab.fields.find((candidate) => candidate.id === fieldId);
    if (!field) {
      errors.push(`Ação ${actionId} referencia o campo ausente ${fieldId}`);
      continue;
    }
    const value = filtered[fieldId] ?? '';
    if (field.required && !value.trim()) errors.push(`Preencha o campo “${field.label}”.`);
    if (value && field.schema.format === 'uri') {
      try {
        new URL(value);
      } catch {
        errors.push(`Informe uma URL válida no campo “${field.label}”.`);
      }
    }
  }
  return { valid: errors.length === 0, errors, values: filtered };
}
