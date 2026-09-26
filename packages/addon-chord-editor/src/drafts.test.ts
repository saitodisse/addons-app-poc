import { describe, expect, it } from 'vitest';
import { createContractServiceAccess, type HostAPI } from '@addons-poc/protocol';
import { LocalChordDrafts, draftKey } from './drafts';
import { manifest } from './manifest';

function hostWithStore() {
  const values = new Map<string, unknown>();
  const store = {
    get: async (key: string) => values.get(key),
    set: async (key: string, value: unknown) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
    listKeys: async () => [...values.keys()],
    clear: async () => { values.clear(); },
  };
  const host = {
    services: createContractServiceAccess({ get: <T>() => store as T }, manifest.contract),
    registerService: () => {}, onUnload: () => {}, log: () => {},
  } as HostAPI;
  return { host, values };
}

describe('local chord drafts', () => {
  it('saves, reads, and removes a revision through the declared state service', async () => {
    const { host, values } = hostWithStore();
    const drafts = new LocalChordDrafts(host, () => '2026-09-25T00:00:00.000Z');
    const sourceUrl = 'http://localhost:5295/text/chart/harbor-light/content.json';
    expect(await drafts.get({ sourceUrl })).toEqual({ found: false });
    await drafts.save({ sourceUrl, baseChecksum: 'original', text: '[Verse]\nA D' });
    expect(await drafts.get({ sourceUrl })).toEqual({ found: true, text: '[Verse]\nA D', baseChecksum: 'original' });
    expect(values.get(draftKey(sourceUrl))).toMatchObject({ updatedAt: '2026-09-25T00:00:00.000Z' });
    await drafts.remove({ sourceUrl });
    expect(await drafts.get({ sourceUrl })).toEqual({ found: false });
  });

  it('uses the full content URL as identity', async () => {
    const { host } = hostWithStore();
    const drafts = new LocalChordDrafts(host);
    const first = 'http://localhost:5295/text/chart/one/content.json';
    const second = 'http://localhost:9999/text/chart/one/content.json';
    await drafts.save({ sourceUrl: first, baseChecksum: 'one', text: 'A' });
    expect(await drafts.get({ sourceUrl: second })).toEqual({ found: false });
  });
});
