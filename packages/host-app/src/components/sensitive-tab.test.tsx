// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddonInstance, AddonTabField } from '@addons-poc/protocol';
import { AddonControlPanel } from './AddonControlPanel';
import { useAddonTab, type AddonTabController } from './useAddonTab';

describe('sensitive tab controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  it('reads a selected text certificate into the control and clears the native file input', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const setValue = vi.fn();
    const field: AddonTabField = { id: 'certificate', label: 'Local certificate', type: 'file', accept: '.cvcert', sensitive: true };
    const addon = { ui: { title: 'Catalogue', fields: [field] } } as unknown as AddonInstance;
    const controller = { values: {}, setValue, runningAction: null, run: vi.fn(), sections: [{ title: 'Encryption', fields: [field], actions: [] }] } as unknown as AddonTabController;
    await act(async () => root.render(createElement(AddonControlPanel, { addon, controller })));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 20, text: async () => '{"format":"private"}' }] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(setValue).toHaveBeenCalledWith('certificate', '{"format":"private"}');
    expect(input.value).toBe('');
    expect(input.accept).toBe('.cvcert');
  });

  it('sends the credential to its action once and clears it from the controls afterward', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const received: Record<string, string>[] = [];
    const fields: AddonTabField[] = [
      { id: 'certificate', label: 'Certificate', sensitive: true },
      { id: 'passphrase', label: 'Passphrase', sensitive: true },
    ];
    const addon = {
      ui: { title: 'Catalogue', fields, actions: [{ id: 'update', label: 'Update', receives: ['certificate', 'passphrase'] }], run: async (_id: string, values: Record<string, string>) => { received.push(values); return { status: 'success' as const, body: 'updated' }; } },
      manifest: { contract: { ui: {
        fields: fields.map((field) => ({ id: field.id, label: field.label, required: true, schema: { type: 'string', description: field.label, classification: 'secret' } })),
        actions: [{ id: 'update', label: 'Update', description: 'Update.', receives: ['certificate', 'passphrase'], returns: { description: 'Result.', schema: { type: 'object', description: 'Result.', classification: 'public' } } }],
      } } },
    } as unknown as AddonInstance;
    let current: AddonTabController | undefined;
    function Probe() {
      current = useAddonTab(addon);
      useEffect(() => {
        current?.setValue('certificate', '{"private":"key"}');
        current?.setValue('passphrase', 'local-only');
      }, []);
      return null;
    }
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await current?.run('update'); });

    expect(received).toEqual([{ certificate: '{"private":"key"}', passphrase: 'local-only' }]);
    expect(current?.values).not.toHaveProperty('certificate');
    expect(current?.values).not.toHaveProperty('passphrase');
  });
});
