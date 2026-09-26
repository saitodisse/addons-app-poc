import type { AddonTab, HostAPI } from '@addons-poc/protocol';
import { loadEditableChart, structuredChartUrl } from './catalog';
import { LocalChordDrafts, DRAFTS_SERVICE, type DraftService } from './drafts';
import { editorMarkup, registerEditorElement, type ViewerRenderer } from './editor-element';
import { CONTENT_EDITOR_SERVICE, manifest } from './manifest';

export { manifest } from './manifest';
export { LocalChordDrafts, DRAFTS_SERVICE } from './drafts';

export interface EditorRequest {
  url: string;
  type?: string;
  name?: string;
}

export class ChartContentEditor {
  constructor(
    private readonly host: HostAPI,
    private readonly drafts: DraftService,
    private readonly load: typeof loadEditableChart = loadEditableChart,
  ) {}

  supports(request: EditorRequest): boolean {
    return (!request.type || request.type === 'chart') && Boolean(structuredChartUrl(request.url));
  }

  async render(request: EditorRequest): Promise<{ html: string; title: string }> {
    if (!this.supports(request)) throw new Error('This result is not an editable chord chart.');
    const chart = await this.load(request.url);
    const viewer = this.host.services.use<ViewerRenderer>({
      id: 'addons.chords.viewer', version: '^1.0.0', methods: [{ id: 'render' }],
    });
    if (!viewer) throw new Error('The chord viewer is required for the live preview.');
    const draft = await this.drafts.get({ sourceUrl: chart.sourceUrl });
    const staleDraft = draft.found && draft.baseChecksum !== chart.sourceChecksum;
    return {
      title: `Edit ${chart.title}${chart.artist ? ` — ${chart.artist}` : ''}`,
      html: editorMarkup({
        chart, drafts: this.drafts, viewer,
        monacoBase: new URL('./monaco/vs', import.meta.url).href,
        initialText: draft.found && typeof draft.text === 'string' ? draft.text : chart.originalText,
        staleDraft,
      }),
    };
  }
}

export function setup(host: HostAPI): void {
  registerEditorElement();
  const drafts = new LocalChordDrafts(host);
  host.registerService(DRAFTS_SERVICE, drafts);
  host.registerService(CONTENT_EDITOR_SERVICE, new ChartContentEditor(host, drafts));
  host.log('info', 'Chord editor configured successfully');
}

export function createTab(host: HostAPI): AddonTab {
  const editor = host.services.use<ChartContentEditor>({
    id: CONTENT_EDITOR_SERVICE, version: '^1.0.0', methods: [{ id: 'supports' }, { id: 'render' }],
  });
  const fields = [{ id: 'url', label: 'Chart content URL', type: 'url' as const, source: true, required: true }];
  const actions = [{ id: 'open', label: 'Open editor', source: true, receives: ['url'] }];
  return {
    title: '✏️ Chord editor',
    body: 'Open a published chart by its content URL and save a local draft.',
    fields,
    actions,
    async run(actionId, values) {
      if (actionId !== 'open') return { status: 'error', body: 'Unknown action.' };
      if (!editor) return { status: 'error', body: 'The editor service is unavailable.' };
      try {
        const view = await editor.render({ url: values.url ?? '' });
        return { status: 'success', title: view.title, body: 'Local chart editor.', view: { kind: 'html', html: view.html } };
      } catch (reason) {
        return { status: 'error', body: reason instanceof Error ? reason.message : String(reason) };
      }
    },
  };
}
