/**
 * Renders one search result as HTML inside the host result page.
 *
 * The host asks the service declared by convention (`host.content-view`) for a
 * view of a content URL, so the dedicated page of a chord chart shows the same
 * rendered chart as the tab, with the controls the person already chose. A URL
 * that is not a chord chart is declined, and the page keeps its own layout.
 */
import { CatalogClient, type ChartRecord } from './catalog-client';
import { simplifyChartText } from './chart-transform';
import { renderChart } from './render-chart';
import type { ViewerSettings } from './settings';

export const CONTENT_VIEW_SERVICE = 'host.content-view';
/** Notation the payload must declare for this add-on to render it. */
export const SUPPORTED_NOTATION = 'chord-over-lyrics';

export interface ContentViewRequest {
  url: string;
  type?: string;
  name?: string;
}

export interface ContentViewResponse {
  html: string;
  title?: string;
}

export interface ChartContentViewOptions {
  /** Reads the controls in use, so the result page matches the tab. */
  settings: () => Promise<ViewerSettings>;
  /**
   * Records the chart read from the URL as the chart in use.
   *
   * The result page opens a chart by URL, and the panel beside it edits the
   * chart it opened. Without this the tab would have no chart to render and
   * every control change would have to read the content URL again.
   */
  adopt?: (chart: ChartRecord) => Promise<void>;
  /** Reads a locally saved revision without changing the published chart. */
  withDraft?: (chart: ChartRecord) => Promise<ChartRecord>;
  client?: CatalogClient;
}

/** One chart already read from its content URL, with the title it published. */
interface CachedChart {
  chart: ChartRecord;
  title?: string;
}

/** Rendered view of one chart, kept while the controls do not change. */
interface CachedRender {
  signature: string;
  html: string;
}

export class ChartContentViewProvider {
  private readonly client: CatalogClient;
  /** Charts are read once per URL: a control change must not reach the network. */
  private readonly charts = new Map<string, CachedChart>();
  private lastRender: CachedRender | undefined;

  constructor(private readonly options: ChartContentViewOptions) {
    this.client = options.client ?? new CatalogClient();
  }

  private async chartFor(url: string): Promise<CachedChart | undefined> {
    const cached = this.charts.get(url);
    if (cached) return cached;

    const chart = await this.client.chartFromUrl(url);
    // Only a payload that declares the chord-chart notation is ours to render.
    if (chart.notationFormat !== SUPPORTED_NOTATION) return undefined;

    const entry: CachedChart = {
      chart,
      ...(chart.title ? { title: `${chart.title}${chart.artist ? ` — ${chart.artist}` : ''}` } : {}),
    };
    this.charts.set(url, entry);
    return entry;
  }

  async render(request: ContentViewRequest): Promise<ContentViewResponse | undefined> {
    const url = String(request?.url ?? '').trim();
    if (!url) return undefined;

    const entry = await this.chartFor(url);
    if (!entry) return undefined;

    // The page may be opening another chart, and the controls kept for a chart
    // are the ones of the chart on screen. The record itself is read once, so
    // this costs nothing while the same chart stays open.
    const chart = await this.options.withDraft?.(entry.chart) ?? entry.chart;
    await this.options.adopt?.(chart);

    const settings = await this.options.settings();
    // The same chart with the same controls renders the same view, so a second
    // call — a re-mount or a response that changed nothing — reuses the first.
    const signature = `${url}|${chart.text}|${chart.key ?? ''}|${JSON.stringify(settings)}`;
    if (this.lastRender?.signature !== signature) {
      const rendered = renderChart({
        text: settings.simplifyChords ? simplifyChartText(chart.text) : chart.text,
        settings,
        ...(chart.key ? { key: chart.key } : {}),
      });
      this.lastRender = { signature, html: rendered.html };
    }

    return {
      html: this.lastRender.html,
      ...(entry.title ? { title: entry.title } : {}),
    };
  }
}
