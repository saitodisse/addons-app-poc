import { ServiceRegistry } from './registry';

export class AggregateFallbackError extends Error {
  constructor(
    public readonly serviceId: string,
    public readonly errors: Error[],
  ) {
    super(`Todas as implementações de '${serviceId}' falharam`);
    this.name = 'AggregateFallbackError';
  }
}

export function withFallback<T, R>(
  registry: ServiceRegistry,
  serviceId: string,
  fn: (instance: T) => R,
): R {
  const implementations = registry.getAll<T>(serviceId);
  const errors: Error[] = [];
  for (const impl of implementations) {
    try {
      return fn(impl);
    } catch (error) {
      errors.push(error as Error);
    }
  }
  throw new AggregateFallbackError(serviceId, errors);
}