import { createHash } from 'node:crypto';
import { VOICINGS } from './data/voicings.js';
import { chartSections } from './catalog.js';

/** Content type used by every chart in this catalogue. */
export const CHART_TYPE = 'chart';
/** Path segment of the content routes, kept in one place for the manifest. */
export const CONTENT_PATH = 'text';

export const CONTENT_LICENSE = 'MIT';
export const PROVENANCE_NOTICE = 'Synthetic demo catalogue created for this POC; no published catalogue was copied.';
/** Versions of the parser and of the AST that the text is published against. */
export const PARSER_VERSION = '1.0.0';
export const AST_VERSION = '1.0.0';

/** Identifies the exact text delivered, so a reader can detect a changed chart. */
export function checksumOf(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function absolute(baseUrl, path, query) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.href;
}

export function contentPath(chart, extension) {
  return `${CONTENT_PATH}/${CHART_TYPE}/${encodeURIComponent(chart.id)}/content.${extension}`;
}

/** Short description reused by the search rows and by the structured payload. */
export function chartDescription(chart) {
  return `${chart.artist?.name ?? 'Unknown artist'} · key ${chart.key}${chart.capo ? ` · capo ${chart.capo}` : ''} · ${chart.tempo} BPM`;
}

/** One-line summary of the notation, used where the host renders plain text. */
export function chartSummary(chart) {
  const sections = chartSections(chart.text);
  const names = sections.map((section) => section.title).join(', ');
  return `Chord chart in ${chart.key} with ${sections.length} section${sections.length === 1 ? '' : 's'}${names ? ` (${names})` : ''} and shapes ${chart.chords.join(', ')}.`;
}

/** Row shape shared by the `catalog` and `search` resources. */
export function toMeta(chart, baseUrl) {
  return {
    id: chart.id,
    type: CHART_TYPE,
    name: chart.title,
    artist: chart.artist?.name,
    image: chart.artist?.image ? absolute(baseUrl, chart.artist.image) : undefined,
    displayFields: [
      { id: 'artist', label: 'Artist', value: chart.artist?.name ?? 'Unknown artist', image: chart.artist?.image ? absolute(baseUrl, chart.artist.image) : undefined },
      { id: 'song', label: 'Song', value: chart.title, url: absolute(baseUrl, contentPath(chart, 'txt')) },
      {
        id: 'album',
        label: 'Album · First released',
        value: chart.album?.title ?? '—',
        detail: chart.album?.firstReleasedYear ? String(chart.album.firstReleasedYear) : undefined,
      },
    ],
    description: chartDescription(chart),
    url: absolute(baseUrl, contentPath(chart, 'txt')),
    emoji: '🎼',
  };
}

/** Voicing shapes of the chart, so a renderer never needs a second lookup. */
export function chartVoicings(chart) {
  return chart.chords.map((symbol) => {
    const voicing = VOICINGS[symbol];
    if (!voicing) return { symbol };
    return { symbol, frets: voicing.frets, fingers: voicing.fingers, position: voicing.position };
  });
}

/** Options returned by the `text` resource; the host fetches content on demand. */
export function toTextOption(chart, baseUrl) {
  return {
    id: chart.id,
    name: `${chart.title} — ${chart.artist?.name ?? 'Unknown artist'}`,
    description: chartSummary(chart),
    url: absolute(baseUrl, contentPath(chart, 'txt')),
    contentJsonUrl: absolute(baseUrl, contentPath(chart, 'json')),
    key: chart.key,
    capo: chart.capo,
    tempo: chart.tempo,
    time: chart.time,
    difficulty: chart.difficulty,
    updatedAt: chart.updatedAt,
  };
}

/**
 * Structured payload of one chart.
 *
 * The vocabulary follows the AC archive: a musical work (title and artist), a
 * playable version (key, capo, tempo), and the chord chart itself (`text`).
 * `content`, `source`, and `observability` reuse the shape of the Wikipedia
 * add-on so both add-ons are read the same way.
 */
export function toContentJson(chart, options) {
  const { baseUrl, requestId, durationMs, generatedAt } = options;
  const text = chart.text;
  const contentUrl = absolute(baseUrl, contentPath(chart, 'json'));
  return {
    id: chart.id,
    type: CHART_TYPE,
    title: chart.title,
    description: chartDescription(chart),
    extract: chartSummary(chart),
    musicalWork: {
      title: chart.title,
      artistSlug: chart.artist?.slug,
      artistName: chart.artist?.name,
      artistImage: chart.artist?.image ? absolute(baseUrl, chart.artist.image) : undefined,
      albumTitle: chart.album?.title,
      firstReleasedYear: chart.album?.firstReleasedYear,
      composers: chart.composers ?? [],
    },
    playableVersion: {
      id: `${chart.id}-original`,
      label: 'Original',
      key: chart.key,
      capo: chart.capo,
      tempo: chart.tempo,
      time: chart.time,
      difficulty: chart.difficulty,
    },
    notation: {
      format: 'chord-over-lyrics',
      sectionMarkers: 'square-brackets',
      annotationLines: 'parentheses',
      tuning: 'E A D G B E',
    },
    /**
     * The chart as a record, in the vocabulary of the AC archive: a playable
     * version points at one chart, the text is the canonical body, and a
     * checksum plus parser versions make a change detectable.
     */
    chordChart: {
      id: `${chart.id}-chart`,
      playableVersionId: `${chart.id}-original`,
      rawFormat: 'chord-over-lyrics',
      rawText: text,
      rawTextChecksum: checksumOf(text),
      sourceKey: chart.key,
      capo: chart.capo,
      instrumentId: 'guitar',
      tuningId: 'guitar-standard',
      parserVersion: PARSER_VERSION,
      astVersion: AST_VERSION,
      verifiedStatus: 'community',
      updatedAt: chart.updatedAt,
    },
    sections: chartSections(text),
    chords: chartVoicings(chart),
    tags: chart.tags ?? [],
    content: {
      text,
      charCount: Array.from(text).length,
      lineCount: text.split('\n').length,
      contentType: 'text/plain',
      encoding: 'utf-8',
    },
    source: {
      name: 'Chord chart catalogue',
      provider: 'addon-chord-catalog',
      origin: new URL(baseUrl).origin,
      url: contentUrl,
      license: CONTENT_LICENSE,
      notice: PROVENANCE_NOTICE,
    },
    observability: {
      requestId: requestId ?? 'not-recorded',
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      collectedAt: generatedAt ?? new Date(0).toISOString(),
    },
  };
}
