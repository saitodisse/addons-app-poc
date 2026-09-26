import type { ContentViewRequest, ContentViewResult } from './content-view';

/** Optional, domain-neutral convention for editing a result by its content URL. */
export const CONTENT_EDITOR_SERVICE = 'host.content-editor';

export interface ContentEditorProvider {
  supports(request: ContentViewRequest): boolean | Promise<boolean>;
  render(request: ContentViewRequest): Promise<{ html?: string; title?: string } | undefined>
    | { html?: string; title?: string } | undefined;
}

export async function supportsContentEditor(
  provider: ContentEditorProvider | undefined,
  request: ContentViewRequest,
): Promise<boolean> {
  if (!provider || typeof provider.supports !== 'function' || !request.url) return false;
  try {
    return await provider.supports(request) === true;
  } catch {
    return false;
  }
}

export async function requestContentEditor(
  provider: ContentEditorProvider | undefined,
  request: ContentViewRequest,
): Promise<ContentViewResult | undefined> {
  if (!provider || typeof provider.render !== 'function' || !request.url) return undefined;
  const result = await provider.render(request);
  const html = typeof result?.html === 'string' ? result.html.trim() : '';
  if (!html) return undefined;
  const title = typeof result?.title === 'string' ? result.title.trim() : '';
  return { html, ...(title ? { title } : {}) };
}
