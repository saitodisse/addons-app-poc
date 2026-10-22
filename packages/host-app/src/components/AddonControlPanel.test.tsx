// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonControlPanel } from './AddonControlPanel';
import type { AddonTabController } from './useAddonTab';

it('keeps primary controls visible while advanced settings expand and collapse', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const fields = [
    { id: 'fontSize', label: 'Font size', type: 'range' as const },
    { id: 'transposeNumber', label: 'Transpose', type: 'range' as const },
    { id: 'chordColor', label: 'Chord color', type: 'color' as const },
  ];
  const addon = { ui: { title: 'Viewer' } } as AddonInstance;
  const controller: AddonTabController = {
    values: { fontSize: '30', transposeNumber: '3', chordColor: '#123456' },
    setValue: vi.fn(), runningAction: null, response: null, ready: true,
    run: vi.fn(async () => {}),
    sections: [
      { title: 'Current chart', fields: fields.slice(0, 2), actions: [] },
      { title: 'Appearance', fields: fields.slice(2), actions: [{ id: 'reset', label: 'Reset' }] },
    ],
  };
  function Page() {
    const [expanded, setExpanded] = useState(false);
    return <AddonControlPanel addon={addon} controller={controller} reading compact={!expanded}
      primaryFieldIds={['fontSize', 'transposeNumber']} onToggleExpanded={() => setExpanded(!expanded)} />;
  }
  try {
    await act(async () => root.render(<Page />));
    const ranges = () => [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].map((input) => input.value);
    const toggle = () => container.querySelector<HTMLButtonElement>('.host-tab-panel-disclosure')!;
    expect(ranges()).toEqual(['30', '3']);
    expect(container.querySelector('input[type="color"]')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle().click());
    expect(container.querySelector('input[type="color"]')).not.toBeNull();
    expect(container.textContent).toContain('Reset');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await act(async () => toggle().click());
    expect(ranges()).toEqual(['30', '3']);
    expect(container.querySelector('input[type="color"]')).toBeNull();
    expect(container.textContent).not.toContain('Reset');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
