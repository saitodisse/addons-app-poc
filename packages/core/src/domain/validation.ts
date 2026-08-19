export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_RESOURCE_NAMES = ['catalog', 'search', 'text', 'meta', 'subtitles', 'stream'];

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifesto deve ser um objeto'] };
  }

  const m = data as Record<string, unknown>;

  // Campos obrigatórios em qualquer formato
  const required = ['id', 'version', 'name', 'description', 'author', 'license'] as const;
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

  return { valid: errors.length === 0, errors };
}
