import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestContentView, type ContentViewProvider, type ContentViewResult } from '../content-view';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonControlPanel } from './AddonControlPanel';
import { RenderedHtmlView } from './RenderedHtmlView';
import { renderedHtml } from '../tab-view';
import { useAddonTab } from './useAddonTab';
import {
  fetchSearchResultContent,
  fetchSearchResultDetails,
  type SearchResultDetails,
  type SearchResultImage,
  type SearchResultLinks,
  type SearchResultRow,
} from '../search';

interface SearchResultPageProps {
  contentUrl: string | null;
  result: SearchResultRow | null;
  /** Add-on that can render this result as HTML, when one is active. */
  viewProvider?: ContentViewProvider;
  /** Add-on behind that view; its controls are shown beside the result. */
  viewAddon?: AddonInstance | null;
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

export function SearchResultPage({ contentUrl, result, viewProvider, viewAddon }: SearchResultPageProps) {
  const [details, setDetails] = useState<SearchResultDetails | null>(null);
  const [fallbackContent, setFallbackContent] = useState<string | null>(null);
  const [renderedView, setRenderedView] = useState<ContentViewResult | null>(null);
  const [loading, setLoading] = useState(Boolean(contentUrl));
  const [error, setError] = useState<string | null>(null);

  const loadView = useCallback(async (url: string): Promise<ContentViewResult | undefined> => requestContentView(viewProvider, {
    url,
    ...(result?.type ? { type: result.type } : {}),
    ...(result?.name ? { name: result.name } : {}),
  }), [result?.name, result?.type, viewProvider]);

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

  useEffect(() => {
    let active = true;
    addonOwnsView.current = false;
    setDetails(null);
    setFallbackContent(null);
    setRenderedView(null);
    setError(null);
    setLoading(Boolean(contentUrl));

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
      const view = await loadView(contentUrl);
      if (!active) return;
      if (view) {
        addonOwnsView.current = true;
        setRenderedView(view);
        setLoading(false);
        return;
      }

      try {
        const nextDetails = await fetchSearchResultDetails(contentUrl);
        if (active) setDetails(nextDetails);
      } catch (reason) {
        try {
          const text = await fetchSearchResultContent(contentUrl);
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
  }, [contentUrl, loadView, viewProvider]);

  const data = details?.body;
  const title = plainTextValue(data?.displaytitle) ?? plainTextValue(data?.title) ?? plainTextValue(data?.id) ?? result?.name ?? 'Article';
  const description = textValue(data?.description) ?? result?.description;
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
      <a href="#/" className="host-article-back">← Back to results</a>

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
        <div className={`host-rendered-result${viewAddon?.ui ? ' has-panel' : ''}`}>
          <article className="host-article-card">
            <header className="host-article-header">
              <span className="host-article-kicker">Rendered view</span>
              <h1>{renderedView.title ?? result?.name ?? title}</h1>
              {result?.description && <p className="host-article-description">{result.description}</p>}
              {contentUrl && (
                <a className="host-article-original-link" href={contentUrl} target="_blank" rel="noreferrer">
                  Open the content URL ↗
                </a>
              )}
            </header>
            <section className="host-article-section">
              <RenderedHtmlView html={renderedView.html} />
            </section>
          </article>

          {viewAddon?.ui && <AddonControlPanel addon={viewAddon} controller={controller} reading />}
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
            <span className="host-article-kicker">Wikipedia article</span>
            <h1>{title}</h1>
            {description && <p className="host-article-description">{description}</p>}
            {originalArticleUrl && (
              <a className="host-article-original-link" href={originalArticleUrl} target="_blank" rel="noreferrer">
                Open original Wikipedia article ↗
              </a>
            )}
          </header>

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
