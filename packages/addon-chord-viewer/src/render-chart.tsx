/**
 * Renders a chart with the ported tab renderer.
 *
 * The React component does the work: it parses the text, applies the
 * transposition, prepares the song, and builds the nodes. `renderToStaticMarkup`
 * turns those nodes into the HTML the host inserts, so the add-on keeps a
 * declarative response and the host keeps knowing nothing about chords.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Tab } from './tab-renderer/react';
import { parseTab, summarizeParsedTab, transposeChordSymbol } from './tab-renderer/core';
import { inferKey } from './chart-transform';
import { normalizeSettings, type ViewerSettings } from './settings';

export interface RenderRequest {
  text: string;
  settings?: Partial<ViewerSettings>;
  /** Key declared by the catalogue, when the chart has metadata. */
  key?: string;
}

export interface RenderedChart {
  html: string;
  /** Chords exactly as the person will play them. */
  playedChords: string[];
  sections: number;
  lines: number;
  chordTokens: number;
  diagnostics: number;
  key?: string;
  keyInferred: boolean;
  /** Key the person plays after the transposition. */
  shapeKey?: string;
  parserVersion: string;
}

/** Parses and renders one chart, returning the HTML and its summary. */
export function renderChart(request: RenderRequest): RenderedChart {
  const text = String(request?.text ?? '');
  const settings = normalizeSettings(request?.settings ?? {});
  const summary = summarizeParsedTab(parseTab(text));

  const declaredKey = request?.key ?? inferKey(summary.chordsFound);
  const shapeKey = declaredKey ? transposeChordSymbol(declaredKey, settings.transposeNumber) : undefined;

  const html = renderToStaticMarkup(<Tab body={text} style={settings} />);
  const playedChords = summary.chordsFound.map((symbol) => transposeChordSymbol(symbol, settings.transposeNumber));

  return {
    html,
    playedChords,
    sections: summary.sections,
    lines: summary.lines,
    chordTokens: summary.chordTokens,
    diagnostics: summary.diagnostics,
    ...(declaredKey ? { key: declaredKey } : {}),
    keyInferred: request?.key === undefined && declaredKey !== undefined,
    ...(shapeKey ? { shapeKey } : {}),
    parserVersion: summary.parserVersion,
  };
}

/** Summary of the parsed chart, used by the "Data format" action. */
export function inspectChart(text: string): unknown {
  return summarizeParsedTab(parseTab(String(text ?? '')));
}