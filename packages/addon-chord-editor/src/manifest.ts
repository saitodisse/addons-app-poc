import { defineAddonManifest } from '@addons-poc/protocol';
import type { DataClassification, InteractionPayload, InteractionSchema } from '@addons-poc/protocol';
import { DRAFT_KEY_PREFIX, DRAFTS_SERVICE } from './drafts';

export const CONTENT_EDITOR_SERVICE = 'host.content-editor';

const string = (description: string, classification: DataClassification = 'public', format?: string): InteractionSchema => ({
  type: 'string', description, classification, ...(format ? { format } : {}),
});
const object = (description: string, classification: DataClassification = 'public', properties?: Record<string, InteractionSchema>, required?: string[]): InteractionSchema => ({
  type: 'object', description, classification,
  ...(properties ? { properties } : {}),
  ...(required?.length ? { required } : {}),
});
const boolean = (description: string): InteractionSchema => ({ type: 'boolean', description, classification: 'public' });
const payload = (description: string, schema: InteractionSchema): InteractionPayload => ({ description, schema });

const sourceUrl = string('Published content URL.', 'personal', 'uri');
const editorRequest = payload('Content URL of one result.', object('Content editor request.', 'personal', {
  url: string('Absolute content URL of the result.', 'personal', 'uri'),
  type: string('Declared type of the result.'),
  name: string('Displayed name of the result.'),
}, ['url']));
const draftLookup = payload('Published chart URL.', object('Draft lookup.', 'personal', { sourceUrl }, ['sourceUrl']));
const draftResult = payload('Draft lookup result.', object('Local draft result.', 'personal', {
  found: { type: 'boolean', description: 'Whether a draft exists.', classification: 'personal' },
  text: string('Locally edited chart text.', 'personal'),
  baseChecksum: string('Checksum of the source used when editing.', 'personal'),
}, ['found']));

export const manifest = defineAddonManifest({
  id: 'chord-editor',
  version: '1.0.0',
  name: 'Chord Chart Editor',
  description: 'Edits chord charts locally with Monaco and a live preview from the chord viewer.',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '✏️ Chord editor',
    body: 'Open a chart from a catalogue. Edits become local drafts in this browser; the published chart stays unchanged.',
  },
  entrypoint: '/packages/addon-chord-editor/dist/bundle.js',
  services: [
    { id: DRAFTS_SERVICE, version: '1.0.0', name: 'Local chord drafts', description: 'Stores and reads chart revisions by source URL.' },
    { id: CONTENT_EDITOR_SERVICE, version: '1.0.0', name: 'Content editor', description: 'Offers editing for compatible chart results.' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: ['registry.services', 'ui.tab', 'state-store'], optional: ['logs'] },
    services: [
      {
        id: DRAFTS_SERVICE,
        role: 'provides',
        version: '1.0.0',
        description: 'Stores local revisions separately from the published catalogue.',
        methods: [
          { id: 'get', description: 'Finds a draft by its source URL.', receives: draftLookup, returns: draftResult },
          {
            id: 'save',
            description: 'Saves an edited text against the source checksum.',
            receives: payload('Local revision.', object('Draft write.', 'personal', {
              sourceUrl,
              baseChecksum: string('Source text checksum.', 'personal'),
              text: string('Edited chart text.', 'personal'),
            }, ['sourceUrl', 'baseChecksum', 'text'])),
            returns: payload('Save confirmation.', object('Save result.', 'public', { saved: boolean('Whether the draft was saved.') }, ['saved'])),
          },
          {
            id: 'remove', description: 'Removes one local draft.', receives: draftLookup,
            returns: payload('Removal confirmation.', object('Removal result.', 'public', { removed: boolean('Whether the draft was removed.') }, ['removed'])),
          },
        ],
      },
      {
        id: CONTENT_EDITOR_SERVICE,
        role: 'provides',
        version: '1.0.0',
        description: 'Offers an editor for a result without teaching the host about chart data.',
        methods: [
          { id: 'supports', description: 'Answers whether this result can be edited.', receives: editorRequest, returns: payload('Support decision.', boolean('Whether the result is an editable chart.')) },
          { id: 'render', description: 'Builds the editing view for a chart result.', receives: editorRequest, returns: payload('Editing view.', object('Content editor view.', 'public', {
            html: string('Markup that mounts the editor.'),
            title: string('Heading of the editor.'),
          }, ['html'])) },
        ],
      },
      {
        id: 'addons.chords.viewer',
        role: 'consumes',
        version: '^1.0.0',
        required: true,
        description: 'Asks the independent viewer to render the live chart preview.',
        methods: [{
          id: 'render',
          description: 'Renders chart text into HTML.',
          receives: payload('Chart text and the settings applied to it.', object('Render request.', 'personal', {
            text: string('Chart text.', 'personal'),
            settings: object('Viewer settings.'),
            key: string('Declared key of the chart.'),
          })),
          returns: payload('Rendered HTML, the chords in use, and the chart summary.', object('Rendered chart.')),
        }],
      },
      {
        id: 'state-store',
        role: 'consumes',
        version: '^1.0.0',
        required: true,
        description: 'Keeps local drafts in this browser.',
        methods: [
          { id: 'get', description: 'Reads one draft.' },
          { id: 'set', description: 'Saves one draft.' },
          { id: 'remove', description: 'Removes one draft.' },
        ],
      },
    ],
    ui: {
      fields: [{
        id: 'url', label: 'Chart content URL', type: 'url', source: true,
        description: 'Published chart URL to open for local editing.', required: true,
        schema: sourceUrl,
      } as { id: string; label: string; description: string; required: boolean; schema: InteractionSchema }],
      actions: [{
        id: 'open', label: 'Open editor', source: true, receives: ['url'],
        description: 'Loads the chart and shows its local editor.',
        returns: payload('Editor tab response.', object('Tab response.')),
      } as { id: string; label: string; description: string; receives: string[]; returns: InteractionPayload }],
    },
    state: [{
      id: 'draft',
      description: 'A local revision keyed by its published content URL.',
      keyPattern: `${DRAFT_KEY_PREFIX}*`,
      operations: ['read', 'write', 'remove'],
      value: payload('Local chord draft.', object('Draft record.', 'personal', {
        sourceUrl,
        baseChecksum: string('Checksum of the published text.', 'personal'),
        text: string('Edited chart text.', 'personal'),
        updatedAt: string('Last save time.', 'personal', 'date-time'),
      }, ['sourceUrl', 'baseChecksum', 'text', 'updatedAt'])),
      retention: 'Until the local storage provider removes it or browser data is cleared.',
      deletionTrigger: 'Discard draft or clear local browser state.',
    }],
    http: [{
      id: 'chart-content', direction: 'outgoing', method: 'GET',
      origin: 'http://localhost:5295', path: '/text/chart/{id}/content.json',
      purpose: 'Reads the published chart and checksum before local editing.',
      returns: payload('Structured chart payload.', object('Chart payload.')),
    }],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Chord editor configured successfully', description: 'Confirms that editing and draft services were registered.' }],
  },
});
