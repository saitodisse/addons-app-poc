import { checkServiceCompatibility } from '@addons-poc/protocol';
import type { AddonManifest, ServiceInteraction } from '@addons-poc/protocol';

export interface AddonDependencyInput {
  key: string;
  manifest: AddonManifest;
}

export interface AddonDependencyStatus {
  status: 'ready' | 'blocked';
  errors: string[];
  providers: Record<string, string>;
}

export interface AddonDependencyAnalysis {
  statuses: ReadonlyMap<string, AddonDependencyStatus>;
  cycles: string[][];
}

interface Provider {
  key: string;
  manifest: AddonManifest;
  service: ServiceInteraction;
}

function providersFor(inputs: AddonDependencyInput[]): Map<string, Provider[]> {
  const providers = new Map<string, Provider[]>();
  for (const input of inputs) {
    for (const service of input.manifest.contract.services.filter((candidate) => candidate.role === 'provides')) {
      const list = providers.get(service.id) ?? [];
      list.push({ key: input.key, manifest: input.manifest, service });
      list.sort((left, right) => (right.service.priority ?? 0) - (left.service.priority ?? 0) || left.key.localeCompare(right.key));
      providers.set(service.id, list);
    }
  }
  return providers;
}

/**
 * Analisa dependências declaradas antes de qualquer import. A ausência de um
 * consumidor obrigatório vira bloqueio; uma dependência opcional não bloqueia.
 * O resultado é reexecutável quando um novo provedor entra no registry.
 */
export function analyzeAddonDependencies(inputs: AddonDependencyInput[]): AddonDependencyAnalysis {
  const providers = providersFor(inputs);
  const statuses = new Map<string, AddonDependencyStatus>();
  const edges = new Map<string, string[]>();

  for (const input of inputs) {
    const errors: string[] = [];
    const selected: Record<string, string> = {};
    const addonEdges: string[] = [];
    for (const service of input.manifest.contract.services.filter((candidate) => candidate.role === 'consumes' && candidate.required !== false)) {
      const provider = providers.get(service.id)?.[0];
      if (!provider) {
        errors.push(`Serviço obrigatório ausente: ${service.id}`);
        continue;
      }
      const compatibility = checkServiceCompatibility(service, {
        id: provider.service.id,
        version: provider.service.version ?? '0.0.0',
        methods: new Map((provider.service.methods ?? []).map((method) => [method.id, { receives: method.receives, returns: method.returns }])),
      });
      errors.push(...compatibility.errors);
      selected[service.id] = provider.key;
      addonEdges.push(provider.key);
    }
    edges.set(input.key, addonEdges);
    statuses.set(input.key, { status: errors.length ? 'blocked' : 'ready', errors, providers: selected });
  }

  const cycles: string[][] = [];
  const visiting = new Map<string, number>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const visit = (key: string) => {
    const position = visiting.get(key);
    if (position !== undefined) {
      const cycle = stack.slice(position);
      if (cycle.length > 0 && !cycles.some((known) => known.length === cycle.length && known.every((item) => cycle.includes(item)))) cycles.push(cycle);
      return;
    }
    if (visited.has(key)) return;
    visiting.set(key, stack.length);
    stack.push(key);
    for (const next of edges.get(key) ?? []) visit(next);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };
  for (const input of inputs) visit(input.key);

  for (const cycle of cycles) {
    for (const key of cycle) {
      const status = statuses.get(key);
      if (status && !status.errors.some((error) => error.includes('ciclo obrigatório'))) status.errors.push(`Ciclo obrigatório detectado: ${cycle.join(' -> ')}`);
    }
  }

  // Um consumidor de um add-on já bloqueado também não pode ser importado.
  let changed = true;
  while (changed) {
    changed = false;
    for (const input of inputs) {
      const status = statuses.get(input.key)!;
      for (const providerKey of edges.get(input.key) ?? []) {
        const providerStatus = statuses.get(providerKey);
        if (providerStatus?.errors.length && !status.errors.some((error) => error.includes(`Provedor bloqueado: ${providerKey}`))) {
          status.errors.push(`Provedor bloqueado: ${providerKey}`);
          changed = true;
        }
      }
      const next = status.errors.length ? 'blocked' : 'ready';
      if (status.status !== next) { status.status = next; changed = true; }
    }
  }

  return { statuses, cycles };
}
