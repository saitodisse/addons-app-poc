import { useEffect, useMemo, useState } from 'react';
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
      <span className="host-article-kicker">Página dedicada</span>
      <h1>{title}</h1>
      <p>Carregando o conteúdo estruturado e os metadados do artigo…</p>
    </div>
  );
}

export function SearchResultPage({ contentUrl, result }: SearchResultPageProps) {
  const [details, setDetails] = useState<SearchResultDetails | null>(null);
  const [fallbackContent, setFallbackContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(contentUrl));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setFallbackContent(null);
    setError(null);
    setLoading(Boolean(contentUrl));

    if (!contentUrl) {
      setLoading(false);
      setError('A rota do artigo não contém uma URL HTTP válida.');
      return () => {
        active = false;
      };
    }

    void fetchSearchResultDetails(contentUrl)
      .then((nextDetails) => {
        if (active) setDetails(nextDetails);
      })
      .catch(async (reason) => {
        try {
          const text = await fetchSearchResultContent(contentUrl);
          if (active) setFallbackContent(text);
        } catch {
          if (active) setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contentUrl]);

  const data = details?.body;
  const title = plainTextValue(data?.displaytitle) ?? plainTextValue(data?.title) ?? plainTextValue(data?.id) ?? result?.name ?? 'Artigo';
  const description = textValue(data?.description) ?? result?.description;
  const extract = textValue(data?.extract);
  const extractHtml = textValue(data?.extract_html);
  const sanitizedExtractHtml = useMemo(() => extractHtml ? sanitizeExtractHtml(extractHtml) : '', [extractHtml]);
  const originalImage = imageUrl(data?.originalimage);
  const thumbnail = imageUrl(data?.thumbnail);
  const heroImage = originalImage ?? thumbnail;
  const heroImageLabel = originalImage ? 'Imagem original' : 'Miniatura';
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
    <section className="host-article-page" aria-label={`Artigo ${title}`} aria-busy={loading} lang={language} dir={direction}>
      <a href="#/" className="host-article-back">← Voltar para os resultados</a>

      {loading && <LoadingState title={result?.name ?? title} />}

      {!loading && error && (
        <div className="host-article-state" role="alert">
          <span className="host-article-kicker">Não foi possível abrir o artigo</span>
          <h1>{result?.name ?? 'Resultado da pesquisa'}</h1>
          <p>{error}</p>
          {contentUrl && <code className="host-article-request-url">URL estruturada: {contentUrl.replace(/\/content\.txt(?=$|[?#])/, '/content.json')}</code>}
        </div>
      )}

      {!loading && !error && data && (
        <article className="host-article-card">
          {heroImage && (
            <figure className="host-article-hero-image">
              <img src={heroImage} alt={title} />
              <figcaption>{heroImageLabel}{data.originalimage?.width && data.originalimage?.height ? ` · ${data.originalimage.width} × ${data.originalimage.height}px` : ''}</figcaption>
            </figure>
          )}

          <header className="host-article-header">
            <span className="host-article-kicker">Artigo da Wikipédia</span>
            <h1>{title}</h1>
            {description && <p className="host-article-description">{description}</p>}
            {originalArticleUrl && (
              <a className="host-article-original-link" href={originalArticleUrl} target="_blank" rel="noreferrer">
                Abrir artigo original na Wikipédia ↗
              </a>
            )}
          </header>

          {(sanitizedExtractHtml || extract) && (
            <section className="host-article-section" aria-labelledby="host-article-summary-title">
              <h2 id="host-article-summary-title">Resumo</h2>
              {sanitizedExtractHtml
                ? <div className="host-article-extract" dangerouslySetInnerHTML={{ __html: sanitizedExtractHtml }} />
                : <p className="host-article-extract">{extract}</p>}
            </section>
          )}
        </article>
      )}

      {hasFallbackContent && (
        <article className="host-article-card">
          <header className="host-article-header">
            <span className="host-article-kicker">Conteúdo compatível</span>
            <h1>{result?.name ?? title}</h1>
            {description && <p className="host-article-description">{description}</p>}
            <a className="host-article-original-link" href={contentUrl ?? '#'} target="_blank" rel="noreferrer">
              Abrir conteúdo do add-on ↗
            </a>
          </header>
          <section className="host-article-section" aria-labelledby="host-article-fallback-title">
            <h2 id="host-article-fallback-title">Conteúdo</h2>
            <pre className="host-article-fallback-content">{fallbackContent}</pre>
          </section>
        </article>
      )}
    </section>
  );
}
