import { describe, expect, it, vi } from 'vitest';
import { createContractServiceAccess, validateLogEvent, validateManifest, validateTabContract } from '@addons-poc/protocol';
import type { AddonTabResult, HostAPI } from '@addons-poc/protocol';
import { createTab, manifest, setup } from './index';
import { ChordViewerService } from './service';
import { CONTENT_VIEW_SERVICE, ChartContentViewProvider } from './content-view';

/** A tab response may carry the rendered view declared in packages/protocol. */
type ResponseWithView = AddonTabResult & { view?: { kind: 'text' } | { kind: 'html'; html: string } };

/** The served manifest replaces the build path with an HTTP entrypoint. */
const SERVED_MANIFEST = { ...manifest, entrypoint: 'http://localhost:5305/bundle.js' };

const CHART_TEXT = ['[Verse]', 'G        D', 'Rows and rows of lanterns'].join('\n');

function createMemoryStore() {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (key: string) => map.get(key),
    set: async (key: string, value: unknown) => { map.set(key, value); },
    remove: async (key: string) => { map.delete(key); },
    listKeys: async () => [...map.keys()],
    clear: async () => { map.clear(); },
  };
}

interface HostResult {
  host: HostAPI;
  registry: Map<string, unknown>;
  log: ReturnType<typeof vi.fn>;
}

/**
 * Host double that keeps the real contract proxy and the real log validation,
 * so the manifest schemas are exercised by every call of the test.
 */
function createHost(extraServices: Record<string, unknown> = {}): HostResult {
  const registry = new Map<string, unknown>(Object.entries(extraServices));
  const services = createContractServiceAccess({ get: <T>(serviceId: string) => registry.get(serviceId) as T | undefined }, manifest.contract);
  const log = vi.fn();
  const host: HostAPI = {
    services,
    registerService: <T>(serviceId: string, instance: T) => { registry.set(serviceId, instance); },
    onUnload: () => {},
    log: (level, message, details) => {
      const validation = validateLogEvent(manifest.contract, level, message, details);
      if (!validation.valid) throw new Error(validation.errors.join('; '));
      log(level, message, details);
    },
  };
  return { host, registry, log };
}

function createReadyTab(store?: ReturnType<typeof createMemoryStore>) {
  const created = createHost(store ? { 'state-store': store } : {});
  setup(created.host);
  return { ...created, tab: createTab(created.host) };
}

function itemValue(response: AddonTabResult, label: string): string | undefined {
  return response.items?.find((row) => row.label === label)?.value;
}

