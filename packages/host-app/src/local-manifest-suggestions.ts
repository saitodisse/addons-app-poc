export const LOCAL_MANIFEST_PORTS = [
  5294,
  5295,
  5304,
  5305,
  5306,
  5307,
  5308,
  5309,
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
    title: `Local manifest (port ${port})`,
    description: 'Local demonstration manifest URL.',
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
 * Reads only the manifest's public metadata. The host does not import bundles
 * or maintain a list of add-on names; each server remains the source of its
 * own title and description.
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
