// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentEditorProvider } from '../content-editor';
import type { ContentViewProvider } from '../content-view';
import type { SearchResultRow } from '../search';
import { SearchResultPage } from './SearchResultPage';

const chartUrl = 'http://localhost:5295/text/chart/static-and-rain/content.txt';
const chart: SearchResultRow = {
  key: 'chart:static-and-rain',
  sourceAddonId: 'chord-catalog',
  sourceAddonName: 'Chord Chart Catalogue',
  sourceManifestUrl: 'http://localhost:5295/manifest.json',
  type: 'chart',
  id: 'static-and-rain',
  url: chartUrl,
  name: 'Static and Rain',
  description: 'Vela Nova',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('SearchResultPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalScrollIntoView: HTMLElement['scrollIntoView'] | undefined;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    vi.unstubAllGlobals();
  });

  it('shows the final rendered chart and Edit together, even when the chart finishes first', async () => {
    const view = deferred<{ html: string; title: string }>();
    const editorSupport = deferred<boolean>();
    const viewProvider: ContentViewProvider = { render: () => view.promise };
    const editorProvider: ContentEditorProvider = {
      supports: () => editorSupport.promise,
      render: () => undefined,
    };

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading');

    await act(async () => { view.resolve({ html: '<pre>Am F C G</pre>', title: 'Static and Rain' }); });
    expect(container.querySelector('.host-article-card')).toBeNull();
    expect(container.querySelector('.host-article-edit-button')).toBeNull();

    await act(async () => { editorSupport.resolve(true); });
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('Am F C G');
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('waits for installed add-ons and saved results before resolving a direct article URL', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetch);

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={null} ready={false} />);
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(container.querySelector('.host-article-card')).toBeNull();

    const viewProvider: ContentViewProvider = { render: () => ({ html: '<pre>Am F C G</pre>' }) };
    const editorProvider: ContentEditorProvider = { supports: () => true, render: () => undefined };
    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('Am F C G');
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
  });

  it('keeps the completed chart open when matching search metadata arrives later', async () => {
    const delayedSecondRender = deferred<{ html: string; title: string }>();
    const render = vi.fn()
      .mockResolvedValueOnce({ html: '<pre>Am F C G</pre>', title: 'Static and Rain' })
      .mockImplementationOnce(() => delayedSecondRender.promise);
    const viewProvider: ContentViewProvider = { render };
    const editorProvider: ContentEditorProvider = { supports: () => true, render: () => undefined };

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={null} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(render).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('Am F C G');
  });

  it('scrolls to the rendered header only after the final view includes Edit', async () => {
    const view = deferred<{ html: string; title: string }>();
    const editorSupport = deferred<boolean>();
    const viewProvider: ContentViewProvider = { render: () => view.promise };
    const editorProvider: ContentEditorProvider = {
      supports: () => editorSupport.promise,
      render: () => undefined,
    };

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    await act(async () => { view.resolve({ html: '<pre>Am F C G</pre>', title: 'Static and Rain' }); });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector('.host-article-header')).toBeNull();

    await act(async () => { editorSupport.resolve(true); });
    const header = container.querySelector('.host-article-header');
    expect(header?.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect((header as HTMLElement).style.scrollMarginTop).toBe('16px');
    expect(scrollIntoView.mock.contexts[0]).toBe(header);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('keeps showing the loading state when editor support finishes before rendering', async () => {
    const view = deferred<{ html: string; title: string }>();
    const editorSupport = deferred<boolean>();
    const viewProvider: ContentViewProvider = { render: () => view.promise };
    const editorProvider: ContentEditorProvider = {
      supports: () => editorSupport.promise,
      render: () => undefined,
    };

    await act(async () => {
      root.render(<SearchResultPage contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    await act(async () => { editorSupport.resolve(true); });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(container.querySelector('.host-article-header')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await act(async () => { view.resolve({ html: '<pre>Am F C G</pre>', title: 'Static and Rain' }); });
    const header = container.querySelector('.host-article-header');
    expect(header?.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(scrollIntoView.mock.contexts[0]).toBe(header);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('ignores a late response from a previous article route', async () => {
    const nextUrl = 'http://localhost:5295/text/chart/harbor-light/content.txt';
    const oldView = deferred<{ html: string; title: string }>();
    const oldSupport = deferred<boolean>();
    const nextView = deferred<{ html: string; title: string }>();
    const nextSupport = deferred<boolean>();
    const viewProvider: ContentViewProvider = {
      render: ({ url }) => url === chartUrl ? oldView.promise : nextView.promise,
    };
    const editorProvider: ContentEditorProvider = {
      supports: ({ url }) => url === chartUrl ? oldSupport.promise : nextSupport.promise,
      render: () => undefined,
    };

    await act(async () => {
      root.render(<SearchResultPage key={chartUrl} contentUrl={chartUrl} result={chart} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    await act(async () => {
      root.render(<SearchResultPage key={nextUrl} contentUrl={nextUrl} result={{ ...chart, url: nextUrl, id: 'harbor-light', name: 'Harbor Light' }} ready viewProvider={viewProvider} editorProvider={editorProvider} />);
    });
    await act(async () => {
      nextView.resolve({ html: '<pre>G D</pre>', title: 'Harbor Light' });
      nextSupport.resolve(true);
    });
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('G D');

    await act(async () => {
      oldView.resolve({ html: '<pre>old route</pre>', title: 'Old route' });
      oldSupport.resolve(true);
    });
    expect(container.querySelector('.host-article-card h1')?.textContent).toBe('Harbor Light');
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('G D');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
