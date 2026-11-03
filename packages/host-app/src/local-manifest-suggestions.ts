import { parseSemVer } from '@addons-poc/protocol';

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

export const PUBLISHED_RELEASE_VERSIONS = ['1.15.0', '1.16.0', '1.16.1', '1.16.2', '1.17.0', '1.17.1', '1.17.2'] as const;

const PEEKMOSAIC_RELEASES_ORIGIN = 'https://www.peekmosaic.com/addons';
const PUBLISHED_ADDON_IDS = ['chord-catalog', 'chord-viewer', 'storage-local', 'chord-editor'] as const;
const PUBLISHED_ADDON_ID_SET = new Set<string>(PUBLISHED_ADDON_IDS);
const PUBLISHED_RELEASE_MANIFESTS = [
  { version: '1.17.2', addonIds: ['chord-catalog', 'chord-viewer', 'chord-editor'] },
  { version: '1.17.1', addonIds: ['chord-viewer', 'chord-editor'] },
  { version: '1.17.0', addonIds: PUBLISHED_ADDON_IDS },
  { version: '1.16.2', addonIds: ['chord-catalog', 'chord-viewer', 'chord-editor'] },
  { version: '1.16.1', addonIds: ['chord-viewer', 'chord-editor'] },
  { version: '1.16.0', addonIds: ['chord-catalog', 'chord-viewer', 'chord-editor'] },
  { version: '1.15.0', addonIds: ['chord-catalog', 'chord-viewer', 'chord-editor'] },
] as const;

function publishedManifestUrl(version: string, addonId: string): string {
  return `${PEEKMOSAIC_RELEASES_ORIGIN}/${version}/${addonId}/manifest.json`;
}

/** Maps a fixed legacy Vercel URL to the branded alias without changing installation identity. */
export function peekMosaicManifestUrl(manifestUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(manifestUrl);
  } catch {
    return manifestUrl;
  }

  const release = /^addons-poc-release-(\d+)-(\d+)-(\d+)\.vercel\.app$/.exec(parsed.hostname);
  const addon = /^\/(chord-catalog|chord-viewer|storage-local|chord-editor)\/manifest\.json$/.exec(parsed.pathname)?.[1];
  const version = release?.slice(1).join('.');
  if (parsed.protocol !== 'https:' || !addon || !version || !PUBLISHED_RELEASE_VERSIONS.some((publishedVersion) => publishedVersion === version)) {
    return manifestUrl;
  }

  return publishedManifestUrl(version, addon);
}

export const LOCAL_MANIFEST_URLS = LOCAL_MANIFEST_PORTS.map(localManifestUrl);

export interface LocalManifestSuggestion {
  manifestUrl: string;
  title: string;
  description: string;
  version?: string;
  id?: string;
}

/** Keeps add-ons shipped by PeekMosaic ahead of local-only development examples. */
export function prioritizePublishedAddonSuggestions(
  suggestions: LocalManifestSuggestion[],
): LocalManifestSuggestion[] {
  return suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((left, right) => {
      const leftIsLocalOnly = !left.suggestion.id || !PUBLISHED_ADDON_ID_SET.has(left.suggestion.id);
      const rightIsLocalOnly = !right.suggestion.id || !PUBLISHED_ADDON_ID_SET.has(right.suggestion.id);
      return Number(leftIsLocalOnly) - Number(rightIsLocalOnly) || left.index - right.index;
    })
    .map(({ suggestion }) => suggestion);
}

export function olderManifestUrls(suggestions: LocalManifestSuggestion[]): Set<string> {
  const latest = new Map<string, [number, number, number]>();
  const compare = (a: [number, number, number], b: [number, number, number]) =>
    a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  for (const suggestion of suggestions) {
    const version = suggestion.version && parseSemVer(suggestion.version);
    if (!suggestion.id || !version) continue;
    const current = latest.get(suggestion.id);
    if (!current || compare(version, current) > 0) latest.set(suggestion.id, version);
  }
  return new Set(suggestions.filter((suggestion) => {
    const version = suggestion.version && parseSemVer(suggestion.version);
    const newest = suggestion.id && latest.get(suggestion.id);
    return version && newest && compare(version, newest) < 0;
  }).map((suggestion) => suggestion.manifestUrl));
}

export function groupManifestSuggestions(suggestions: LocalManifestSuggestion[]): LocalManifestSuggestion[][] {
  const groups = new Map<string, LocalManifestSuggestion[]>();
  for (const suggestion of suggestions) {
    const key = suggestion.id ? `id:${suggestion.id}` : `url:${suggestion.manifestUrl}`;
    const group = groups.get(key) ?? [];
    group.push(suggestion);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function fallbackSuggestion(port: number): LocalManifestSuggestion {
  return {
    manifestUrl: localManifestUrl(port),
    title: `Local manifest (port ${port})`,
    description: 'Local demonstration manifest URL.',
  };
}

export const PUBLISHED_MANIFEST_URLS = PUBLISHED_RELEASE_MANIFESTS.flatMap(({ version, addonIds }) =>
  addonIds.map((addonId) => publishedManifestUrl(version, addonId)),
);

export function manifestSuggestions(hostname: string): LocalManifestSuggestion[] {
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  return local
    ? LOCAL_MANIFEST_PORTS.map(fallbackSuggestion)
    : PUBLISHED_MANIFEST_URLS.map((manifestUrl) => ({ manifestUrl, title: 'Published manifest', description: 'Published add-on manifest.' }));
}

export const LOCAL_MANIFEST_SUGGESTIONS = manifestSuggestions(
  typeof location === 'undefined' ? 'localhost' : location.hostname,
);

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
  return Promise.all(LOCAL_MANIFEST_SUGGESTIONS.map(async (fallback) => {
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
        version: textField(record.version),
        id: textField(record.id),
      };
    } catch {
      return fallback;
    }
  }));
}
