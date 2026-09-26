import { defineAddonManifest } from '@addons-poc/protocol';
import { CATALOGS } from './data/charts.js';

/**
 * Chord-chart catalogue manifest.
 *
 * The add-on publishes only metadata for listing and searching; the chart text
 * is delivered on demand by the content routes, in the two-stage flow of the
 * protocol. The contract describes every route and its expected payload.
 */
const string = (description, classification = 'public', format) => ({
  type: 'string',
  description,
  classification,
  ...(format ? { format } : {}),
});

const integer = (description, classification = 'public') => ({ type: 'integer', description, classification });

const object = (description, classification, properties, required = []) => ({
  type: 'object',
  description,
  classification,
  properties,
  ...(required.length ? { required } : {}),
});

const array = (description, classification, items) => ({ type: 'array', description, classification, items });

const payload = (description, schema) => ({ description, schema });

const chartDisplayFieldSchema = object('One provider-defined display field.', 'public', {
  id: string('Stable field identifier.'),
  label: string('Column heading shown by the host.'),
  value: string('Plain-text field value.'),
  detail: string('Optional secondary plain-text value.'),
  image: string('Optional image URL associated with this field.', 'public', 'uri'),
  url: string('Optional URL opened from this field.', 'public', 'uri'),
}, ['id', 'label', 'value']);

const pageFields = {
  limit: integer('Maximum number of rows requested for this page.'),
  cursor: string('Opaque cursor received from the previous page.', 'personal'),
};

const incoming = (description, properties, required) => payload(
  description,
  object(description, 'personal', properties, required),
);

const paginationSchema = object('Continuation of the listing.', 'public', {
  limit: integer('Effective page size.'),
  total: integer('Known total of rows for this query.'),
  next: string('Opaque cursor for the next page.'),
}, ['limit']);

const chartMetaSchema = object('One chart normalized for the host table.', 'public', {
  id: string('Chart identifier.'),
  type: string('Resource type, always chart.'),
  name: string('Chart title.'),
  artist: string('Artist name.'),
  description: string('Artist, key, and tempo in one line.'),
  url: string('Plain-text content URL served by this add-on.', 'public', 'uri'),
  emoji: string('Emoji used by the host row.'),
  image: string('Artist portrait used by the host row.', 'public', 'uri'),
  displayFields: array('Generic table columns and values supplied by the catalogue.', 'public', chartDisplayFieldSchema),
}, ['id', 'type', 'name', 'url']);

const metasResponse = (description) => payload(description, object(description, 'public', {
  metas: array('Rows found.', 'public', chartMetaSchema),
  pagination: paginationSchema,
}, ['metas']));

const voicingSchema = object('One chord shape.', 'public', {
  symbol: string('Chord symbol as it appears in the chart.'),
  frets: string('Six strings from the lowest to the highest; x means muted.'),
  fingers: string('Finger used on each string; 0 means none.'),
  position: integer('Base fret of the shape.'),
}, ['symbol']);

const sectionSchema = object('One section of the chart.', 'public', {
  title: string('Section title without the brackets.'),
  line: integer('Zero-based line where the section starts.'),
}, ['title', 'line']);

const chartContentSchema = object('Chart text and its measures.', 'public', {
  text: string('Complete chart text: chord lines, lyrics, and section markers.', 'public'),
  charCount: integer('Number of Unicode characters.'),
  lineCount: integer('Number of lines.'),
  contentType: string('MIME type of the text content.'),
  encoding: string('Text content encoding.'),
}, ['text', 'charCount', 'lineCount', 'contentType', 'encoding']);

const chartSourceSchema = object('Origin and licence of the delivered chart.', 'public', {
  name: string('Name of the catalogue.'),
  provider: string('Add-on that answered the request.'),
  origin: string('HTTP origin of the add-on.', 'public', 'uri'),
  url: string('Exact content URL.', 'public', 'uri'),
  license: string('Licence declared for the text.'),
  notice: string('Provenance notice for the demo data set.'),
}, ['name', 'provider', 'origin', 'url', 'license', 'notice']);

const chartRecordSchema = object('Chart record, in the vocabulary of the AC archive.', 'public', {
  id: string('Record identifier.'),
  playableVersionId: string('Version this chart belongs to.'),
  rawFormat: string('Notation family of the raw text.'),
  rawText: string('Canonical chart text.'),
  rawTextChecksum: string('SHA-256 of the raw text, so a change is detectable.'),
  sourceKey: string('Key of the chart as published.'),
  capo: integer('Capo fret declared by the author.'),
  instrumentId: string('Instrument assumed by the shapes.'),
  tuningId: string('Tuning assumed by the shapes.'),
  parserVersion: string('Parser version the text is published against.'),
  astVersion: string('AST version the text is published against.'),
  verifiedStatus: string('Editorial status of the chart.'),
  updatedAt: string('Date of the last update.', 'public', 'date-time'),
}, ['id', 'playableVersionId', 'rawFormat', 'rawText', 'rawTextChecksum', 'sourceKey']);

