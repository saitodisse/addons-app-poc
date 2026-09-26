/** The editor reads the public payload by URL; it never imports the catalogue. */
export interface EditableChart {
  id: string;
  title: string;
  artist: string;
  key?: string;
  sourceUrl: string;
  sourceChecksum: string;
  originalText: string;
}

function value(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function structuredChartUrl(input: string): string | undefined {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || !/\/text\/chart\/[^/]+\/content\.(?:txt|json)$/u.test(url.pathname)) return undefined;
    url.pathname = url.pathname.replace(/\/content\.txt$/u, '/content.json');
    return url.href;
  } catch {
    return undefined;
  }
}

export function editableChartFromPayload(payload: unknown, sourceUrl: string): EditableChart | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as Record<string, unknown>;
  const content = data.content as Record<string, unknown> | undefined;
  const chart = data.chordChart as Record<string, unknown> | undefined;
  const work = data.musicalWork as Record<string, unknown> | undefined;
  const version = data.playableVersion as Record<string, unknown> | undefined;
  const notation = data.notation as Record<string, unknown> | undefined;
  const text = typeof content?.text === 'string' ? content.text : '';
  const checksum = value(chart?.rawTextChecksum);
  if (value(notation?.format) !== 'chord-over-lyrics' || !text || !checksum) return undefined;
  return {
    id: value(data.id) || sourceUrl,
    title: value(data.title) || 'Untitled chart',
    artist: value(work?.artistName),
    ...(value(version?.key) ? { key: value(version?.key) } : {}),
    sourceUrl,
    sourceChecksum: checksum,
    originalText: text,
  };
}

export async function loadEditableChart(
  input: string,
  fetchFn: typeof fetch = fetch,
): Promise<EditableChart> {
  const sourceUrl = structuredChartUrl(input);
  if (!sourceUrl) throw new Error('Enter a chart content URL from a compatible catalogue.');
  const response = await fetchFn(sourceUrl);
  if (!response.ok) throw new Error(`The catalogue returned HTTP ${response.status}.`);
  const chart = editableChartFromPayload(await response.json(), sourceUrl);
  if (!chart) throw new Error('This content has no editable chart text and source checksum.');
  return chart;
}
