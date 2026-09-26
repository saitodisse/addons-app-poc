import { describe, expect, it, vi } from 'vitest';
import { requestContentEditor, supportsContentEditor } from './content-editor';

const request = { url: 'http://localhost:5295/text/chart/example/content.txt', type: 'chart' };

describe('optional content editor', () => {
  it('asks a provider whether it supports a result', async () => {
    const supports = vi.fn(() => true);
    expect(await supportsContentEditor({ supports, render: () => undefined }, request)).toBe(true);
    expect(supports).toHaveBeenCalledWith(request);
  });

  it('keeps the result readable when no editor supports it', async () => {
    expect(await supportsContentEditor(undefined, request)).toBe(false);
    expect(await supportsContentEditor({ supports: () => { throw new Error('broken'); }, render: () => undefined }, request)).toBe(false);
  });

  it('accepts only a nonempty editing view', async () => {
    const provider = { supports: () => true, render: () => ({ html: ' <addons-chord-editor></addons-chord-editor> ', title: ' Edit chart ' }) };
    expect(await requestContentEditor(provider, request)).toEqual({ html: '<addons-chord-editor></addons-chord-editor>', title: 'Edit chart' });
    expect(await requestContentEditor({ supports: () => true, render: () => ({ html: '  ' }) }, request)).toBeUndefined();
  });
});
