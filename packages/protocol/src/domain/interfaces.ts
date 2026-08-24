export interface Greeter {
  greet(name: string): string;
}

export interface Counter {
  increment(): number;
  decrement(): number;
  getValue(): number;
  reset(): number;
}

export interface SearchResult {
  title: string;
  url?: string;
  snippet?: string;
}

export interface SearchProvider {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface HttpFetcher {
  /** Busca um recurso por HTTP/API e retorna o corpo como texto. */
  fetchText(url: string): Promise<string>;
  /** Busca um recurso e retorna os dados parseados como JSON. */
  fetchJson<T = unknown>(url: string): Promise<T>;
}