import { defineAddonManifest } from '@addons-poc/protocol';
import { SETTINGS_KEY, CHART_KEY, SONG_KEY_PREFIX } from './state';
import { TAB_ACTIONS, TAB_FIELDS } from './tab-definition';

/**
 * Chord-chart viewer manifest.
 *
 * An in-process add-on: it publishes a rendering service, consumes the optional
 * `state-store` capability, and reads charts from a catalogue over HTTP. The
 * catalogue is reached through its manifest URL, never by importing it.
 */

/** Default origin of the demo catalogue, declared for transparency. */
export const DEFAULT_CATALOG_ORIGIN = 'http://localhost:5295';

const text = (description: string, classification = 'public') => ({ type: 'string', description, classification });
const whole = (description: string, classification = 'public') => ({ type: 'integer', description, classification });
const object = (description: string, classification = 'public', properties?: Record<string, unknown>, required?: string[]) => ({
  type: 'object',
  description,
  classification,
  ...(properties ? { properties } : {}),
  ...(required?.length ? { required } : {}),
});
const list = (description: string, items?: Record<string, unknown>) => ({
  type: 'array',
  description,
  classification: 'public',
  ...(items ? { items } : {}),
});
const payload = (description: string, schema: Record<string, unknown>) => ({ description, schema });

/**
 * Every control travels as text, because that is what a tab action receives;
 * the declared `type` only tells the host how to render the input.
 */
const fieldSchema = (id: string) => {
  const field = TAB_FIELDS.find((candidate) => candidate.id === id)!;
  return text(field.description, field.classification ?? 'public');
};

