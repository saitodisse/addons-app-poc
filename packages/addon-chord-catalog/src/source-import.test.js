import { describe, expect, it } from 'vitest';
import { importSource, sha256, sourceLines, updateSources } from './source-import.js';

const ROOT = 'https://example.test/source-catalog/';
async function fixture({ broken = false, corrupt = false, sidecar = true, inline = true, path = 'entities/charts.ndjson' } = {}) {
  const schemaVersion = '1.3.0';
  const envelope = (entityType, id, payload) => ({ sourceId: 'source-a', schemaVersion, entityType, sourceRecordId: id, payload });
  const rows = {
    artist: ['a', 'b'].map((id) => envelope('artist', id, { slug: id, name: `Artist ${id}` })),
    musicalWork: ['a', 'b'].map((id) => envelope('musicalWork', `work-${id}`, { title: 'Same title', artistSlug: id, identityKey: `work-${id}` })),
    playableVersion: ['a', 'b'].map((id) => envelope('playableVersion', `version-${id}`, { title: 'Original', musicalWorkKey: `work-${id}`, artistSlug: id, sourceKey: 'C', instrumentId: 'guitar', tuningId: 'guitar-standard' })),
    chordChart: ['a', 'b'].map((id) => envelope('chordChart', `chart-${id}`, { playableVersionSourceRecordId: broken ? 'missing' : `version-${id}`, rawText: `[Verse]\nC   G\nSong ${id}` })),
  };
  const files = [];
  const responses = new Map();
  const checksums = {};
  for (const [entityType, records] of Object.entries(rows)) {
    const url = entityType === 'chordChart' ? path : `entities/${entityType}.ndjson`;
    const text = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
    const digest = await sha256(text);
    files.push({ url, entityType, mediaType: 'application/x-ndjson', sizeBytes: new TextEncoder().encode(text).length, ...(inline ? { sha256: digest } : {}) });
    checksums[url] = digest;
    responses.set(new URL(url, ROOT).href, text + (corrupt && entityType === 'chordChart' ? ' ' : ''));
  }
  responses.set(`${ROOT}source-manifest.json`, JSON.stringify({ id: 'source-a', name: 'Artists', schemaVersion, mode: 'readonly', capabilities: { pull: true, auth: 'none' }, files }));
  if (sidecar) responses.set(`${ROOT}checksums.json`, JSON.stringify(checksums));
  return { responses, fetchFn: async (url) => new Response(responses.get(url) ?? 'Not found', { status: responses.has(url) ? 200 : 404 }) };
}

function memoryStore(initial = []) {
  const sources = new Map(initial.map((source) => [source.root, source]));
  return { list: async () => [...sources.values()], put: async (snapshot) => sources.set(snapshot.root, snapshot) };
}

describe('Source Catalog importer', () => {
  it('normalizes root URLs, ignores duplicate lines, and reports invalid lines independently', () => {
    expect(sourceLines(`${ROOT}\n${ROOT.slice(0, -1)}\n\nfile:///x`)).toEqual([{ root: ROOT }, { root: 'file:///x', error: expect.any(String) }]);
  });
  it('joins multiple artists and keeps equally titled charts distinct', async () => {
    const { fetchFn } = await fixture();
    const snapshot = await importSource(ROOT, fetchFn);
    expect(snapshot.charts.map((chart) => chart.artist.name)).toEqual(['Artist a', 'Artist b']);
    expect(new Set(snapshot.charts.map((chart) => chart.id)).size).toBe(2);
    expect(snapshot.charts[0].checksum).toBe(await sha256(snapshot.charts[0].text));
  });
  it('supports checksums only in descriptors or only in the sidecar', async () => {
    for (const options of [{ sidecar: false }, { inline: false }]) {
      const { fetchFn } = await fixture(options);
      expect((await importSource(ROOT, fetchFn)).charts).toHaveLength(2);
    }
  });
  it('rejects bytes changed before parsing', async () => {
    const { fetchFn } = await fixture({ corrupt: true });
    await expect(importSource(ROOT, fetchFn)).rejects.toThrow('Integrity check failed');
  });
  it('rejects broken relationships before publishing a source', async () => {
    const { fetchFn } = await fixture({ broken: true });
    await expect(importSource(ROOT, fetchFn)).rejects.toThrow('Broken chart relationship');
  });
  it('rejects traversal and escaped paths', async () => {
    for (const path of ['../charts.ndjson', '%2e%2e/charts.ndjson', '/charts.ndjson', 'https://elsewhere.test/charts.ndjson']) {
      const { fetchFn } = await fixture({ path });
      await expect(importSource(ROOT, fetchFn)).rejects.toThrow(/relative paths|root/);
    }
  });
  it('retains a failed snapshot while independently importing healthy sources', async () => {
    const old = { root: 'https://failed.test/', charts: [{ id: 'old', text: 'old chart' }] };
    const store = memoryStore([old]);
    const { fetchFn } = await fixture();
    const results = await updateSources(`${old.root}\n${ROOT}`, store, fetchFn);
    expect(results[0].error).toContain('HTTP 404');
    expect(results[1].count).toBe(2);
    expect((await store.list())[0]).toEqual(old);
  });
  it('does not remove snapshots when their URL leaves the settings list', async () => {
    const old = { root: ROOT, charts: [{ id: 'old' }] };
    const store = memoryStore([old]);
    await updateSources('', store, () => { throw new Error('Must not fetch'); });
    expect(await store.list()).toEqual([old]);
  });
  it('reports storage errors without declaring a successful import', async () => {
    const { fetchFn } = await fixture();
    const results = await updateSources(ROOT, { put: async () => { throw new Error('Quota exceeded'); } }, fetchFn);
    expect(results).toEqual([{ root: ROOT, error: 'Quota exceeded' }]);
  });
});
