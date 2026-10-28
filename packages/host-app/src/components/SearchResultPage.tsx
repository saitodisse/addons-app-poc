import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { requestContentView, type ContentViewProvider, type ContentViewResult } from '../content-view';
import { requestContentEditor, supportsContentEditor, type ContentEditorProvider } from '../content-editor';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonControlPanel } from './AddonControlPanel';
import { RenderedHtmlView } from './RenderedHtmlView';
import { renderedHtml } from '../tab-view';
import { useAddonTab } from './useAddonTab';
import { navigate, resultRoute, ROUTES } from '../router';
import {
  fetchSearchResultContent,
  fetchSearchResultDetails,
  type SearchResultDetails,
  type SearchResultImage,
  type SearchResultLinks,
  type SearchResultRow,
} from '../search';

interface SearchResultPageProps {
  fetchResource?: typeof fetch;
  contentUrl: string | null;
  result: SearchResultRow | null;
  /** Whether installed add-ons and saved search results have finished restoring. */
  ready: boolean;
  /** Add-on that can render this result as HTML, when one is active. */
  viewProvider?: ContentViewProvider;
  /** Add-on behind that view; its controls are shown beside the result. */
  viewAddon?: AddonInstance | null;
  /** Optional provider of an editing view for this result. */
  editorProvider?: ContentEditorProvider;
  onBackToResults?: () => void;
  previousResultUrl?: string | null;
  nextResultUrl?: string | null;
}

const ALLOWED_EXTRACT_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'SUB', 'SUP', 'SPAN']);

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function plainTextValue(value: unknown): string | undefined {
  const candidate = textValue(value);
  if (!candidate) return undefined;
  if (typeof DOMParser === 'undefined') return candidate.replace(/<[^>]*>/g, '').trim();
  const document = new DOMParser().parseFromString(candidate, 'text/html');
  return document.body.textContent?.trim() || candidate;
}

