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
  /** Fetches a resource over HTTP/API and returns its body as text. */
  fetchText(url: string): Promise<string>;
  /** Fetches a resource and returns its data parsed as JSON. */
  fetchJson<T = unknown>(url: string): Promise<T>;
}
