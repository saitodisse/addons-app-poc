import type { ServiceRegistry } from './registry';

export interface ResourceClient {
  request(input: { url: string }): Promise<{ status: number; contentType: string; body: string } | undefined>;
}

/** Local providers own resource URLs; an unclaimed URL uses the HTTP adapter. */
export function createResourceFetch(registry: ServiceRegistry, network: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if ((init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'GET') {
      for (const provider of registry.getAll<ResourceClient>('host.resource-client')) {
        const response = await provider.request({ url });
        if (response) return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.contentType } });
      }
    }
    return network(input, init);
  };
}
