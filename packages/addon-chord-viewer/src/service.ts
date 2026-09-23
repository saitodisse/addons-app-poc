/**
 * The rendering service registered by this add-on.
 *
 * The tab consumes it through `host.services.use`, so the same code path is
 * validated by the contract proxy. Another add-on can consume the same
 * identifier without importing this package.
 */
import { renderChart, type RenderRequest, type RenderedChart } from './render-chart';
import { parseTab, summarizeParsedTab, type ParsedTabSummary } from './tab-renderer/core';

export interface ParseRequest {
  text: string;
}

export type ParseResponse = ParsedTabSummary;

export type RenderResponse = RenderedChart;

export class ChordViewerService {
  /** Parses chart text and reports its sections, tokens, and chords. */
  parse(request: ParseRequest): ParseResponse {
    return summarizeParsedTab(parseTab(String(request?.text ?? '')));
  }

  /** Parses and renders chart text with the requested settings. */
  render(request: RenderRequest): RenderResponse {
    return renderChart(request);
  }
}