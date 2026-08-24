export const LOCAL_MANIFEST_PORTS = [
  5291,
  5292,
  5293,
  5294,
  5301,
  5302,
  5303,
  5304,
  5305,
  5306,
  5307,
  5308,
  5309,
  5310,
] as const;

export function localManifestUrl(port: number): string {
  return `http://localhost:${port}/manifest.json`;
}

export const LOCAL_MANIFEST_URLS = LOCAL_MANIFEST_PORTS.map(localManifestUrl);

export interface LocalManifestSuggestion {
  manifestUrl: string;
  title: string;
  description: string;
}

function fallbackSuggestion(port: number): LocalManifestSuggestion {
  return {
    manifestUrl: localManifestUrl(port),
    title: `Manifesto local (porta ${port})`,
    description: 'URL local de manifesto da demonstração.',
  };
}

export const LOCAL_MANIFEST_SUGGESTIONS = LOCAL_MANIFEST_PORTS.map(fallbackSuggestion);

interface ManifestResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

type ManifestFetcher = (url: string) => Promise<ManifestResponse>;

function textField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Lê apenas os metadados públicos do manifesto. O host não importa bundles
 * nem mantém uma lista de nomes de add-ons; cada servidor continua sendo a
 * fonte do próprio título e descrição.
 */
export async function loadLocalManifestSuggestions(
  fetcher: ManifestFetcher = (url) => fetch(url),
): Promise<LocalManifestSuggestion[]> {
  return Promise.all(LOCAL_MANIFEST_PORTS.map(async (port) => {
    const fallback = fallbackSuggestion(port);
    try {
      const response = await fetcher(fallback.manifestUrl);
      if (!response.ok) return fallback;
      const data = await response.json();
      if (!data || typeof data !== 'object') return fallback;
      const record = data as Record<string, unknown>;
      return {
        ...fallback,
        title: textField(record.name) ?? fallback.title,
        description: textField(record.description) ?? fallback.description,
      };
    } catch {
      return fallback;
    }
  }));
}