const chartJsonSchema = object('Structured chart payload consumed by a renderer.', 'public', {
  id: string('Chart identifier.'),
  type: string('Resource type, always chart.'),
  title: string('Chart title.'),
  description: string('Artist, key, and tempo in one line.'),
  extract: string('Notation summary in one sentence.'),
  musicalWork: object('Work the chart belongs to.', 'public', {
    title: string('Work title.'),
    artistSlug: string('Artist slug.'),
    artistName: string('Artist display name.'),
    artistImage: string('Generated demo portrait URL for the artist.', 'public', 'uri'),
    albumTitle: string('Album that first released this song.'),
    firstReleasedYear: integer('Year the album was first released.'),
    composers: array('Composers credited for the work.', 'public', string('Composer name.')),
  }, ['title']),
  playableVersion: object('Version of the work this chart describes.', 'public', {
    id: string('Version identifier.'),
    label: string('Version label.'),
    key: string('Declared musical key.'),
    capo: integer('Capo fret declared by the author; 0 means none.'),
    tempo: integer('Suggested tempo in beats per minute.'),
    time: string('Time signature.'),
    difficulty: integer('Difficulty from 1 to 5.'),
  }, ['id', 'key']),
  notation: object('Notation rules of the delivered text.', 'public', {
    format: string('Chord-over-lyrics is the supported layout.'),
    sectionMarkers: string('How section titles are marked.'),
    annotationLines: string('How instrumental annotations are marked.'),
    tuning: string('Tuning assumed by the chord shapes.'),
  }, ['format']),
  sections: array('Sections found in the text, in reading order.', 'public', sectionSchema),
  chordChart: chartRecordSchema,
  chords: array('Shapes used by the chart.', 'public', voicingSchema),
  tags: array('Free tags of the chart.', 'public', string('Tag.')),
  content: chartContentSchema,
  source: chartSourceSchema,
  observability: object('Collection identifiers and timings.', 'public', {
    requestId: string('Identifier correlating the request with debug data.'),
    durationMs: integer('Time spent building the response.'),
    collectedAt: string('Time when the payload was built.', 'public', 'date-time'),
  }, ['requestId', 'durationMs', 'collectedAt']),
}, ['id', 'type', 'title', 'content', 'chords', 'source']);

const textOptionSchema = object('One deliverable version of a chart.', 'public', {
  id: string('Chart identifier.'),
  name: string('Title and artist.'),
  description: string('Notation summary of the chart.'),
  url: string('Plain-text content URL.', 'public', 'uri'),
  contentJsonUrl: string('Structured content URL.', 'public', 'uri'),
  key: string('Declared musical key.'),
  capo: integer('Capo fret declared by the author.'),
  tempo: integer('Suggested tempo in beats per minute.'),
  time: string('Time signature.'),
  difficulty: integer('Difficulty from 1 to 5.'),
  updatedAt: string('Date of the last update.', 'public', 'date-time'),
}, ['id', 'url', 'contentJsonUrl']);

const trafficEntrySchema = object('One HTTP exchange observed by the server.', 'public', {
  sequence: integer('Sequence number within the process.'),
  recordedAt: string('Time when the entry was recorded.', 'public', 'date-time'),
  source: string('Component that observed the exchange.'),
  requestId: string('Identifier correlating attempt and response.'),
  direction: string('Direction relative to the add-on.'),
  phase: string('Request or response phase.'),
  method: string('HTTP method.'),
  url: string('Observed URL.', 'public', 'uri'),
  path: string('Observed local route.'),
  status: integer('Returned HTTP status.'),
  ok: integer('One when the response succeeded, zero otherwise.'),
  durationMs: integer('Operation duration in milliseconds.'),
});

