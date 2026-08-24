export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TabContractShape {
  fields?: Array<{ id: string; label: string; required?: boolean }>;
  actions?: Array<{ id: string; label: string }>;
}

const VALID_RESOURCE_NAMES = ['catalog', 'search', 'text', 'meta', 'subtitles', 'stream'];
const VALID_SCHEMA_TYPES = ['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'];
const VALID_CLASSIFICATIONS = ['public', 'personal', 'secret'];
const VALID_STATE_OPERATIONS = ['read', 'write', 'remove', 'list', 'clear'];
const OFFICIAL_CAPABILITIES = new Set(['registry.services', 'ui.tab', 'logs', 'state-store']);
const SERVICE_VERSION_PATTERN = /^(?:\^|~)?\d+\.\d+\.\d+$/;
const EXACT_SERVICE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validatePayload(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value) || typeof value.description !== 'string' || !value.description.trim()) {
    errors.push(`${path} deve declarar description`);
    return;
  }
  validateSchema(value.schema, `${path}.schema`, errors);
}

function validateSchema(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) {
    errors.push(`${path} deve ser um objeto JSON Schema`);
    return;
  }
  if (typeof value.type !== 'string' || !VALID_SCHEMA_TYPES.includes(value.type)) {
    errors.push(`${path}.type deve ser um tipo JSON Schema suportado`);
  }
  if (typeof value.description !== 'string' || !value.description.trim()) {
    errors.push(`${path}.description deve explicar o dado`);
  }
  if (typeof value.classification !== 'string' || !VALID_CLASSIFICATIONS.includes(value.classification)) {
    errors.push(`${path}.classification deve ser public, personal ou secret`);
  }
  if (value.properties != null) {
    if (!isObject(value.properties)) {
      errors.push(`${path}.properties deve ser um objeto`);
    } else {
      for (const [name, property] of Object.entries(value.properties)) {
        validateSchema(property, `${path}.properties.${name}`, errors);
      }
    }
  }
  if (value.required != null && (!Array.isArray(value.required) || value.required.some((item) => typeof item !== 'string'))) {
    errors.push(`${path}.required deve ser uma lista de nomes de campos`);
  }
  if (value.items != null) validateSchema(value.items, `${path}.items`, errors);
}

