// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EditorSession } from './editor-element';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <textarea aria-label="Monaco test" value={value} readOnly />,
  loader: { config: vi.fn(), init: async () => ({}) },
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

it('cleans leading zero-width markers in editor and preview while preserving alignment', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { editorMarkup } = await import('./editor-element');
  const render = vi.fn(() => ({ html: '<pre>preview</pre>' }));
  const originalText = '\u200bG\r\n\u200bCalamidade\r\n\u200b    Dm\r\n\u200bNo discurso';
  const session: EditorSession = {
    chart: { id: 'markers', title: 'Chart', artist: '', sourceUrl: 'https://example.com/content.json', sourceChecksum: 'checksum', originalText },
    drafts: { get: vi.fn(), save: vi.fn(), remove: vi.fn() }, viewer: { render },
    monacoBase: 'http://localhost:5309/monaco/vs', initialText: originalText, staleDraft: false,
  };
  await act(async () => { document.body.innerHTML = editorMarkup(session); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
  expect((document.querySelector('[aria-label="Monaco test"]') as HTMLTextAreaElement).value).toBe('G\nCalamidade\n    Dm\nNo discurso');
  expect(render).toHaveBeenCalledWith({ text: 'G\nCalamidade\n    Dm\nNo discurso' });
});
