import type { AddonTab, AddonTabResult, HostAPI } from '@addons-poc/protocol';
import { manifest, DEFAULT_CATALOG_ORIGIN } from './manifest';
import { CatalogClient, chartFromText, type ChartRecord } from './catalog-client';
import { ChordViewerService, type RenderResponse } from './service';
import { simplifyChartText } from './chart-transform';
import {
  DEFAULT_SETTINGS,
  applyPreset,
  describeSettings,
  normalizeSettings,
  settingsToValues,
  valuesToSettings,
  type ViewerPresetKind,
  type ViewerSettings,
} from './settings';
import { createViewerState, type ViewerState } from './state';
import { CONTENT_VIEW_SERVICE, ChartContentViewProvider } from './content-view';
import { CATALOG_FIELD, CHART_FIELD, TAB_ACTIONS, TAB_FIELDS, TEXT_FIELD } from './tab-definition';

interface DraftLookup {
  get(request: { sourceUrl: string }): Promise<{ found: boolean; text?: string; baseChecksum?: string }>;
}

async function chartWithDraft(host: HostAPI, chart: ChartRecord): Promise<ChartRecord> {
  if (!chart.contentJsonUrl || !chart.sourceChecksum) return chart;
  const drafts = host.services.use<DraftLookup>({
    id: 'addons.chords.drafts',
    version: '^1.0.0',
    methods: [{ id: 'get' }],
  });
  if (!drafts) return chart;
  try {
    const draft = await drafts.get({ sourceUrl: chart.contentJsonUrl });
    return draft.found && draft.baseChecksum === chart.sourceChecksum && typeof draft.text === 'string'
      ? { ...chart, text: draft.text }
      : chart;
  } catch {
    return chart;
  }
}

export { manifest } from './manifest';
export { ChordViewerService } from './service';
export { CONTENT_VIEW_SERVICE, ChartContentViewProvider } from './content-view';

/**
 * A tab response that may carry a rendered view.
 *
 * The field is declared in `packages/protocol/src/domain/tab.ts` and reaches
 * consumers on the next publication of `@addons-poc/protocol`. Until then the
 * add-on describes the response with this local extension.
 */
type TabResponse = AddonTabResult & { view?: { kind: 'text' } | { kind: 'html'; html: string } };

const WELCOME = [
  'No chart is loaded yet.',
  '',
  `1. Keep the catalogue URL (${DEFAULT_CATALOG_ORIGIN}) in the first field.`,
  '2. Press "List charts" to see the identifiers published by the catalogue.',
  '3. Type an identifier in "Chart" and press "Load chart".',
  '',
  'A chart text or a structured payload can also be pasted in the third field.',
].join('\n');

const HELP = 'Type a chart identifier, paste a content URL, or paste the chart itself.';

function item(label: string, value: string): { label: string; value: string } {
  return { label, value };
}

/**
 * Controls of this activation.
 *
 * The tab and the content view share one state, so a change made in the panel
 * of a result page is the change the result is rendered with. `setup` creates
 * it, and `createTab` reuses it.
 */
let sharedState: ViewerState | undefined;

function viewerState(host: HostAPI): ViewerState {
  sharedState = sharedState ?? createViewerState(host);
  return sharedState;
}

interface LocalResourceClient {
  request(input: { url: string }): Promise<{ status: number; contentType: string; body: string } | undefined>;
}

function resourceClient(host: HostAPI): CatalogClient {
  return new CatalogClient(async (url) => {
    const provider = host.services.use<LocalResourceClient>({ id: 'host.resource-client', version: '^1.0.0', methods: [{ id: 'request' }] });
    const response = await provider?.request({ url });
    return response ? new Response(response.body, { status: response.status, headers: { 'Content-Type': response.contentType } }) : fetch(url);
  });
}

export function setup(host: HostAPI): void {
  // A new activation starts from this host, which keeps the two services in sync.
  sharedState = createViewerState(host);
  host.registerService('addons.chords.viewer', new ChordViewerService());
  const readable = viewerState(host);
  // The host asks this service to render a chord-chart result on its own page.
  host.registerService(CONTENT_VIEW_SERVICE, new ChartContentViewProvider({
    client: resourceClient(host),
    settings: async () => {
      await readable.ready();
      return readable.settings();
    },
    // The chart opened on the result page is the chart the panel edits, so a
    // control change renders from memory instead of reading the URL again.
    adopt: async (chart) => {
      await readable.ready();
      await readable.setChart(chart);
    },
    withDraft: (chart) => chartWithDraft(host, chart),
  }));
  host.log('info', 'Chord viewer configured successfully');
}