function validateInteractions(manifest: Record<string, unknown>, errors: string[]): void {
  const contract = manifest.contract;
  if (!isObject(contract)) {
    errors.push('contract é obrigatório e deve ser um objeto');
    return;
  }
  if (contract.version !== '1.0.0') {
    errors.push('contract.version deve ser 1.0.0');
  }
  if (!isObject(contract.protocol) || contract.protocol.version !== '1.0.0' || typeof contract.protocol.range !== 'string' || !/^(?:\^|~)?1\.\d+\.\d+$/.test(contract.protocol.range)) {
    errors.push('contract.protocol deve declarar version 1.0.0 e uma faixa SemVer compatível');
  }
  if (!isObject(contract.capabilities) || !Array.isArray(contract.capabilities.required) || !Array.isArray(contract.capabilities.optional)) {
    errors.push('contract.capabilities deve declarar required e optional');
  } else {
    const requiredCapabilities = new Set(contract.capabilities.required);
    for (const [kind, values] of [['required', contract.capabilities.required], ['optional', contract.capabilities.optional]] as const) {
      if (values.some((value) => typeof value !== 'string' || (!OFFICIAL_CAPABILITIES.has(String(value)) && !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(String(value))))) {
        errors.push(`contract.capabilities.${kind} deve usar capacidades oficiais ou nomes namespaceados`);
      }
    }
    if (contract.capabilities.optional.some((value) => requiredCapabilities.has(value))) errors.push('contract.capabilities.required e optional não podem repetir capacidades');
  }

  const services = contract.services;
  if (!Array.isArray(services)) {
    errors.push('contract.services deve ser uma lista');
  } else {
    const declaredIds = new Set<string>();
    services.forEach((service, index) => {
      const path = `contract.services[${index}]`;
      if (!isObject(service) || typeof service.id !== 'string' || !service.id || !['provides', 'consumes'].includes(String(service.role)) || typeof service.name !== 'string' || !service.name.trim() || typeof service.description !== 'string' || !service.description.trim()) {
        errors.push(`${path} deve declarar id, role, name e description`);
        return;
      }
      if (declaredIds.has(service.id)) errors.push(`${path}.id está duplicado`);
      declaredIds.add(service.id);
      if (typeof service.version !== 'string' || !SERVICE_VERSION_PATTERN.test(service.version) || (service.role === 'provides' && !EXACT_SERVICE_VERSION_PATTERN.test(service.version))) {
        errors.push(`${path}.version deve ser uma versão exata para provides ou uma faixa SemVer para consumes`);
      }
      if (service.priority != null && (typeof service.priority !== 'number' || !Number.isFinite(service.priority))) errors.push(`${path}.priority deve ser um número finito`);
      if (service.id !== 'state-store' && !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(service.id)) errors.push(`${path}.id deve ser namespaceado`);
      if (!Array.isArray(service.methods)) {
        errors.push(`${path}.methods deve ser uma lista`);
      } else {
        const methodIds = new Set<string>();
        service.methods.forEach((method, methodIndex) => {
          if (!isObject(method) || typeof method.id !== 'string' || !/^[a-z][a-zA-Z0-9_-]*$/.test(method.id) || typeof method.description !== 'string' || !method.description.trim()) {
            errors.push(`${path}.methods[${methodIndex}] deve declarar id e description`);
            return;
          }
          if (methodIds.has(method.id)) errors.push(`${path}.methods[${methodIndex}].id está duplicado`);
          methodIds.add(method.id);
          if (method.receives != null) validatePayload(method.receives, `${path}.methods[${methodIndex}].receives`, errors);
          if (method.returns != null) validatePayload(method.returns, `${path}.methods[${methodIndex}].returns`, errors);
        });
      }
    });
  }

  const tab = contract.ui;
  if (!isObject(tab) || typeof tab.title !== 'string' || !tab.title.trim() || typeof tab.body !== 'string' || !tab.body.trim() || !Array.isArray(tab.fields) || !Array.isArray(tab.actions)) {
    errors.push('contract.ui deve declarar as listas fields e actions');
  } else {
    const fieldIds = new Set<string>();
    tab.fields.forEach((field, index) => {
      const path = `contract.ui.fields[${index}]`;
      if (!isObject(field) || typeof field.id !== 'string' || !field.id || typeof field.label !== 'string' || !field.label || typeof field.description !== 'string' || !field.description) {
        errors.push(`${path} deve declarar id, label e description`);
        return;
      }
      if (fieldIds.has(field.id)) errors.push(`${path}.id está duplicado`);
      fieldIds.add(field.id);
      validateSchema(field.schema, `${path}.schema`, errors);
    });
    const actionIds = new Set<string>();
    tab.actions.forEach((action, index) => {
      const path = `contract.ui.actions[${index}]`;
      if (!isObject(action) || typeof action.id !== 'string' || !action.id || typeof action.label !== 'string' || !action.label || typeof action.description !== 'string' || !action.description) {
        errors.push(`${path} deve declarar id, label e description`);
        return;
      }
      if (actionIds.has(action.id)) errors.push(`${path}.id está duplicado`);
      actionIds.add(action.id);
      if (action.receives != null && (!Array.isArray(action.receives) || action.receives.some((id) => typeof id !== 'string' || !fieldIds.has(id)))) {
        errors.push(`${path}.receives deve referenciar campos declarados`);
      }
      validatePayload(action.returns, `${path}.returns`, errors);
    });
  }

  const state = contract.state;
  if (!Array.isArray(state)) {
    errors.push('contract.state deve ser uma lista');
  } else {
    const stateIds = new Set<string>();
    state.forEach((entry, index) => {
      const path = `contract.state[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || typeof entry.description !== 'string' || !entry.description || (typeof entry.key !== 'string' && typeof entry.keyPattern !== 'string')) {
        errors.push(`${path} deve declarar id, description e key ou keyPattern`);
        return;
      }
      if (stateIds.has(entry.id)) errors.push(`${path}.id está duplicado`);
      stateIds.add(entry.id);
      if (typeof entry.key === 'string' && typeof entry.keyPattern === 'string') errors.push(`${path} não pode declarar key e keyPattern juntos`);
      if (!Array.isArray(entry.operations) || entry.operations.length === 0 || entry.operations.some((operation) => typeof operation !== 'string' || !VALID_STATE_OPERATIONS.includes(operation))) {
        errors.push(`${path}.operations deve conter operações de estado suportadas`);
      }
      if (typeof entry.retention !== 'string' || !entry.retention || typeof entry.deletionTrigger !== 'string' || !entry.deletionTrigger) {
        errors.push(`${path} deve declarar retention e deletionTrigger`);
      }
      validatePayload(entry.value, `${path}.value`, errors);
    });
  }

  const http = contract.http;
  if (!Array.isArray(http)) {
    errors.push('contract.http deve ser uma lista');
  } else {
    const incomingResources = new Set<string>();
    const httpIds = new Set<string>();
    http.forEach((entry, index) => {
      const path = `contract.http[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || !['incoming', 'outgoing'].includes(String(entry.direction)) || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(entry.method)) || typeof entry.path !== 'string' || !entry.path.startsWith('/') || typeof entry.purpose !== 'string' || !entry.purpose) {
        errors.push(`${path} deve declarar id, direction, method, path e purpose`);
        return;
      }
      if (httpIds.has(entry.id)) errors.push(`${path}.id está duplicado`);
      httpIds.add(entry.id);
      if (entry.direction === 'outgoing' && (typeof entry.origin !== 'string' || !/^https?:\/\/.+/.test(entry.origin))) {
        errors.push(`${path}.origin deve ser uma URL HTTP para chamadas externas`);
      }
      if (entry.direction === 'incoming' && typeof entry.resource === 'string') incomingResources.add(entry.resource);
      if (entry.receives != null) validatePayload(entry.receives, `${path}.receives`, errors);
      validatePayload(entry.returns, `${path}.returns`, errors);
    });
    if (Array.isArray(contract.resources)) {
      const resources = new Set(contract.resources.filter(isObject).map((resource) => resource.name).filter((name): name is string => typeof name === 'string'));
      if (resources.size !== incomingResources.size || [...resources].some((resource) => !incomingResources.has(resource))) {
        errors.push('contract.http incoming deve corresponder exatamente a resources');
      }
    }
  }

  const logs = contract.logs;
  if (!Array.isArray(logs)) {
    errors.push('contract.logs deve ser uma lista');
  } else {
    const logIds = new Set<string>();
    logs.forEach((entry, index) => {
      const path = `contract.logs[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || !['info', 'warn', 'error'].includes(String(entry.level)) || typeof entry.message !== 'string' || !entry.message || typeof entry.description !== 'string' || !entry.description) {
        errors.push(`${path} deve declarar id, level, message e description`);
        return;
      }
      if (logIds.has(entry.id)) errors.push(`${path}.id está duplicado`);
      logIds.add(entry.id);
      if (entry.details != null) validatePayload(entry.details, `${path}.details`, errors);
    });
  }
}

/** Valida somente o contrato de interação, útil para add-ons locais já importados pelo host. */
export function validateInteractionContract(manifest: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  validateInteractions(manifest, errors);
  return { valid: errors.length === 0, errors };
}

/** Garante que a aba executável não esconda campos ou ações fora do manifesto. */
export function validateTabContract(manifest: Record<string, unknown>, ui: TabContractShape): ValidationResult {
  const errors: string[] = [];
  const contract = manifest.contract;
  if (!isObject(contract) || !isObject(contract.ui) || !Array.isArray(contract.ui.fields) || !Array.isArray(contract.ui.actions)) {
    return { valid: false, errors: ['contract.ui está ausente ou inválido'] };
  }
  const declaredFields = contract.ui.fields.filter(isObject);
  const declaredActions = contract.ui.actions.filter(isObject);
  const actualFields = ui.fields ?? [];
  const actualActions = ui.actions ?? [];
  const check = (declared: Record<string, unknown>[], actual: Array<{ id: string; label: string; required?: boolean }>, label: string) => {
    if (declared.length !== actual.length) {
      errors.push(`A aba executável declarou quantidade diferente de ${label}`);
      return;
    }
    for (const item of actual) {
      const contract = declared.find((entry) => entry.id === item.id);
      if (!contract) {
        errors.push(`A aba executável declarou ${label} não presente no contrato: ${item.id}`);
      } else if (contract.label !== item.label) {
        errors.push(`O rótulo de ${label} ${item.id} diverge do contrato`);
      } else if (label === 'campo' && Boolean(contract.required) !== Boolean(item.required)) {
        errors.push(`A obrigatoriedade do campo ${item.id} diverge do contrato`);
      }
    }
  };
  check(declaredFields, actualFields, 'campo');
  check(declaredActions, actualActions, 'ação');
  return { valid: errors.length === 0, errors };
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifesto deve ser um objeto'] };
  }

  const m = data as Record<string, unknown>;

  for (const legacyField of ['tab', 'interactions', 'ui', 'services', 'resources', 'types', 'idPrefixes', 'catalogs']) {
    if (legacyField in m) errors.push(`Campo legado '${legacyField}' não é permitido fora de contract`);
  }

  // Campos obrigatórios em qualquer formato
  const required = ['id', 'version', 'name', 'description', 'author', 'license', 'contract'] as const;
  for (const field of required) {
    if (m[field] == null || m[field] === '') {
      errors.push(`Campo '${field}' é obrigatório`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // id: kebab-case
  if (typeof m.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(m.id)) {
    errors.push('id deve ser uma string em kebab-case (ex: "meu-addon")');
  }

  // version: semver
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version)) {
    errors.push('version deve estar no formato semântico X.Y.Z (ex: "1.0.0")');
  }

  const contract = isObject(m.contract) ? m.contract : undefined;
  // Pelo menos um formato: em-processo (pode apenas consumir serviços) ou HTTP (resources)
  const hasServices = Boolean(contract && Array.isArray(contract.services) && contract.services.length > 0);
  const hasResources = Boolean(contract && Array.isArray(contract.resources) && contract.resources.length > 0);

  if (!hasServices && !hasResources) {
    errors.push('Manifesto deve declarar services (em-processo) ou resources (HTTP/Stremio)');
  }

  // Formato em-processo: entrypoint obrigatório quando há services
  if (hasServices && !hasResources) {
    if (typeof m.entrypoint !== 'string' || !/^https?:\/\/.+/.test(m.entrypoint)) {
      errors.push('entrypoint deve ser uma URL http ou https (obrigatório no formato em-processo)');
    }
  }

  // services: descriptors completos dentro do contrato
  if (contract?.services != null) {
    if (!Array.isArray(contract.services)) {
      errors.push('contract.services deve ser um array');
    } else {
      for (let i = 0; i < contract.services.length; i++) {
        const svc = contract.services[i] as Record<string, unknown>;
        if (!svc.id || !svc.version || !svc.name || !svc.description) {
          errors.push(`contract.services[${i}] deve ter id, version, name e description`);
          break;
        }
      }
    }
  }

  // resources: estilo Stremio
  if (contract?.resources != null) {
    if (!Array.isArray(contract.resources)) {
      errors.push('contract.resources deve ser um array');
    } else if (contract.resources.length === 0) {
      errors.push('contract.resources deve ter pelo menos um item');
    } else {
      for (let i = 0; i < contract.resources.length; i++) {
        const res = contract.resources[i] as Record<string, unknown>;
        if (typeof res.name !== 'string' || !VALID_RESOURCE_NAMES.includes(res.name)) {
          errors.push(`contract.resources[${i}].name deve ser um de: ${VALID_RESOURCE_NAMES.join(', ')}`);
        }
        if (!Array.isArray(res.types) || res.types.length === 0) {
          errors.push(`contract.resources[${i}].types deve ser um array não vazio`);
        }
      }
    }
  }

  // catalogs: cada catálogo deve referenciar um type declarado
  if (contract?.catalogs != null) {
    if (!Array.isArray(contract.catalogs)) {
      errors.push('contract.catalogs deve ser um array');
    } else {
      const declaredTypes = new Set<string>();
      if (Array.isArray(contract.types)) {
        for (const t of contract.types) declaredTypes.add(String(t));
      }
      if (Array.isArray(contract.resources)) {
        for (const res of contract.resources) {
          if (Array.isArray((res as Record<string, unknown>).types)) {
            for (const t of (res as Record<string, unknown>).types as string[]) {
              declaredTypes.add(t);
            }
          }
        }
      }
      for (let i = 0; i < contract.catalogs.length; i++) {
        const cat = contract.catalogs[i] as Record<string, unknown>;
        if (!cat.id || !cat.name) {
          errors.push(`catalogs[${i}] deve ter id e name`);
        }
        if (typeof cat.type !== 'string' || !declaredTypes.has(cat.type)) {
          errors.push(`catalogs[${i}].type '${String(cat.type)}' não está entre os types declarados`);
        }
      }
    }
  }

  validateInteractions(m, errors);

  return { valid: errors.length === 0, errors };
}
