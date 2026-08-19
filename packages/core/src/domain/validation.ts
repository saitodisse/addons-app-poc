export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifesto deve ser um objeto'] };
  }

  const m = data as Record<string, unknown>;

  // Campos obrigatórios
  const required = ['id', 'version', 'name', 'description', 'author', 'license', 'entrypoint', 'services'] as const;
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

  // entrypoint: URL absoluta
  if (typeof m.entrypoint !== 'string' || !/^https?:\/\/.+/.test(m.entrypoint)) {
    errors.push('entrypoint deve ser uma URL http ou https');
  }

  // services: array não vazio
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

  return { valid: errors.length === 0, errors };
}