export const manifest = defineAddonManifest({
  id: 'chord-catalog',
  version: '1.0.0',
  name: 'Chord Chart Catalogue',
  description: 'Lists and searches chord charts, and delivers chart text with its shapes.',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '🎼 Chord charts',
    body: 'A catalogue of chord charts served over HTTP. Use the global search to find a chart by title, artist, key, tag, chord, or lyric; the content routes deliver the chart text and its shapes.',
  },
  resources: [
    { name: 'catalog', types: ['chart'], idPrefixes: [] },
    { name: 'search', types: ['chart'], idPrefixes: [] },
    { name: 'text', types: ['chart'], idPrefixes: [] },
  ],
  types: ['chart'],
  idPrefixes: [],
  catalogs: CATALOGS.map(({ id, name }) => ({ type: 'chart', id, name })),
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      {
        id: 'catalog',
        direction: 'incoming',
        method: 'GET',
        path: '/catalog/{type}/{catalogId}.json?limit={limit}&cursor={cursor}',
        purpose: 'Lists one named view of the catalogue, ordered by recency, visits, difficulty, or title.',
        resource: 'catalog',
        receives: incoming('Parameters the host sends to list a catalogue view.', {
          type: string('Type requested by the host.'),
          catalogId: string('Catalogue view: recent, popular, beginner, or alphabetical.'),
          ...pageFields,
        }, ['type', 'catalogId']),
        returns: metasResponse('Rows of the requested view and its pagination.'),
      },
      {
        id: 'search',
        direction: 'incoming',
        method: 'GET',
        path: '/search/{type}/{query}.json?limit={limit}&cursor={cursor}',
        purpose: 'Searches charts by title, artist, composer, key, tag, chord symbol, or lyric word.',
        resource: 'search',
        receives: incoming('Parameters the host sends to search charts.', {
          type: string('Type requested by the host.'),
          query: string('Term entered by the person.', 'personal'),
          ...pageFields,
        }, ['type', 'query']),
        returns: metasResponse('Rows that matched every term of the query.'),
      },
      {
        id: 'text',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}.json',
        purpose: 'Lists the deliverable versions of one chart and their content links.',
        resource: 'text',
        receives: incoming('Parameters the host sends to discover a chart version.', {
          type: string('Type requested by the host.'),
          id: string('Chart identifier.'),
        }, ['type', 'id']),
        returns: payload('Available versions and their links.', object('Object with texts.', 'public', {
          texts: array('Available versions.', 'public', textOptionSchema),
        }, ['texts'])),
      },
      {
        id: 'artist-image',
        direction: 'incoming',
        method: 'GET',
        path: '/artists/{artistSlug}.png',
        purpose: 'Delivers one generated demo artist portrait for catalogue rows.',
        receives: incoming('Requested artist portrait.', {
          artistSlug: string('Artist slug used to select a local image file.'),
        }, ['artistSlug']),
        returns: payload('PNG portrait bytes served as image/png.', string('Binary image response body.')),
      },
      {
        id: 'content',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.txt',
        purpose: 'Returns the chart text exactly as authored, for plain-text readers.',
        receives: incoming('Parameters the host sends to read the chart text.', {
          type: string('Type requested by the host.'),
          id: string('Chart identifier.'),
        }, ['type', 'id']),
        returns: payload('Chart text with chord lines, lyrics, and section markers.', string('Chart text.')),
      },
      {
        id: 'content-json',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.json',
        purpose: 'Returns the structured chart payload, including sections and chord shapes, without changing content.txt.',
        receives: incoming('Parameters a renderer sends to read the structured chart.', {
          type: string('Type requested by the host.'),
          id: string('Chart identifier.'),
        }, ['type', 'id']),
        returns: payload('Structured chart payload.', chartJsonSchema),
      },
      {
        id: 'debug-traffic',
        direction: 'incoming',
        method: 'GET',
        path: '/debug/traffic.json',
        purpose: 'Exposes the recent HTTP history of this server to the host observability panel.',
        returns: payload('Recent exchanges of the current process.', object('Traffic history.', 'public', {
          addon: string('Add-on identifier.'),
          generatedAt: string('Time when the history was read.', 'public', 'date-time'),
          retainedEntries: integer('Number of entries currently retained.'),
          maxEntries: integer('Process retention limit.'),
          entries: array('Retained exchanges.', 'public', trafficEntrySchema),
        }, ['addon', 'generatedAt', 'entries'])),
      },
    ],
    logs: [
      { id: 'lifecycle', level: 'info', message: 'Chord chart catalogue configured successfully', description: 'Confirms that the server started with a valid manifest.' },
      { id: 'chart-served', level: 'info', message: 'Chart served', description: 'Records which chart was delivered and in which format.', details: payload('Served chart and format.', object('Served chart.', 'public', {
        id: string('Chart identifier.'),
        format: string('Delivered format: txt or json.'),
      }, ['id', 'format'])) },
    ],
  },
});
