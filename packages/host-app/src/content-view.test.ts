import { describe, expect, it, vi } from 'vitest';
import { requestContentView, type ContentViewProvider } from './content-view';

const request = { url: 'http://localhost:5295/text/chart/harbor-light/content.json', type: 'chart', name: 'Harbor Light' };

describe('requestContentView', () => {
  it('returns the html published by the provider', async () => {
    const provider: ContentViewProvider = {
      render: async (asked) => ({ html: '<pre>chart</pre>', title: 'Harbor Light', asked: asked.url } as never),
    };
    expect(await requestContentView(provider, request)).toEqual({ html: '<pre>chart</pre>', title: 'Harbor Light' });
  });

  it('omits an empty title', async () => {
    const provider: ContentViewProvider = { render: async () => ({ html: '<pre>chart</pre>', title: '  ' }) };
    expect(await requestContentView(provider, request)).toEqual({ html: '<pre>chart</pre>' });
  });

  it('returns nothing when no provider is active', async () => {
    expect(await requestContentView(undefined, request)).toBeUndefined();
  });

  it('returns nothing for an empty html or for a provider that declines', async () => {
    expect(await requestContentView({ render: async () => ({ html: '   ' }) }, request)).toBeUndefined();
    expect(await requestContentView({ render: async () => undefined }, request)).toBeUndefined();
    expect(await requestContentView({ render: () => null }, request)).toBeUndefined();
  });

  it('tolerates a provider that throws', async () => {
    const provider: ContentViewProvider = { render: async () => { throw new Error('boom'); } };
    expect(await requestContentView(provider, request)).toBeUndefined();
    expect(await requestContentView({ render: vi.fn(() => { throw new Error('sync boom'); }) }, request)).toBeUndefined();
  });

  it('ignores an empty url', async () => {
    const render = vi.fn(async () => ({ html: '<pre>x</pre>' }));
    expect(await requestContentView({ render }, { url: '' })).toBeUndefined();
    expect(render).not.toHaveBeenCalled();
  });
});