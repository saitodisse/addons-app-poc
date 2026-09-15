import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonTab, HostAPI } from '@addons-poc/protocol';
import { createTabStatePersistence } from '@addons-poc/protocol';
import { toMarkdown, htmlFromMarkdown } from './formatting';

export const manifest = defineAddonManifest({
  id: 'markdown',
  version: '1.0.0',
  name: 'Markdown Add-on',
  description: 'Format text as Markdown and HTML (service consumer)',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '📝 Markdown',
    body: 'Transform a title and content into Markdown and HTML.',
  },
  entrypoint: '/packages/addon-markdown/dist/bundle.js',
  services: [
    { id: 'addons.markdown.text-formatter', version: '1.0.0', name: 'Text Formatter', description: 'Formats a title and content as Markdown/HTML' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.markdown.text-formatter', role: 'provides', version: '1.0.0', description: 'Converts a title and content to Markdown and HTML.', methods: [{ id: 'format', description: 'Formats text.', receives: { description: 'Text title and content.', schema: { type: 'object', description: 'Text data.', classification: 'personal', properties: { title: { type: 'string', description: 'Title.', classification: 'personal' }, content: { type: 'string', description: 'Content.', classification: 'personal' } }, required: ['title', 'content'] } }, returns: { description: 'Text in Markdown and HTML.', schema: { type: 'object', description: 'Formatted text.', classification: 'personal' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Stores the tab when a state provider is active.', required: false, methods: [{ id: 'get', description: 'Reads the saved tab.' }, { id: 'set', description: 'Writes the tab.' }] }],
    ui: { fields: [{ id: 'title', label: 'Title', description: 'Title of the text to format.', required: true, schema: { type: 'string', description: 'Provided title.', classification: 'personal' } }, { id: 'content', label: 'Content', description: 'Content of the text to format.', required: true, schema: { type: 'string', description: 'Provided content.', classification: 'personal' } }], actions: [{ id: 'format', label: 'Format', description: 'Generates Markdown and HTML locally.', receives: ['title', 'content'], returns: { description: 'Displayed Markdown and HTML as a response item.', schema: { type: 'object', description: 'Formatted text.', classification: 'personal' } } }] },
    state: [{ id: 'tab', description: 'Fields and the last displayed formatting.', key: 'markdown:tab', operations: ['read', 'write'], value: { description: 'Tab visual state.', schema: { type: 'object', description: 'Title, content, and response.', classification: 'personal' } }, retention: 'While the storage provider selected by the host retains the state.', deletionTrigger: 'Provider cleanup or browser data removal.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Markdown add-on configured successfully', description: 'Confirms add-on activation.' }],
  },
});

/** Formatter service constructor, kept inside this add-on. */
export function createTextFormatter() {
  return {
    format(source: { title: string; content: string }) {
      const md = toMarkdown(source.title, source.content);
      return { title: source.title, markdown: md, html: htmlFromMarkdown(md) };
    },
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.markdown.text-formatter', createTextFormatter());
  host.log('info', 'Markdown add-on configured successfully');
}

export function createTab(host: HostAPI): AddonTab {
  const formatter = host.services.use<ReturnType<typeof createTextFormatter>>({ id: 'addons.markdown.text-formatter' });
  return {
    ...manifest.contract.ui,
    fields: [
      { id: 'title', label: 'Title', placeholder: 'Text title', required: true },
      { id: 'content', label: 'Content', type: 'textarea', placeholder: 'Write the content', required: true },
    ],
    actions: [{ id: 'format', label: 'Format' }],
    persistence: createTabStatePersistence(host, 'markdown:tab'),
    run(actionId, values) {
      if (actionId !== 'format') return { status: 'error', body: 'Unknown action.' };
      if (!formatter) return { status: 'error', body: 'Formatting service unavailable.' };
      const title = values.title?.trim();
      const content = values.content?.trim();
      if (!title || !content) {
        host.log('warn', 'Formatting rejected: missing fields');
        return { status: 'error', body: 'Enter a title and content.' };
      }
      const formatted = formatter.format({ title, content });
      host.log('info', 'Text formatted', { title, characters: content.length });
      return {
        status: 'success',
        title: 'Formatted text',
        body: formatted.markdown,
        items: [{ label: 'HTML', value: formatted.html }],
      };
    },
  };
}
