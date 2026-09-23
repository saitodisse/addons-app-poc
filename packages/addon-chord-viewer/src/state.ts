/**
 * State of the viewer add-on.
 *
 * The controls and the loaded chart are owned by this add-on, so they are stored
 * through the optional `state-store` service instead of the tab's own
 * persistence bridge. Without a provider everything still works and is lost on
 * reload, which is the documented behaviour of an optional dependency.
 *
 * Two records keep the controls: one shared by every chart (`settings`) and one
 * per chart (`song:<id>`), because the font size and the transposition belong to
 * the song a person is reading. See `SONG_FIELDS` in `settings.ts`.
 */
import type { AddonStateStore, HostAPI } from '@addons-poc/protocol';
import type { ChartRecord } from './catalog-client';
import {
  DEFAULT_SETTINGS,
  globalPart,
  normalizeSettings,
  normalizeSongSettings,
  songPart,
  withSongSettings,
  type ViewerSettings,
} from './settings';

export const SETTINGS_KEY = 'chords-viewer:settings';
export const CHART_KEY = 'chords-viewer:chart';
/** Prefix of the record that keeps the controls of one chart. */
export const SONG_KEY_PREFIX = 'chords-viewer:song:';

/** Physical key of the controls kept for one chart. */
export function songKey(chartId: string): string {
  return `${SONG_KEY_PREFIX}${chartId}`;
}

export interface ViewerState {
  /** Settings in use: the global preferences with the current chart's own. */
  settings(): ViewerSettings;
  setSettings(next: ViewerSettings): Promise<void>;
  /** Controls kept for the current chart alone. */
  songSettings(): Partial<ViewerSettings>;
  chart(): ChartRecord | undefined;
  setChart(next: ChartRecord | undefined): Promise<void>;
  ready(): Promise<void>;
  usesStorage(): boolean;
  /** Notifies when the settings or the loaded chart change. */
  subscribe(listener: () => void): () => void;
}

export function createViewerState(host: HostAPI): ViewerState {
  let global: ViewerSettings = DEFAULT_SETTINGS;
  let song: Partial<ViewerSettings> = {};
  let chart: ChartRecord | undefined;
  let loaded: Promise<void> | undefined;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const store = (): AddonStateStore | undefined => host.services.use<AddonStateStore>({
    id: 'state-store',
    version: '^1.0.0',
    methods: [{ id: 'get' }, { id: 'set' }],
  });

  /** Record of one chart, read from storage the first time it is asked for. */
  async function readSong(chartId: string | undefined): Promise<Partial<ViewerSettings>> {
    const service = store();
    if (!service || !chartId) return {};
    try {
      return normalizeSongSettings(await service.get<Partial<ViewerSettings>>(songKey(chartId)));
    } catch {
      return {};
    }
  }

  async function load(): Promise<void> {
    const service = store();
    if (!service) return;
    try {
      global = normalizeSettings(await service.get<ViewerSettings>(SETTINGS_KEY));
    } catch {
      global = DEFAULT_SETTINGS;
    }
    try {
      const stored = await service.get<ChartRecord>(CHART_KEY);
      if (stored && typeof stored === 'object' && typeof stored.text === 'string') chart = stored;
    } catch {
      chart = undefined;
    }
    song = await readSong(chart?.id);
  }

  return {
    ready() {
      loaded = loaded ?? load();
      return loaded;
    },
    settings: () => withSongSettings(global, song),
    songSettings: () => song,
    usesStorage: () => Boolean(store()),
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    chart: () => chart,
    async setSettings(next) {
      const settings = normalizeSettings(next);
      // One record for the chart and one for everything else: the font size and
      // the transposition of one song cannot follow into the next chart.
      global = normalizeSettings(globalPart(settings));
      song = songPart(settings);
      const service = store();
      if (!service) {
        notify();
        return;
      }
      // Only the shared part is written here; the song part has its own record.
      await service.set(SETTINGS_KEY, globalPart(global));
      if (chart) await service.set(songKey(chart.id), song);
      notify();
    },
    async setChart(next) {
      const changed = next?.id !== chart?.id;
      chart = next;
      // A chart nobody has adjusted opens as written: the transposition starts
      // from zero instead of borrowing the previous song.
      if (changed) song = await readSong(next?.id);
      // The declared state value is an object, so an empty object means "nothing loaded".
      await store()?.set(CHART_KEY, next ?? {});
      if (changed) notify();
    },
  };
}