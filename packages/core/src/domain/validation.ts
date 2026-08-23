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
  const interactions = manifest.interactions;
  if (!isObject(interactions)) {
    errors.push('interactions é obrigatório e deve ser um objeto');
    return;
  }
  if (interactions.version !== '1.0.0') {
    errors.push('interactions.version deve ser 1.0.0');
  }

  const services = interactions.services;
  if (!Array.isArray(services)) {
    errors.push('interactions.services deve ser uma lista');
  } else {
    const provided = new Set<string>();
    services.forEach((service, index) => {
      const path = `interactions.services[${index}]`;
      if (!isObject(service) || typeof service.id !== 'string' || !service.id || !['provides', 'consumes'].includes(String(service.role)) || typeof service.description !== 'string' || !service.description.trim()) {
        errors.push(`${path} deve declarar id, role e description`);
        return;
      }
      if (service.role === 'provides') provided.add(service.id);
      if (service.methods != null) {
        if (!Array.isArray(service.methods)) {
          errors.push(`${path}.methods deve ser uma lista`);
        } else {
          service.methods.forEach((method, methodIndex) => {
            if (!isObject(method) || typeof method.id !== 'string' || !method.id || typeof method.description !== 'string' || !method.description.trim()) {
              errors.push(`${path}.methods[${methodIndex}] deve declarar id e description`);
              return;
            }
            if (method.receives != null) validatePayload(method.receives, `${path}.methods[${methodIndex}].receives`, errors);
            if (method.returns != null) validatePayload(method.returns, `${path}.methods[${methodIndex}].returns`, errors);
          });
        }
      }
    });
    const declaredServices = Array.isArray(manifest.services)
      ? new Set(manifest.services.filter(isObject).map((service) => service.id).filter((id): id is string => typeof id === 'string'))
      : new Set<string>();
    if (provided.size !== declaredServices.size || [...provided].some((id) => !declaredServices.has(id))) {
      errors.push('interactions.services com role provides deve corresponder exatamente a services');
    }
  }

  const tab = interactions.tab;
  if (!isObject(tab) || !Array.isArray(tab.fields) || !Array.isArray(tab.actions)) {
    errors.push('interactions.tab deve declarar as listas fields e actions');
  } else {
    const fieldIds = new Set<string>();
    tab.fields.forEach((field, index) => {
      const path = `interactions.tab.fields[${index}]`;
      if (!isObject(field) || typeof field.id !== 'string' || !field.id || typeof field.label !== 'string' || !field.label || typeof field.description !== 'string' || !field.description) {
        errors.push(`${path} deve declarar id, label e description`);
        return;
      }
      fieldIds.add(field.id);
      validateSchema(field.schema, `${path}.schema`, errors);
    });
    const actionIds = new Set<string>();
    tab.actions.forEach((action, index) => {
      const path = `interactions.tab.actions[${index}]`;
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

  const state = interactions.state;
  if (!Array.isArray(state)) {
    errors.push('interactions.state deve ser uma lista');
  } else {
    state.forEach((entry, index) => {
      const path = `interactions.state[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || typeof entry.description !== 'string' || !entry.description || (typeof entry.key !== 'string' && typeof entry.keyPattern !== 'string')) {
        errors.push(`${path} deve declarar id, description e key ou keyPattern`);
        return;
      }
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

  const http = interactions.http;
  if (!Array.isArray(http)) {
    errors.push('interactions.http deve ser uma lista');
  } else {
    const incomingResources = new Set<string>();
    http.forEach((entry, index) => {
      const path = `interactions.http[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || !['incoming', 'outgoing'].includes(String(entry.direction)) || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(entry.method)) || typeof entry.path !== 'string' || !entry.path.startsWith('/') || typeof entry.purpose !== 'string' || !entry.purpose) {
        errors.push(`${path} deve declarar id, direction, method, path e purpose`);
        return;
      }
      if (entry.direction === 'outgoing' && (typeof entry.origin !== 'string' || !/^https?:\/\/.+/.test(entry.origin))) {
        errors.push(`${path}.origin deve ser uma URL HTTP para chamadas externas`);
      }
      if (entry.direction === 'incoming' && typeof entry.resource === 'string') incomingResources.add(entry.resource);
      if (entry.receives != null) validatePayload(entry.receives, `${path}.receives`, errors);
      validatePayload(entry.returns, `${path}.returns`, errors);
    });
    if (Array.isArray(manifest.resources)) {
      const resources = new Set(manifest.resources.filter(isObject).map((resource) => resource.name).filter((name): name is string => typeof name === 'string'));
      if (resources.size !== incomingResources.size || [...resources].some((resource) => !incomingResources.has(resource))) {
        errors.push('interactions.http incoming deve corresponder exatamente a resources');
      }
    }
  }

  const logs = interactions.logs;
  if (!Array.isArray(logs)) {
    errors.push('interactions.logs deve ser uma lista');
  } else {
    logs.forEach((entry, index) => {
      const path = `interactions.logs[${index}]`;
      if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id || !['info', 'warn', 'error'].includes(String(entry.level)) || typeof entry.message !== 'string' || !entry.message || typeof entry.description !== 'string' || !entry.description) {
        errors.push(`${path} deve declarar id, level, message e description`);
        return;
      }
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
export function validateTabContract(manifest: Record<string, unknown>, tab: TabContractShape): ValidationResult {
  const errors: string[] = [];
  const interactions = manifest.interactions;
  if (!isObject(interactions) || !isObject(interactions.tab) || !Array.isArray(interactions.tab.fields) || !Array.isArray(interactions.tab.actions)) {
    return { valid: false, errors: ['interactions.tab está ausente ou inválido'] };
  }
  const declaredFields = interactions.tab.fields.filter(isObject);
  const declaredActions = interactions.tab.actions.filter(isObject);
  const actualFields = tab.fields ?? [];
  const actualActions = tab.actions ?? [];
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

  // Campos obrigatórios em qualquer formato
  const required = ['id', 'version', 'name', 'description', 'author', 'license', 'tab'] as const;
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

  if (!m.tab || typeof m.tab !== 'object' || Array.isArray(m.tab)) {
    errors.push('tab deve declarar title e body');
  } else {
    const tab = m.tab as Record<string, unknown>;
    if (typeof tab.title !== 'string' || !tab.title.trim() || typeof tab.body !== 'string' || !tab.body.trim()) {
      errors.push('tab deve declarar title e body não vazios');
    }
  }

  // Pelo menos um formato: em-processo (services) ou Stremio (resources)
  const hasServices = Array.isArray(m.services) && m.services.length > 0;
  const hasResources = Array.isArray(m.resources) && m.resources.length > 0;

  if (!hasServices && !hasResources) {
    errors.push('Manifesto deve declarar services (em-processo) ou resources (HTTP/Stremio)');
  }

  // Formato em-processo: entrypoint obrigatório quando há services
  if (hasServices && !hasResources) {
    if (typeof m.entrypoint !== 'string' || !/^https?:\/\/.+/.test(m.entrypoint)) {
      errors.push('entrypoint deve ser uma URL http ou https (obrigatório no formato em-processo)');
    }
  }

  // services: array não vazio
  if (m.services != null) {
    if (!Array.isArray(m.services)) {
      errors.push('services deve ser um array');
    } else if (m.services.length === 0) {
      errors.push('services deve ter pelo menos um item');
    } else {
      for (let i = 0; i < m.services.length; i++) {
        const svc = m.services[i] as Record<string, unknown>;
        if (!svc.id || !svc.version || !svc.name || !svc.description) {
          errors.push(`services[${i}] deve ter id, version, name e description`);
          break;
        }
      }
    }
  }

  // resources: estilo Stremio
  if (m.resources != null) {
    if (!Array.isArray(m.resources)) {
      errors.push('resources deve ser um array');
    } else if (m.resources.length === 0) {
      errors.push('resources deve ter pelo menos um item');
    } else {
      for (let i = 0; i < m.resources.length; i++) {
        const res = m.resources[i] as Record<string, unknown>;
        if (typeof res.name !== 'string' || !VALID_RESOURCE_NAMES.includes(res.name)) {
          errors.push(`resources[${i}].name deve ser um de: ${VALID_RESOURCE_NAMES.join(', ')}`);
        }
        if (!Array.isArray(res.types) || res.types.length === 0) {
          errors.push(`resources[${i}].types deve ser um array não vazio`);
        }
      }
    }
  }

  // catalogs: cada catálogo deve referenciar um type declarado
  if (m.catalogs != null) {
    if (!Array.isArray(m.catalogs)) {
      errors.push('catalogs deve ser um array');
    } else {
      const declaredTypes = new Set<string>();
      if (Array.isArray(m.types)) {
        for (const t of m.types) declaredTypes.add(String(t));
      }
      if (Array.isArray(m.resources)) {
        for (const res of m.resources) {
          if (Array.isArray((res as Record<string, unknown>).types)) {
            for (const t of (res as Record<string, unknown>).types as string[]) {
              declaredTypes.add(t);
            }
          }
        }
      }
      for (let i = 0; i < m.catalogs.length; i++) {
        const cat = m.catalogs[i] as Record<string, unknown>;
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