export function createTab(host: HostAPI): AddonTab {
  const service = host.services.use<ChordViewerService>({
    id: 'addons.chords.viewer',
    version: '^1.0.0',
    methods: [{ id: 'parse' }, { id: 'render' }],
  });
  const state = viewerState(host);
  const client = resourceClient(host);

  /** Text the renderer reads: the chart as authored, or simplified on demand. */
  function sourceText(chart: ChartRecord, settings: ViewerSettings): string {
    return settings.simplifyChords ? simplifyChartText(chart.text) : chart.text;
  }

  function header(chart: ChartRecord, rendered: RenderResponse, settings: ViewerSettings): string {
    const keys = [
      `key ${chart.key ?? rendered.key ?? '?'}${rendered.keyInferred ? ' (inferred)' : ''}`,
      `playing ${rendered.shapeKey ?? chart.key ?? '?'}`,
      ...(chart.capo ? [`capo ${chart.capo} declared by the chart`] : []),
    ].join(' · ');
    const tempo = chart.tempo ? `${chart.tempo} BPM${chart.time ? ` ${chart.time}` : ''}` : 'tempo not declared';
    return `${chart.title} — ${chart.artist}\n${keys} · ${tempo}`;
  }

  async function renderCurrent(note?: string): Promise<TabResponse> {
    await state.ready();
    const settings = state.settings();
    const chart = state.chart();

    if (!chart) {
      return {
        status: 'info',
        title: 'Chord viewer',
        body: WELCOME,
        items: describeSettings(settings).map((row) => item(row.label, row.value)),
        values: settingsToValues(settings),
      };
    }
    if (!service) {
      return { status: 'error', body: 'The rendering service is unavailable, so the chart cannot be shown.' };
    }

    const text = sourceText(chart, settings);
    const rendered = service.render({
      text,
      settings,
      ...(chart.key ? { key: chart.key } : {}),
    });

    const items = [
      ...describeSettings(settings, rendered.shapeKey).map((row) => item(row.label, row.value)),
      item('Chart', `${chart.title} — ${chart.artist}`),
      item('Sections', `${rendered.sections} · ${rendered.chordTokens} chord tokens · ${rendered.lines} lines`),
      item('Played as', rendered.playedChords.join(' · ') || 'no chords found'),
      item('Parser', `tab-renderer ${rendered.parserVersion}`),
      item('Source', chart.contentJsonUrl ?? 'pasted text'),
      item('Storage', state.usesStorage() ? 'state-store active' : 'memory only'),
      ...(rendered.diagnostics > 0 ? [item('Diagnostics', `${rendered.diagnostics} line(s) reported by the parser`)] : []),
    ];

    // The body keeps the chart readable for a host that does not render the view.
    const body = [settings.summaryOpen ? header(chart, rendered, settings) : '', text]
      .filter(Boolean)
      .join('\n\n');

    return {
      status: 'success',
      title: note ?? `${chart.title} — ${chart.artist}`,
      body,
      items,
      view: { kind: 'html', html: rendered.html },
      // The panel follows the settings this add-on really used.
      values: settingsToValues(settings),
    };
  }

  async function inspectCurrent(): Promise<TabResponse> {
    await state.ready();
    const chart = state.chart();
    if (!chart) return { status: 'info', title: 'Data format', body: WELCOME };
    if (!service) return { status: 'error', body: 'The rendering service is unavailable.' };

    const settings = state.settings();
    const text = sourceText(chart, settings);
    const summary = service.parse({ text });
    const rendered = service.render({ text, settings, ...(chart.key ? { key: chart.key } : {}) });
    const model = {
      chart: {
        id: chart.id,
        title: chart.title,
        artist: chart.artist,
        key: chart.key,
        capo: chart.capo,
        tempo: chart.tempo,
        time: chart.time,
        source: chart.contentJsonUrl ?? 'pasted text',
      },
      settings,
      // The record this chart keeps, which is what travels between sessions.
      song: state.songSettings(),
      parse: summary,
      render: {
        sections: rendered.sections,
        lines: rendered.lines,
        chordTokens: rendered.chordTokens,
        playedChords: rendered.playedChords,
        shapeKey: rendered.shapeKey,
        htmlCharacters: rendered.html.length,
      },
    };
    return {
      status: 'info',
      title: 'Data format',
      body: `Parsed model of ${chart.title}, as reported by the ported tab renderer.\n\n${JSON.stringify(model, null, 2)}`,
      items: [item('Chords found', summary.chordsFound.join(' · ') || 'none'), item('Sections', String(summary.sections))],
    };
  }

  async function loadChart(values: Record<string, string>): Promise<TabResponse> {
    const pasted = (values[TEXT_FIELD] ?? '').trim();
    const base = (values[CATALOG_FIELD] ?? '').trim() || DEFAULT_CATALOG_ORIGIN;
    const target = (values[CHART_FIELD] ?? '').trim();

    try {
      let chart: ChartRecord | undefined;
      if (pasted) {
        chart = chartFromText(pasted, target || 'pasted');
        if (!chart) return { status: 'error', body: 'The pasted content is neither chart text nor a structured payload.' };
      } else if (/^https?:\/\//u.test(target)) {
        chart = await client.chartFromUrl(target);
      } else {
        if (!target) return { status: 'info', title: 'Nothing to load', body: HELP };
        chart = await client.chart(base, target);
      }

      await state.setChart(await chartWithDraft(host, chart));
      host.log('info', `Chart loaded: ${chart.id}`, { action: 'load', chart: chart.id });
      return renderCurrent(`Loaded ${chart.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      host.log('warn', 'Chart could not be loaded', { action: 'load', error: message });
      return { status: 'error', title: 'Chart could not be loaded', body: `${message}\n\n${HELP}` };
    }
  }

  async function listCharts(values: Record<string, string>): Promise<TabResponse> {
    const base = (values[CATALOG_FIELD] ?? '').trim() || DEFAULT_CATALOG_ORIGIN;
    try {
      const page = await client.list(base, 'recent', { limit: 10 });
      if (page.rows.length === 0) {
        return { status: 'info', title: 'Empty catalogue', body: `The catalogue at ${base} returned no chart.` };
      }
      const body = [
        `Catalogue at ${base} · view "recent" · ${page.rows.length} of ${page.pagination?.total ?? page.rows.length} charts`,
        '',
        ...page.rows.map((row, index) => `${index + 1}. ${row.id} — ${row.name}\n   ${row.description}`),
        '',
        'Type an identifier in "Chart" and press "Load chart".',
      ].join('\n');
      return {
        status: 'success',
        title: `${page.rows.length} charts`,
        body,
        items: page.rows.map((row) => item(row.name, `${row.id} · ${row.description}`)),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', title: 'Catalogue unavailable', body: `${message}\n\nCheck the catalogue URL and that the server is running.` };
    }
  }

  const PRESETS: Array<[string, ViewerPresetKind]> = [
    ['preset-light', 'default-light'],
    ['preset-dark', 'default-dark'],
    ['preset-lyrics-light', 'only-lyrics-light'],
    ['preset-lyrics-dark', 'only-lyrics-dark'],
  ];

  return {
    ...manifest.contract.ui,
    fields: TAB_FIELDS.map((field) => ({
      id: field.id,
      label: field.label,
      ...(field.type ? { type: field.type } : {}),
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      ...(field.group ? { group: field.group } : {}),
      ...(field.source ? { source: true } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      ...(field.step !== undefined ? { step: field.step } : {}),
      required: Boolean(field.required),
    })) as NonNullable<AddonTab['fields']>,
    actions: TAB_ACTIONS.map((action) => ({
      id: action.id,
      label: action.label,
      ...(action.variant ? { variant: action.variant } : {}),
      ...(action.group ? { group: action.group } : {}),
      ...(action.source ? { source: true } : {}),
      ...(action.receives ? { receives: action.receives } : {}),
      ...(action.live ? { live: true } : {}),
    })) as NonNullable<AddonTab['actions']>,
    // The panel always reads the add-on, which is what knows which controls
    // belong to the chart on screen. The host asks again whenever this add-on
    // changes its state; that is how the panel follows a chart opened by URL.
    subscribe: (listener) => state.subscribe(listener),
    getSnapshot: () => renderCurrent(),

    async run(actionId, values): Promise<TabResponse> {
      await state.ready();
      let settings = state.settings();
      const preset = PRESETS.find(([id]) => id === actionId);

      if (actionId === 'load') return loadChart(values);
      if (actionId === 'list') return listCharts(values);
      if (actionId === 'inspect') return inspectCurrent();

      if (actionId === 'apply') {
        // The panel is the source of truth: read every control back.
        settings = valuesToSettings(values, settings);
      } else if (preset) {
        settings = applyPreset(settings, preset[1]);
      } else if (actionId === 'reset') {
        settings = normalizeSettings(DEFAULT_SETTINGS);
      } else {
        return { status: 'error', body: `Unknown action: ${actionId}` };
      }

      await state.setSettings(settings);
      host.log('info', `Control applied: ${actionId}`, { action: actionId });
      return renderCurrent();
    },
  };
}
