import { describe, expect, it } from 'vitest';
import { isResultRoute, resultRoute, resultUrlFromRoute } from './router';

describe('search result routes', () => {
  it('encodes and recovers the original add-on URL in one segment', () => {
    const contentUrl = 'http://localhost:5294/text/page/Mammals/content.txt';
    const route = resultRoute(contentUrl);

    expect(route).toBe(`/article/${encodeURIComponent(contentUrl)}`);
    expect(isResultRoute(route)).toBe(true);
    expect(resultUrlFromRoute(route)).toBe(contentUrl);
  });

  it('rejects incomplete article routes and non-HTTP schemes', () => {
    expect(isResultRoute('/article/')).toBe(true);
    expect(resultUrlFromRoute('/article/')).toBeNull();
    expect(resultUrlFromRoute(`/article/${encodeURIComponent('javascript:alert(1)')}`)).toBeNull();
    expect(resultUrlFromRoute('/settings')).toBeNull();
  });
});
