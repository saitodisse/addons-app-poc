import { afterEach, describe, expect, it, vi } from 'vitest';
import { retainInstalledAddons } from './offline';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('offline registration', () => {
  it('registers a new worker after a factory reset before retaining installed add-ons', async () => {
    vi.stubEnv('PROD', true);
    const worker = { state: 'activated', postMessage: vi.fn() };
    const register = vi.fn().mockResolvedValue({ active: worker });
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    await retainInstalledAddons(['https://example.com/manifest.json']);

    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'installed-addons', urls: ['https://example.com/manifest.json'] });
  });

  it('waits for a newly installing worker to activate', async () => {
    vi.stubEnv('PROD', true);
    const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage: vi.fn() });
    vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue({ installing: worker }) } });

    const pending = retainInstalledAddons(['https://example.com/manifest.json']);
    await Promise.resolve();
    expect(worker.postMessage).not.toHaveBeenCalled();
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
    await pending;
    expect(worker.postMessage).toHaveBeenCalledOnce();
  });
});
