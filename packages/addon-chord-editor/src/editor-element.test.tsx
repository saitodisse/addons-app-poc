// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EditorSession } from './editor-element';

vi.mock('@monaco-editor/react', () => ({
  default: () => null,
  loader: { config: vi.fn(), init: () => new Promise(() => {}) },
}));

afterEach(async () => {
  await act(async () => { document.body.replaceChildren(); });
  vi.unstubAllGlobals();
});

it('mounts an editor from a reloaded bundle using the already registered element', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const first = await import('./editor-element');
  first.registerEditorElement();
  vi.resetModules();
  const reloaded = await import('./editor-element');
  reloaded.registerEditorElement();
  const session: EditorSession = {
    chart: { id: 'imported', title: 'Só Louco', artist: 'Nana Caymmi', sourceUrl: 'https://example.com/content.json', sourceChecksum: 'checksum', originalText: 'Bb\nCanção' },
    drafts: { get: vi.fn(), save: vi.fn(), remove: vi.fn() },
    viewer: { render: () => ({ html: '<pre>Bb</pre>' }) },
    monacoBase: 'http://localhost:5309/monaco/vs', initialText: 'Bb\nCanção', staleDraft: false,
  };
  await act(async () => { document.body.innerHTML = reloaded.editorMarkup(session); });
  expect(document.querySelector('addons-chord-editor')?.textContent).toContain('Chart text');
  expect(document.querySelector('addons-chord-editor')?.textContent).toContain('Save local draft');
});