export const manifest = defineAddonManifest({
  id: 'chord-viewer',
  version: '1.0.0',
  name: 'Chord Chart Viewer',
  description: 'Renders a chord chart with controls for transposition, layout, shapes, and colors.',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '🎸 Chord viewer',
    body: 'Load a chart from a chord-chart catalogue (or paste one) and change how it is rendered: transposition, layout, line width, shapes, and colors.',
  },
  entrypoint: '/packages/addon-chord-viewer/dist/bundle.js',
  services: [
    {
      id: 'addons.chords.viewer',
      version: '1.0.0',
      name: 'Chord chart renderer',
      description: 'Parses and renders chord charts into text with the requested settings',
    },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [
      {
        id: 'addons.chords.viewer',
        role: 'provides',
        version: '1.0.0',
        description: 'Turns chart text into rendered lines and reports the chords in use.',
        methods: [
          {
            id: 'parse',
            description: 'Parses chart text into sections, tokens, and the chords found.',
            receives: payload('Chart text to parse.', object('Chart text.', 'personal', { text: text('Chart text.', 'personal') })),
            returns: payload('Sections, lines, tokens, diagnostics, and the chords found.', object('Parsed chart summary.')),
          },
          {
            id: 'render',
            description: 'Parses the chart and renders it with the requested settings.',
            receives: payload('Chart text and the settings applied to it.', object('Render request.', 'personal', {
              text: text('Chart text.', 'personal'),
              settings: object('Viewer settings.'),
              key: text('Declared key of the chart.'),
            })),
            returns: payload('Rendered HTML, the chords in use, and the chart summary.', object('Rendered chart.')),
          },
        ],
      },
      {
        id: 'host.content-view',
        role: 'provides',
        version: '1.0.0',
        description: 'Renders a chord-chart result as HTML for the host result page.',
        methods: [
          {
            id: 'render',
            description: 'Renders the chart behind a content URL, or declines the URL.',
            receives: payload('Content URL of one result.', object('Content view request.', 'personal', {
              url: text('Absolute content URL of the result.', 'personal', 'uri'),
              type: text('Declared type of the result.'),
              name: text('Displayed name of the result.'),
            })),
            returns: payload('Rendered chart, or nothing when the URL is not a chord chart.', object('Content view response.')),
          },
        ],
      },
      {
        id: 'state-store',
        role: 'consumes',
        version: '^1.0.0',
        description: 'Keeps the controls and the loaded chart when a storage provider is active.',
        required: false,
        methods: [
          { id: 'get', description: 'Reads the stored controls and chart.' },
          { id: 'set', description: 'Writes the stored controls and chart.' },
        ],
      },
      {
        id: 'addons.chords.drafts',
        role: 'consumes',
        version: '^1.0.0',
        description: 'Reads a locally saved chart revision when an editor is active.',
        required: false,
        methods: [{
          id: 'get',
          description: 'Reads a local draft by the published content URL.',
          receives: payload('Published chart URL.', object('Draft lookup.', 'personal', {
            sourceUrl: text('Published content URL.', 'personal', 'uri'),
          }, ['sourceUrl'])),
          returns: payload('Draft lookup result.', object('Local draft result.', 'personal', {
            found: { type: 'boolean', description: 'Whether a draft exists.', classification: 'personal' },
            text: text('Locally edited chart text.', 'personal'),
            baseChecksum: text('Checksum of the source used when editing.', 'personal'),
          }, ['found'])),
        }],
      },
    ],
    ui: {
      fields: TAB_FIELDS.map((field) => ({
        id: field.id,
        label: field.label,
        description: field.description,
        required: Boolean(field.required),
        ...(field.type ? { type: field.type } : {}),
        ...(field.group ? { group: field.group } : {}),
        ...(field.source ? { source: true } : {}),
        ...(field.min !== undefined ? { min: field.min } : {}),
        ...(field.max !== undefined ? { max: field.max } : {}),
        ...(field.step !== undefined ? { step: field.step } : {}),
        schema: fieldSchema(field.id),
      })),
      actions: TAB_ACTIONS.map((action) => ({
        id: action.id,
        label: action.label,
        description: action.description,
        ...(action.group ? { group: action.group } : {}),
        ...(action.source ? { source: true } : {}),
        ...(action.live ? { live: true } : {}),
        ...(action.receives ? { receives: action.receives } : {}),
        returns: payload('Rendered chart and the current controls.', object('Tab response.')),
      })),
    },
    state: [
      {
        id: 'settings',
        description: 'Controls shared by every chart: layout, colours, sections, page, and options.',
        key: SETTINGS_KEY,
        operations: ['read', 'write', 'remove'],
        value: payload('Viewer controls.', object('Control values.')),
        retention: 'While the storage provider selected by the host retains the state.',
        deletionTrigger: 'Provider cleanup, browser data removal, or the restore action.',
        fallback: 'memory',
      },
      {
        id: 'chart',
        description: 'Chart loaded from a catalogue, stored with its text and shapes.',
        key: CHART_KEY,
        operations: ['read', 'write', 'remove'],
        value: payload('Loaded chart.', object('Chart text, metadata, and shapes.')),
        retention: 'While the storage provider selected by the host retains the state; replaced when another chart is loaded.',
        deletionTrigger: 'Provider cleanup or browser data removal.',
        fallback: 'memory',
      },
      {
        id: 'song',
        description: 'Controls kept for one chart: its font size and its transposition.',
        keyPattern: `${SONG_KEY_PREFIX}*`,
        operations: ['read', 'write', 'remove'],
        value: payload('Controls of one chart.', object('Font size and transposition of one chart.')),
        retention: 'While the storage provider selected by the host retains the state; one record per chart read.',
        deletionTrigger: 'Provider cleanup, browser data removal, or the restore action.',
        fallback: 'memory',
      },
    ],
    http: [
      {
        id: 'catalog-list',
        direction: 'outgoing',
        method: 'GET',
        origin: DEFAULT_CATALOG_ORIGIN,
        path: '/catalog/chart/{catalogId}.json?limit={limit}&cursor={cursor}',
        purpose: 'Lists the charts of the configured catalogue without importing its code.',
        returns: payload('Catalogue rows and their pagination.', object('Catalogue page.')),
      },
      {
        id: 'catalog-text',
        direction: 'outgoing',
        method: 'GET',
        origin: DEFAULT_CATALOG_ORIGIN,
        path: '/text/chart/{id}.json',
        purpose: 'Discovers the content links of one chart.',
        returns: payload('Versions published for the chart.', object('Text options.')),
      },
      {
        id: 'catalog-content',
        direction: 'outgoing',
        method: 'GET',
        origin: DEFAULT_CATALOG_ORIGIN,
        path: '/text/chart/{id}/content.json',
        purpose: 'Reads the structured chart payload used by the renderer.',
        returns: payload('Structured chart payload.', object('Chart payload.')),
      },
    ],
    logs: [
      { id: 'lifecycle', level: 'info', message: 'Chord viewer configured successfully', description: 'Confirms that the rendering service was registered.' },
      { id: 'action', level: 'info', message: 'Control applied', description: 'Records which control was applied and what happened.', details: payload('Applied control.', object('Control details.')) },
      { id: 'load-failure', level: 'warn', message: 'Chart could not be loaded', description: 'Records a catalogue or content failure without interrupting the tab.', details: payload('Failure details.', object('Failure details.')) },
    ],
  },
});