function httpUrl(value: unknown): string | undefined {
  const candidate = textValue(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function imageUrl(image: SearchResultImage | undefined): string | undefined {
  return httpUrl(image?.source);
}

function sanitizeExtractHtml(value: string): string {
  if (typeof DOMParser === 'undefined') return '';

  const document = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  const root = document.body.firstElementChild;
  if (!root) return '';

  const sanitize = (parent: Node) => {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        parent.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      if (!ALLOWED_EXTRACT_TAGS.has(element.tagName)) {
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        parent.removeChild(element);
        continue;
      }

      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      sanitize(element);
    }
  };

  sanitize(root);
  return root.innerHTML;
}

function LoadingState({ title }: { title: string }) {
  return (
    <div className="host-article-state" role="status">
      <span className="host-article-kicker">Dedicated page</span>
      <h1>{title}</h1>
      <p>Loading structured content and article metadata…</p>
    </div>
  );
}

export function SearchResultPage({ contentUrl, result, ready, viewProvider, viewAddon, editorProvider, onBackToResults, previousResultUrl, nextResultUrl, fetchResource = fetch }: SearchResultPageProps) {
  const [details, setDetails] = useState<SearchResultDetails | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [fallbackContent, setFallbackContent] = useState<string | null>(null);
  const [renderedView, setRenderedView] = useState<ContentViewResult | null>(null);
  const [loading, setLoading] = useState(Boolean(contentUrl));
  const [error, setError] = useState<string | null>(null);
  const [editorAvailable, setEditorAvailable] = useState(false);
  const [editorView, setEditorView] = useState<ContentViewResult | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const editorRequestNumber = useRef(0);
  const renderedHeaderRef = useRef<HTMLElement>(null);
  const scrolledContentUrlRef = useRef<string | null>(null);
  const resultRef = useRef(result);
  resultRef.current = result;

  const editorRequest = useCallback((url: string) => {
    const currentResult = resultRef.current;
    return {
      url,
      ...(currentResult?.type ? { type: currentResult.type } : {}),
      ...(currentResult?.name ? { name: currentResult.name } : {}),
    };
  }, []);

  const loadView = useCallback(async (url: string): Promise<ContentViewResult | undefined> => requestContentView(viewProvider, {
    url,
    ...(resultRef.current?.type ? { type: resultRef.current.type } : {}),
    ...(resultRef.current?.name ? { name: resultRef.current.name } : {}),
  }), [viewProvider]);

  /** True while the view on the page was published by this add-on for this URL. */
  const addonOwnsView = useRef(false);

  // The controls of the add-on behind the view; every change renders it again.
  //
  // The action already renders the content with the controls in use, so the page
  // paints the view that came with the response. Asking the provider again would
  // read the content URL over the network and render the same content a second
  // time on every step of a dragged slider.
  //
  // The add-on only owns this page after its provider accepted the URL. A
  // response that arrives meanwhile — the add-on restoring its own controls, for
  // instance — must not replace an article with content the person never opened.
  const controller = useAddonTab(viewAddon ?? null, {
    onResponse: (response) => {
      if (!addonOwnsView.current) return;
      const html = renderedHtml(response);
      if (!html) return;
      setRenderedView((current) => ({ html, ...(current?.title ? { title: current.title } : {}) }));
    },
  });
  const viewerFields = new Map((viewAddon?.ui?.fields ?? []).map((field) => [field.id, field]));
  const liveFieldIds = new Set(controller.sections.flatMap((section) => section.actions.flatMap((action) => action.live ? action.receives ?? [] : [])));
  const fontField = viewerFields.get('fontSize');
  const transposeField = viewerFields.get('transposeNumber');
  const canAdjustFontSize = Boolean(fontField?.type === 'range' && liveFieldIds.has('fontSize'));
  const canTranspose = Boolean(transposeField?.type === 'range' && liveFieldIds.has('transposeNumber'));
  const hasPrimaryControls = canAdjustFontSize || canTranspose;
  const compactControls = hasPrimaryControls && !controlsExpanded;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (onBackToResults) onBackToResults();
        else navigate(ROUTES.home);
        return;
      }
      if (editing) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
        const destination = event.key === 'ArrowLeft' ? previousResultUrl : nextResultUrl;
        if (!destination) return;
        event.preventDefault();
        navigate(resultRoute(destination));
        return;
      }
      if (!renderedView) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;

      if ((event.key === '-' || event.key === '=' || event.key === '+') && canAdjustFontSize && fontField) {
        const min = fontField.type === 'range' ? fontField.min ?? 10 : 10;
        const max = fontField.type === 'range' ? fontField.max ?? 40 : 40;
        const current = Number.parseFloat(controller.values.fontSize ?? '');
        const size = Number.isFinite(current) ? current : 16;
        const next = Math.min(max, Math.max(min, size + (event.key === '-' ? -1 : 1)));
        if (next === size) return;
        event.preventDefault();
        controller.setValue('fontSize', String(next));
        return;
      }

      if ((event.key === '[' || event.key === ']') && canTranspose && transposeField) {
        const currentValue = Number.parseInt(controller.values.transposeNumber ?? '0', 10);
        const current = Number.isFinite(currentValue) ? currentValue : 0;
        const direction = event.key === ']' ? 1 : -1;
        const next = ((current + direction + 6) % 12 + 12) % 12 - 6;
        event.preventDefault();
        controller.setValue('transposeNumber', String(next));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canAdjustFontSize, canTranspose, controller, editing, fontField, nextResultUrl, onBackToResults, previousResultUrl, renderedView, transposeField]);

  useEffect(() => {
    let active = true;
    editorRequestNumber.current += 1;
    addonOwnsView.current = false;
    scrolledContentUrlRef.current = null;
    setDetails(null);
    setFallbackContent(null);
    setRenderedView(null);
    setError(null);
    setLoading(Boolean(contentUrl));
    setEditorAvailable(false);
    setEditorView(null);
    setEditorError(null);
    setEditing(false);
    setControlsExpanded(false);

    if (!ready) return () => { active = false; };

    if (!contentUrl) {
      setLoading(false);
      setError('The article route does not contain a valid HTTP URL.');
      return () => {
        active = false;
      };
    }

    // An add-on that understands this result renders it; otherwise the page
    // keeps its own layout for the structured article payload.
    void (async () => {
      const [view, canEdit] = await Promise.all([
        loadView(contentUrl),
        supportsContentEditor(editorProvider, editorRequest(contentUrl)),
      ]);
      if (!active) return;
      if (view) {
        addonOwnsView.current = true;
        setRenderedView(view);
        setEditorAvailable(canEdit);
        setLoading(false);
        void fetchSearchResultDetails(contentUrl, fetchResource)
          .then((nextDetails) => { if (active) setDetails(nextDetails); })
          .catch(() => { /* Optional metadata must not interrupt the rendered view. */ });
        void fetchSearchResultContent(contentUrl, fetchResource)
          .then((text) => { if (active) setOriginalText(text); })
          .catch(() => { if (active) setOriginalText(null); });
        return;
      }

      try {
        const nextDetails = await fetchSearchResultDetails(contentUrl, fetchResource);
        if (active) setDetails(nextDetails);
      } catch (reason) {
        try {
          const text = await fetchSearchResultContent(contentUrl, fetchResource);
          if (active) setFallbackContent(text);
        } catch {
          if (active) setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [contentUrl, editorProvider, editorRequest, fetchResource, loadView, ready]);

  async function copyOriginalText(): Promise<void> {
    if (originalText === null || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(originalText);
      setCopyStatus('Cifra original copiada.');
    } catch {
      setCopyStatus('Não foi possível copiar a cifra.');
    }
  }

  async function openEditor(): Promise<void> {
    if (!contentUrl || !editorProvider) return;
    const requestNumber = ++editorRequestNumber.current;
    setEditorError(null);
    setEditorLoading(true);
    setEditing(true);
    try {
      const view = await requestContentEditor(editorProvider, editorRequest(contentUrl));
      if (requestNumber !== editorRequestNumber.current) return;
      if (!view) throw new Error('This add-on could not open an editor for this result.');
      setEditorView(view);
    } catch (reason) {
      if (requestNumber === editorRequestNumber.current) setEditorError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (requestNumber === editorRequestNumber.current) setEditorLoading(false);
    }
  }

  async function closeEditor(): Promise<void> {
    const requestNumber = ++editorRequestNumber.current;
    setEditing(false);
    setEditorView(null);
    if (contentUrl) {
      const updated = await loadView(contentUrl);
      if (requestNumber === editorRequestNumber.current && updated) setRenderedView(updated);
    }
  }

  const data = details?.body;
  const title = plainTextValue(data?.displaytitle) ?? plainTextValue(data?.title) ?? plainTextValue(data?.id) ?? result?.name ?? 'Article';
  const description = textValue(data?.description) ?? result?.description;
  const externalLinks = (Array.isArray(data?.externalLinks) ? data.externalLinks : []).flatMap((link: unknown) => {
    if (!link || typeof link !== 'object') return [];
    const item = link as Record<string, unknown>;
    const label = plainTextValue(item.label);
    const url = httpUrl(item.url);
    return label && url ? [{ label, url }] : [];
  });
  const contentText = textValue(data?.content?.text);
  const extract = textValue(data?.extract);
  const extractHtml = textValue(data?.extract_html);
  const sanitizedExtractHtml = useMemo(() => extractHtml ? sanitizeExtractHtml(extractHtml) : '', [extractHtml]);
  const originalImage = imageUrl(data?.originalimage);
  const thumbnail = imageUrl(data?.thumbnail);
  const heroImage = originalImage ?? thumbnail;
  const heroImageLabel = originalImage ? 'Original image' : 'Thumbnail';
  const desktopLinks: SearchResultLinks | undefined = data?.content_urls?.desktop;
  const mobileLinks: SearchResultLinks | undefined = data?.content_urls?.mobile;
  const originalArticleUrl = httpUrl(desktopLinks?.page) ?? httpUrl(mobileLinks?.page);
  const language = textValue(data?.lang);
  const direction = data?.dir === 'rtl' ? 'rtl' : 'ltr';
  const hasFallbackContent = !loading && !error && !data && fallbackContent !== null;

  useLayoutEffect(() => {
    if (!ready || loading || !contentUrl || !renderedView || scrolledContentUrlRef.current === contentUrl) return;
    const header = renderedHeaderRef.current;
    if (!header) return;
    const stickyHeaderHeight = document.querySelector('.host-site-header')?.getBoundingClientRect().height ?? 0;
    const compactPanel = compactControls ? header.closest('.host-rendered-result')?.querySelector('.host-tab-panel') : null;
    const controlsHeight = compactPanel ? compactPanel.getBoundingClientRect().height + 12 : 0;
    header.style.scrollMarginTop = `${Math.ceil(stickyHeaderHeight + controlsHeight + 16)}px`;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    header.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    scrolledContentUrlRef.current = contentUrl;
  }, [compactControls, contentUrl, editorAvailable, loading, ready, renderedView]);

  useEffect(() => {
    if (!details) return;
    const previousTitle = document.title;
    document.title = `${title} · Add-ons POC`;
    return () => {
      document.title = previousTitle;
    };
  }, [details, title]);

  return (
    <section
      className={`host-article-page${renderedView ? ' is-rendered-view' : ''}`}
      aria-label={`${renderedView ? 'Result' : 'Article'} ${title}`}
      aria-busy={loading}
      lang={language}
      dir={direction}
    >
      <a
        href="#/"
        className="host-article-back"
        onClick={(event) => {
          if (!onBackToResults) return;
          event.preventDefault();
          onBackToResults();
        }}
      >← Back to results</a>

      {loading && <LoadingState title={result?.name ?? title} />}

      {!loading && error && (
        <div className="host-article-state" role="alert">
          <span className="host-article-kicker">Could not open the article</span>
          <h1>{result?.name ?? 'Search result'}</h1>
          <p>{error}</p>
          {contentUrl && <code className="host-article-request-url">Structured URL: {contentUrl.replace(/\/content\.txt(?=$|[?#])/, '/content.json')}</code>}
        </div>
      )}

      {!loading && !error && renderedView && (
        <div className={`host-rendered-result${!editing && viewAddon?.ui ? compactControls ? ' is-controls-collapsed' : ' has-panel' : ''}`}>
          <article className="host-article-card">
            <header ref={renderedHeaderRef} className="host-article-header">
              <span className="host-article-kicker">{editing ? 'Editing' : 'Rendered view'}</span>
              <h1>{(editing ? editorView?.title : renderedView.title) ?? result?.name ?? title}</h1>
              {result?.description && <p className="host-article-description">{result.description}</p>}
              {!editing && renderedView && (canAdjustFontSize || canTranspose) && (
                <p className="host-article-keyboard-hint" aria-keyshortcuts="- = [ ] Escape">
                  {canAdjustFontSize && <span>- / = font size</span>}
                  {canAdjustFontSize && canTranspose && <span aria-hidden="true"> · </span>}
                  {canTranspose && <span>[ / ] transpose</span>}
                  <span aria-hidden="true"> · Esc returns to results</span>
                </p>
              )}
              {editorAvailable && (
                <button type="button" className="host-article-edit-button" onClick={() => void (editing ? closeEditor() : openEditor())}>
                  {editing ? '← Back to reading' : 'Edit'}
                </button>
              )}
              <div className="host-article-links">
                <button
                  type="button"
                  className="host-article-original-link"
                  disabled={originalText === null}
                  onClick={() => void copyOriginalText()}
                >
                  {originalText === null ? 'Carregando cifra original…' : 'Copiar cifra original'}
                </button>
                {copyStatus && <span role="status">{copyStatus}</span>}
                {contentUrl && (
                  <a className="host-article-original-link" href={contentUrl} target="_blank" rel="noreferrer">
                    Open the content URL ↗
                  </a>
                )}
                {externalLinks.map((link) => (
                  <a key={link.url} className="host-article-original-link" href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </header>
            <section className="host-article-section">
              {editing
                ? editorView ? <RenderedHtmlView html={editorView.html} /> : <p role="status">{editorLoading ? 'Opening editor…' : 'Editor unavailable.'}</p>
                : <RenderedHtmlView html={renderedView.html} />}
              {editorError && <p role="alert">{editorError}</p>}
            </section>
          </article>

          {!editing && viewAddon?.ui && <AddonControlPanel
            addon={viewAddon}
            controller={controller}
            reading
            compact={compactControls}
            primaryFieldIds={['fontSize', 'transposeNumber']}
            onToggleExpanded={hasPrimaryControls ? () => setControlsExpanded((expanded) => !expanded) : undefined}
          />}
        </div>
      )}

      {!loading && !error && !renderedView && data && (
        <article className="host-article-card">
          {heroImage && (
            <figure className="host-article-hero-image">
              <img src={heroImage} alt={title} />
              <figcaption>{heroImageLabel}{data.originalimage?.width && data.originalimage?.height ? ` · ${data.originalimage.width} × ${data.originalimage.height}px` : ''}</figcaption>
            </figure>
          )}

          <header className="host-article-header">
            <span className="host-article-kicker">{textValue(data.source?.name) ?? 'Content'}</span>
            <h1>{title}</h1>
            {description && <p className="host-article-description">{description}</p>}
            {originalArticleUrl && (
              <a className="host-article-original-link" href={originalArticleUrl} target="_blank" rel="noreferrer">
                Open original article ↗
              </a>
            )}
          </header>

          {contentText && (
            <section className="host-article-section" aria-label="Content">
              <pre className="host-article-fallback-content">{contentText}</pre>
            </section>
          )}

          {(sanitizedExtractHtml || extract) && (
            <section className="host-article-section" aria-labelledby="host-article-summary-title">
              <h2 id="host-article-summary-title">Summary</h2>
              {sanitizedExtractHtml
                ? <div className="host-article-extract" dangerouslySetInnerHTML={{ __html: sanitizedExtractHtml }} />
                : <p className="host-article-extract">{extract}</p>}
            </section>
          )}
        </article>
      )}

      {!renderedView && hasFallbackContent && (
        <article className="host-article-card">
          <header className="host-article-header">
            <span className="host-article-kicker">Compatible content</span>
            <h1>{result?.name ?? title}</h1>
            {description && <p className="host-article-description">{description}</p>}
            <a className="host-article-original-link" href={contentUrl ?? '#'} target="_blank" rel="noreferrer">
              Open add-on content ↗
            </a>
          </header>
          <section className="host-article-section" aria-labelledby="host-article-fallback-title">
            <h2 id="host-article-fallback-title">Content</h2>
            <pre className="host-article-fallback-content">{fallbackContent}</pre>
          </section>
        </article>
      )}
    </section>
  );
}
