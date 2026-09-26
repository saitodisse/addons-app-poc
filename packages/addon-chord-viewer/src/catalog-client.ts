/**
 * Client for the chord-chart catalogue.
 *
 * The viewer never imports the catalogue add-on: it reads the manifest URL as
 * identity and follows the `catalog`, `text`, and content routes of the public
 * protocol, exactly like the host does. `fetchFn` is injectable for tests.
 */
import type { TextPagination } from '@addons-poc/protocol';
import type { Voicing } from './engine/diagrams';

export interface ChartSummaryRow {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface ChartRecord {
  id: string;
  title: string;
  artist: string;
  key?: string;
  capo?: number;
  tempo?: number;
  time?: string;
  difficulty?: number;
  text: string;
  chords: Voicing[];
  contentJsonUrl?: string;
  /** Checksum of the text as published by the catalogue. */
  sourceChecksum?: string;
  license?: string;
  notice?: string;
  /** Notation family declared by the payload, when it declares one. */
  notationFormat?: string;
}

export interface CatalogPage {
  rows: ChartSummaryRow[];
  pagination?: TextPagination;
}

type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Accepts either a base URL or the manifest URL, which is the identity rule. */
function baseOf(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/u, '');
  const withoutManifest = trimmed.endsWith('/manifest.json')
    ? trimmed.slice(0, -'/manifest.json'.length)
    : trimmed;
  return withoutManifest.replace(/\/+$/u, '');
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function voicings(value: unknown): Voicing[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      symbol: text(item.symbol, '?'),
      ...(typeof item.frets === 'string' ? { frets: item.frets } : {}),
      ...(typeof item.fingers === 'string' ? { fingers: item.fingers } : {}),
      ...(number(item.position) !== undefined ? { position: number(item.position) } : {}),
    }));
}

/** Reads a structured payload produced by the catalogue. */
export function chartFromPayload(payload: unknown, fallbackId = ''): ChartRecord | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as Record<string, unknown>;
  const content = (data.content ?? {}) as Record<string, unknown>;
  const work = (data.musicalWork ?? {}) as Record<string, unknown>;
  const version = (data.playableVersion ?? {}) as Record<string, unknown>;
  const source = (data.source ?? {}) as Record<string, unknown>;
  const notation = (data.notation ?? {}) as Record<string, unknown>;
  const chart = (data.chordChart ?? {}) as Record<string, unknown>;

  const chartText = text(content.text) || text(data.text);
  if (!chartText) return undefined;

  return {
    id: text(data.id, fallbackId),
    title: text(data.title, fallbackId || 'Untitled chart'),
    artist: text(work.artistName) || text(data.artist, 'Unknown artist'),
    ...(text(version.key) || text(data.key) ? { key: text(version.key) || text(data.key) } : {}),
    ...(number(version.capo) !== undefined ? { capo: number(version.capo) } : {}),
    ...(number(version.tempo) !== undefined ? { tempo: number(version.tempo) } : {}),
    ...(text(version.time) ? { time: text(version.time) } : {}),
    ...(number(version.difficulty) !== undefined ? { difficulty: number(version.difficulty) } : {}),
    text: chartText,
    chords: voicings(data.chords),
    ...(text(source.url) ? { contentJsonUrl: text(source.url) } : {}),
    ...(text(chart.rawTextChecksum) ? { sourceChecksum: text(chart.rawTextChecksum) } : {}),
    ...(text(source.license) ? { license: text(source.license) } : {}),
    ...(text(source.notice) ? { notice: text(source.notice) } : {}),
    ...(text(notation.format) ? { notationFormat: text(notation.format) } : {}),
  };
}

/** Accepts a pasted chart text or a pasted structured payload. */
export function chartFromText(value: string, id = 'pasted'): ChartRecord | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  if (raw.startsWith('{')) {
    try {
      return chartFromPayload(JSON.parse(raw), id);
    } catch {
      return undefined;
    }
  }
  const firstLine = raw.split('\n')[0].trim();
  return {
    id,
    title: /^\[[^\]]+\]$/u.test(firstLine) ? 'Pasted chart' : firstLine || 'Pasted chart',
    artist: 'Pasted locally',
    text: raw,
    chords: [],
  };
}

export class CatalogClient {
  constructor(private fetchFn: FetchFn = (url) => fetch(url)) {}

  private async json<T>(url: string): Promise<T> {
    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
    return await response.json() as T;
  }

  private pageQuery(page?: { limit?: number; cursor?: string }): string {
    const params = new URLSearchParams();
    if (page?.limit !== undefined) params.set('limit', String(page.limit));
    if (page?.cursor) params.set('cursor', page.cursor);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  /** Reads one named view of the catalogue. */
  async list(baseUrl: string, catalogId = 'recent', page?: { limit?: number; cursor?: string }): Promise<CatalogPage> {
    const base = baseOf(baseUrl);
    const payload = await this.json<{ metas?: unknown[]; pagination?: TextPagination }>(
      `${base}/catalog/chart/${encodeURIComponent(catalogId)}.json${this.pageQuery(page)}`,
    );
    return {
      rows: (payload.metas ?? [])
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          id: text(item.id),
          name: text(item.name, text(item.id)),
          description: text(item.description),
          url: text(item.url),
        })),
      ...(payload.pagination ? { pagination: payload.pagination } : {}),
    };
  }

  /** Reads one chart: options first, then the structured content. */
  async chart(baseUrl: string, id: string): Promise<ChartRecord> {
    const base = baseOf(baseUrl);
    const payload = await this.json<{ texts?: Array<Record<string, unknown>> }>(
      `${base}/text/chart/${encodeURIComponent(id)}.json`,
    );
    const option = payload.texts?.[0];
    if (!option) throw new Error(`The catalogue did not publish a version for ${id}.`);

    const contentJsonUrl = text(option.contentJsonUrl)
      || text(option.url).replace(/\/content\.txt(?=$|[?#])/u, '/content.json');
    if (!contentJsonUrl) throw new Error(`Version ${id} has no content URL.`);

    const record = chartFromPayload(await this.json(contentJsonUrl), id);
    if (!record) throw new Error(`The structured payload of ${id} has no chart text.`);
    return { ...record, contentJsonUrl };
  }

  /** Reads a chart directly from a content URL, text or JSON. */
  async chartFromUrl(url: string): Promise<ChartRecord> {
    const target = url.replace(/\/content\.txt(?=$|[?#])/u, '/content.json');
    if (!/\.json($|[?#])/u.test(target)) {
      const response = await this.fetchFn(target);
      if (!response.ok) throw new Error(`HTTP ${response.status} at ${target}`);
      const body = await response.text();
      return { id: target, title: 'Chart from URL', artist: target, text: body, chords: [] };
    }
    const record = chartFromPayload(await this.json(target), target);
    if (!record) throw new Error(`The payload at ${target} has no chart text.`);
    return { ...record, contentJsonUrl: target };
  }
}