describe('manifest', () => {
  it('passes the canonical validation once served over HTTP', () => {
    const result = validateManifest(SERVED_MANIFEST);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('declares the rendering service, the content view, and the optional storage', () => {
    const services = manifest.contract.services;
    expect(services.find((service) => service.id === 'addons.chords.viewer')?.role).toBe('provides');
    expect(services.find((service) => service.id === CONTENT_VIEW_SERVICE)?.role).toBe('provides');
    expect(services.find((service) => service.id === 'state-store')?.role).toBe('consumes');
    expect(services.find((service) => service.id === 'state-store')?.required).toBe(false);
  });

  it('declares one outgoing route per catalogue call it makes', () => {
    const outgoing = manifest.contract.http.filter((entry) => entry.direction === 'outgoing');
    expect(outgoing.map((entry) => entry.id)).toEqual(['catalog-list', 'catalog-text', 'catalog-content']);
    expect(outgoing.every((entry) => entry.origin.startsWith('http://'))).toBe(true);
  });

  it('groups every control for the panel', () => {
    const groupOf = (control: unknown) => (control as { group?: string }).group;
    const actionGroups = new Set(manifest.contract.ui.actions.map(groupOf));
    const fieldGroups = new Set(manifest.contract.ui.fields.map(groupOf));

    expect(actionGroups).toEqual(new Set(['Chart', 'Presets', 'Options']));
    expect(fieldGroups).toEqual(new Set([
      'Chart', 'Current chart', 'Reading', 'Chords', 'Lyrics', 'Sections', 'Page', 'Options',
    ]));
    expect([...actionGroups, ...fieldGroups].every((group) => typeof group === 'string' && group.length > 0)).toBe(true);
  });

  it('declares the control kinds the panel renders', () => {
    const field = (id: string) => manifest.contract.ui.fields.find((entry) => entry.id === id) as unknown as {
      type?: string; min?: number; max?: number; step?: number;
    };
    expect(field('fontSize')).toMatchObject({ type: 'range', min: 10, max: 40, step: 1 });
    expect(field('extendedLayout')).toMatchObject({ type: 'toggle' });
    expect(field('chordColor')).toMatchObject({ type: 'color' });
    expect(field('catalog')).toMatchObject({ type: 'url' });
  });

  it('declares one live action that follows the controls', () => {
    const live = manifest.contract.ui.actions.filter((action) => (action as { live?: boolean }).live);
    expect(live.map((action) => action.id)).toEqual(['apply']);
    expect((live[0] as { receives?: string[] }).receives).toContain('fontSize');
    expect((live[0] as { receives?: string[] }).receives).toContain('chordColor');
  });

  it('declares the state keys the add-on writes', () => {
    const entries = manifest.contract.state;
    expect(entries.map((entry) => entry.key)).toEqual(['chords-viewer:settings', 'chords-viewer:chart', undefined]);
    // The controls of one chart live under a key of their own.
    expect(entries.find((entry) => entry.id === 'song')?.keyPattern).toBe('chords-viewer:song:*');
    expect(entries.find((entry) => entry.id === 'song')?.operations).toEqual(['read', 'write', 'remove']);
  });
});

describe('executable tab', () => {
  it('matches the manifest contract', () => {
    const { tab } = createReadyTab();
    const result = validateTabContract(SERVED_MANIFEST as unknown as Record<string, unknown>, tab);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('registers both services during setup', () => {
    const { registry, log } = createReadyTab();
    expect(registry.get('addons.chords.viewer')).toBeInstanceOf(ChordViewerService);
    expect(registry.get(CONTENT_VIEW_SERVICE)).toBeInstanceOf(ChartContentViewProvider);
    expect(log).toHaveBeenCalledWith('info', 'Chord viewer configured successfully', undefined);
  });

  it('exposes the content view through the contract proxy', () => {
    const { host } = createReadyTab();
    const provider = host.services.use<ChartContentViewProvider>({
      id: CONTENT_VIEW_SERVICE,
      version: '^1.0.0',
      methods: [{ id: 'render' }],
    });
    expect(typeof provider?.render).toBe('function');
  });
});

describe('service contract', () => {
  it('accepts the render request through the contract proxy', () => {
    const { host } = createReadyTab();
    const service = host.services.use<ChordViewerService>({ id: 'addons.chords.viewer', version: '^1.0.0', methods: [{ id: 'render' }] });
    const rendered = service!.render({ text: CHART_TEXT, settings: { transposeNumber: 2 }, key: 'G' });

    expect(rendered.playedChords).toEqual(['A', 'E']);
    expect(rendered.shapeKey).toBe('A');
    expect(rendered.html).toContain('data-tab-root');
    expect(rendered.parserVersion).toBe('2.2.2');
  });

  it('rejects a call that breaks the declared input', () => {
    const { host } = createReadyTab();
    const service = host.services.use<ChordViewerService>({ id: 'addons.chords.viewer', version: '^1.0.0', methods: [{ id: 'render' }] });
    expect(() => service!.render({ text: 42 as unknown as string })).toThrow(/addons\.chords\.viewer\.render/u);
  });

  it('exposes the parse method declared in the contract', () => {
    const { host } = createReadyTab();
    const service = host.services.use<ChordViewerService>({ id: 'addons.chords.viewer', methods: [{ id: 'parse' }] });
    const summary = service!.parse({ text: CHART_TEXT });
    expect(summary.chordsFound).toEqual(['G', 'D']);
    expect(summary.sections).toBe(1);
  });
});

describe('tab behaviour without a chart', () => {
  it('explains how to load one', async () => {
    const { tab } = createReadyTab();
    const snapshot = await tab.getSnapshot!() as ResponseWithView;
    expect(snapshot.status).toBe('info');
    expect(snapshot.body).toContain('No chart is loaded yet.');
    expect(snapshot.view).toBeUndefined();
    expect(snapshot.items?.some((row) => row.label === 'Transpose')).toBe(true);
  });

  it('refuses to load an empty form and reports an unknown action', async () => {
    const { tab } = createReadyTab();
    expect((await tab.run!('load', {}) as AddonTabResult).body).toContain('identifier');
    expect((await tab.run!('nope', {}) as AddonTabResult).status).toBe('error');
  });
});

describe('tab behaviour with a chart', () => {
  it('renders the chart as HTML and keeps the text body', async () => {
    const { tab } = createReadyTab();
    const response = await tab.run!('load', { text: CHART_TEXT }) as ResponseWithView;

    expect(response.status).toBe('success');
    expect(response.view?.kind).toBe('html');
    const html = response.view?.kind === 'html' ? response.view.html : '';
    expect(html).toContain('data-tab-root');
    // The component splits the line into spans, one per chord cell.
    expect(html).toContain('Rows and ');
    expect(html).toContain('rows of lanterns');
    expect(html).toContain('tab-styled-section');
    expect(response.body).toContain('Rows and rows of lanterns');
    expect(itemValue(response, 'Played as')).toBe('G · D');
    expect(itemValue(response, 'Parser')).toBe('tab-renderer 2.2.2');
  });

  it('renders again from the values of the panel', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });

    const lyrics = await tab.run!('apply', { showChords: 'false' }) as ResponseWithView;
    expect(lyrics.body).toContain('Rows and rows of lanterns');
    const lyricsHtml = lyrics.view?.kind === 'html' ? lyrics.view.html : '';
    expect(lyricsHtml).toContain('rows of lanterns');
    // Without chords the component prints no chord span at all.
    expect(lyricsHtml).not.toContain('font-weight:bold');

    const transposed = await tab.run!('apply', { transposeNumber: '2' }) as ResponseWithView;
    expect(itemValue(transposed, 'Transpose')).toBe('+2 semitones');
    expect(itemValue(transposed, 'Keys')).toBe('A played');
    expect(transposed.values?.transposeNumber).toBe('2');

    const bigger = await tab.run!('apply', { fontSize: '28' }) as ResponseWithView;
    expect(bigger.view?.kind === 'html' && bigger.view.html.includes('font-size:28px')).toBe(true);

    const original = await tab.run!('apply', { transposeNumber: '0', extendedLayout: 'false' }) as AddonTabResult;
    expect(itemValue(original, 'Transpose')).toBe('original');
    expect(itemValue(original, 'Output')).toContain('original layout');
  });

  it('reports the controls it restored, so the panel can follow them', async () => {
    const store = createMemoryStore();
    const first = createReadyTab(store);
    await first.tab.run!('load', { text: CHART_TEXT });
    await first.tab.run!('apply', { fontSize: '30', chordColor: '#e67428' });

    const second = createReadyTab(store);
    const snapshot = await second.tab.getSnapshot!() as ResponseWithView;
    expect(snapshot.values?.fontSize).toBe('30');
    expect(snapshot.values?.chordColor).toBe('#e67428');
  });

  it('keeps the font size and the transposition with the chart', async () => {
    const store = createMemoryStore();
    const { tab } = createReadyTab(store);

    await tab.run!('load', { text: CHART_TEXT, chart: 'alpha' });
    await tab.run!('apply', { fontSize: '30', transposeNumber: '3', chordColor: '#e67428' });

    // The song record carries the two controls of the chart; the rest is global.
    expect(store.map.get('chords-viewer:song:alpha')).toEqual({ fontSize: 30, transposeNumber: 3 });
    const global = store.map.get('chords-viewer:settings') as Record<string, unknown>;
    expect(global.chordColor).toBe('#e67428');
    expect(global).not.toHaveProperty('fontSize');
    expect(global).not.toHaveProperty('transposeNumber');

    // Another chart opens as written, keeping what is a reading preference.
    const other = await tab.run!('load', { text: CHART_TEXT, chart: 'beta' }) as ResponseWithView;
    expect(other.values?.fontSize).toBe('16');
    expect(other.values?.transposeNumber).toBe('0');
    expect(other.values?.chordColor).toBe('#e67428');

    // Coming back restores what that song had.
    const back = await tab.run!('load', { text: CHART_TEXT, chart: 'alpha' }) as ResponseWithView;
    expect(back.values?.fontSize).toBe('30');
    expect(back.values?.transposeNumber).toBe('3');
  });

  it('opens a chart with no transposition even after transposing another song', async () => {
    const store = createMemoryStore();
    const first = createReadyTab(store);
    await first.tab.run!('load', { text: CHART_TEXT, chart: 'alpha' });
    await first.tab.run!('apply', { transposeNumber: '-4' });

    // A new session, the way a reload starts the add-on again. The chart that
    // was open keeps its own transposition.
    const second = createReadyTab(store);
    const restored = await second.tab.getSnapshot!() as ResponseWithView;
    expect(restored.values?.transposeNumber).toBe('-4');

    // Opening another song starts it as written.
    const other = await second.tab.run!('load', { text: CHART_TEXT, chart: 'beta' }) as ResponseWithView;
    expect(other.values?.transposeNumber).toBe('0');
    expect(itemValue(other, 'Transpose')).toBe('original');
  });

  it('tells the host when the chart or the controls change', async () => {
    const { tab } = createReadyTab();
    let notified = 0;
    const unsubscribe = tab.subscribe!(() => { notified += 1; });

    await tab.run!('load', { text: CHART_TEXT, chart: 'alpha' });
    expect(notified).toBeGreaterThan(0);

    unsubscribe();
    const seen = notified;
    await tab.run!('apply', { fontSize: '20' });
    expect(notified).toBe(seen);
  });

  it('applies the literal presets', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });

    const light = await tab.run!('preset-light', {}) as ResponseWithView;
    expect(itemValue(light, 'Colors')).toBe('chord #e67428 · lyric #000000 · page #ffffff');
    // A preset moves the controls it rewrote.
    expect(light.values?.chordColor).toBe('#e67428');
    expect(light.values?.backgroundColor).toBe('#ffffff');
    expect(light.values?.showChords).toBe('true');

    const lyricsDark = await tab.run!('preset-lyrics-dark', {}) as AddonTabResult;
    expect(itemValue(lyricsDark, 'Output')).toContain('lyrics');
    expect(itemValue(lyricsDark, 'Colors')).toBe('chord #f2952c · lyric #e3e1de · page #000000');
  });

  it('simplifies the chart before rendering', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: '[Verse]\nG7M      Cadd9\nHello    world' });
    const simplified = await tab.run!('apply', { simplifyChords: 'true' }) as AddonTabResult;
    expect(itemValue(simplified, 'Simplify')).toBe('on');
    expect(itemValue(simplified, 'Played as')).toBe('G · C');
  });

  it('hides the summary on demand', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });
    const hidden = await tab.run!('apply', { summaryOpen: 'false' }) as AddonTabResult;
    expect(hidden.body.startsWith('[Verse]')).toBe(true);
  });

  it('prints the parsed model on demand, without a rendered view', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });
    const response = await tab.run!('inspect', {}) as ResponseWithView;
    expect(response.status).toBe('info');
    expect(response.body).toContain('"chordsFound"');
    expect(response.body).toContain('"parserVersion": "2.2.2"');
    expect(response.view).toBeUndefined();
    expect(itemValue(response, 'Chords found')).toBe('G · D');
  });

  it('restores every control with one action', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });
    await tab.run!('apply', { transposeNumber: '3' });
    await tab.run!('preset-light', {});
    const restored = await tab.run!('reset', {}) as ResponseWithView;
    expect(itemValue(restored, 'Transpose')).toBe('original');
    expect(itemValue(restored, 'Colors')).toBe('chord #5884fe · lyric #d1dff5 · page #292623');
    expect(restored.values?.transposeNumber).toBe('0');
    expect(restored.values?.chordColor).toBe('#5884fe');
  });
});

describe('storage', () => {
  it('keeps the controls and the chart for the next tab', async () => {
    const store = createMemoryStore();
    const first = createReadyTab(store);
    await first.tab.run!('load', { text: CHART_TEXT });
    await first.tab.run!('apply', { transposeNumber: '2' });

    expect(store.map.has('chords-viewer:settings')).toBe(true);
    expect(store.map.has('chords-viewer:chart')).toBe(true);

    const second = createReadyTab(store);
    const snapshot = await second.tab.getSnapshot!() as ResponseWithView;
    expect(snapshot.status).toBe('success');
    expect(itemValue(snapshot, 'Transpose')).toBe('+2 semitones');
    expect(itemValue(snapshot, 'Storage')).toBe('state-store active');
    expect(snapshot.view?.kind).toBe('html');
  });

  it('works in memory when no storage provider is active', async () => {
    const { tab } = createReadyTab();
    await tab.run!('load', { text: CHART_TEXT });
    const snapshot = await tab.getSnapshot!() as AddonTabResult;
    expect(itemValue(snapshot, 'Storage')).toBe('memory only');
  });
});
