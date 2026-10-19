import { describe, expect, it } from 'vitest';
import { importSource, sha256, sourceLines, updateSources } from './source-import.js';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { encryptedTestArchive } from './test-crypto-fixture.js';

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

const ZIP_URL = 'https://example.test/downloads.zip';
const SCRAPER_TEXT = '[Intro]\r\nC   G\r\n  Canção brasileira  \r\n';
async function scraperZip({ prefix = 'downloads/artist/', changeText = false, missingText = false } = {}) {
  const data = {
    source: 'Cifra Club', sourceUrl: 'https://www.cifraclub.com.br/artist/song/', collectedAt: '2026-10-18T12:00:00Z',
    artist: { name: 'Artista', slug: 'artist', genre: { name: 'MPB' } }, title: 'Canção',
    file: { name: 'song.txt', sha256: await sha256(SCRAPER_TEXT), bytes: strToU8(SCRAPER_TEXT).length },
    chart: { displayedKey: 'C', capo: 2, tuning: 'E A D G B E', instrument: { slug: 'cifra-group' }, composers: ['Compositor'], version: { name: 'Principal' } },
    chords: [{ name: 'C', shapes: { guitar: ['X 3 2 0 1 0'] } }, { name: 'G' }],
  };
  const files = { [`${prefix}song.source.json`]: strToU8(JSON.stringify(data)), [`${prefix}songs.json`]: strToU8('[]') };
  if (!missingText) files[`${prefix}song.txt`] = strToU8(changeText ? 'changed text' : SCRAPER_TEXT);
  return { bytes: zipSync(files), data };
}
const zipFetch = (bytes) => async () => new Response(bytes, { headers: { 'Content-Type': 'application/zip' } });

describe('TAR with Zstandard imports', () => {
  it('imports an entire downloads folder packed with tar -I zstd, preserving artists and text', async () => {
    const bytes = await readFile(new URL('./fixtures/downloads.tar.zst', import.meta.url));
    const root = 'https://example.test/downloads.tar.zst';
    const requests = [];
    const store = memoryStore();
    const result = await updateSources(root, store, async (url) => { requests.push(url); return new Response(bytes); });
    expect(result).toEqual([{ root, count: 2, warnings: ['1 TXT file(s) without .source.json were ignored.'] }]);
    expect(requests).toEqual([root]);
    const snapshot = (await store.list())[0];
    expect(snapshot.charts.map((chart) => chart.artist.slug).sort()).toEqual(['first', 'second']);
    expect(snapshot.charts[0].text).toBe('[Intro]\r\nC   G\r\n  Exemplo  \r\n');
  });
  it('keeps a fragment access token out of the source URL and sends it as a bearer header', async () => {
    const bytes = await readFile(new URL('./fixtures/downloads.tar.zst', import.meta.url));
    const token = 'v1.YWJj.ZGVm';
    const url = `https://downloads.example/api/downloads.tar.zst#token=${token}`;
    const requests = [];
    const store = memoryStore();
    const result = await updateSources(url, store, async (requestUrl, options) => {
      requests.push({ url: requestUrl, authorization: new Headers(options.headers).get('Authorization') });
      return new Response(bytes);
    });
    expect(sourceLines(url)).toEqual([{ root: 'https://downloads.example/api/downloads.tar.zst', token }]);
    expect(requests).toEqual([{ url: 'https://downloads.example/api/downloads.tar.zst', authorization: `Bearer ${token}` }]);
    expect(result[0].root).toBe('https://downloads.example/api/downloads.tar.zst');
    expect((await store.list())[0].root).not.toContain(token);
  });

  it('downloads ciphertext with the link token, decrypts locally, and imports the complete archive', async () => {
    const plaintext = (await scraperZip()).bytes;
    const passphrase = 'a correct horse battery 2026';
    const encrypted = await encryptedTestArchive(plaintext, passphrase);
    const token = 'v1.YWJj.ZGVm';
    const url = `https://downloads.example/api/downloads.tar.zst.enc#token=${token}`;
    const store = memoryStore();
    const requests = [];
    const results = await updateSources(url, store, async (requestUrl, options) => {
      requests.push({ url: requestUrl, authorization: new Headers(options.headers).get('Authorization') });
      return new Response(encrypted.bytes);
    }, { certificate: encrypted.certificate, passphrase });
    expect(requests).toEqual([{ url: 'https://downloads.example/api/downloads.tar.zst.enc', authorization: `Bearer ${token}` }]);
    expect(results).toEqual([{ root: 'https://downloads.example/api/downloads.tar.zst.enc', count: 1 }]);
    expect((await store.list())[0].charts[0].title).toBe('Canção');
  });

  it('keeps the previous charts when the local certificate password is wrong', async () => {
    const plaintext = (await scraperZip()).bytes;
    const encrypted = await encryptedTestArchive(plaintext, 'right horse battery staple');
    const root = 'https://downloads.example/downloads.tar.zst.enc';
    const previous = { root, charts: [{ id: 'existing' }] };
    const store = memoryStore([previous]);
    const result = await updateSources(root, store, async () => new Response(encrypted.bytes), {
      certificate: encrypted.certificate, passphrase: 'wrong password',
    });
    expect(result[0].error).toMatch(/certificate|passphrase|decrypt/i);
    expect(await store.list()).toEqual([previous]);
  });

  it('rejects malformed fragment access tokens', () => {
    expect(sourceLines('https://downloads.example/api/downloads.tar.zst#token=plain-secret')[0].error).toMatch(/token/i);
    expect(sourceLines('https://downloads.example/api/downloads.tar.zst#token=a&extra=b')[0].error).toMatch(/fragment/i);
  });

  it('retains signed TAR URLs and identifies Zstandard from bytes even with a ZIP filename', async () => {
    const bytes = await readFile(new URL('./fixtures/downloads.tar.zst', import.meta.url));
    const root = 'https://example.test/downloads.tar.zst?signature=test';
    expect(sourceLines(root)).toEqual([{ root }]);
    expect(sourceLines('https://example.test/downloads.tzst')).toEqual([{ root: 'https://example.test/downloads.tzst' }]);
    expect((await importSource(ZIP_URL, async () => new Response(bytes))).charts).toHaveLength(2);
  });

  it('keeps the previous library when the Zstandard download is truncated', async () => {
    const bytes = await readFile(new URL('./fixtures/downloads.tar.zst', import.meta.url));
    const root = 'https://example.test/downloads.tar.zst';
    const previous = { root, charts: [{ id: 'existing' }] };
    const store = memoryStore([previous]);
    const results = await updateSources(root, store, async () => new Response(bytes.subarray(0, bytes.length - 8)));
    expect(results[0].error).toBeTruthy();
    expect(await store.list()).toEqual([previous]);
  });

});

describe('ZIP source imports', () => {
  it('preserves ZIP URLs, signed queries and deduplicates them without appending a slash', () => {
    const signed = `${ZIP_URL}?token=example`;
    expect(sourceLines(`${ZIP_URL}\n${ZIP_URL}\n${signed}`)).toEqual([{ root: ZIP_URL }, { root: signed }]);
    expect(sourceLines(`${ROOT}source-manifest.json`)).toEqual([{ root: ROOT }]);
  });

  it('converts scraper pairs without changing text, origin, collection date or chord metadata', async () => {
    const { bytes, data } = await scraperZip();
    const snapshot = await importSource(ZIP_URL, zipFetch(bytes));
    expect(snapshot.root).toBe(ZIP_URL);
    expect(snapshot.charts).toHaveLength(1);
    expect(snapshot.charts[0]).toMatchObject({ title: 'Canção', text: SCRAPER_TEXT, artist: { name: 'Artista', slug: 'artist' },
      key: 'C', capo: 2, chords: ['C', 'G'], composers: ['Compositor'], tags: ['MPB'],
      collectedAt: data.collectedAt, sourceUrl: data.sourceUrl, instrumentId: 'guitar', tuningId: 'guitar-standard', scraperMetadata: data });
  });

  it('imports multiple artists together and reports auxiliary TXT files without metadata', async () => {
    const { bytes, data } = await scraperZip();
    const files = unzipSync(bytes);
    files['downloads/second/song.txt'] = strToU8(SCRAPER_TEXT);
    files['downloads/second/song.source.json'] = strToU8(JSON.stringify({ ...data,
      artist: { name: 'Segunda artista', slug: 'second' }, sourceUrl: 'https://www.cifraclub.com.br/second/song/' }));
    files['downloads/musicas.txt'] = strToU8('auxiliary list');
    const store = memoryStore();
    const results = await updateSources(ZIP_URL, store, zipFetch(zipSync(files)));
    expect(results[0]).toMatchObject({ count: 2, warnings: ['1 TXT file(s) without .source.json were ignored.'] });
    expect((await store.list())[0].charts.map((chart) => chart.artist.name)).toEqual(['Artista', 'Segunda artista']);
  });

  it('imports a packed Source Catalog using the same hashes and relationships as HTTP imports', async () => {
    const { responses } = await fixture();
    const files = Object.fromEntries([...responses].map(([url, text]) => [`export/${url.slice(ROOT.length)}`, strToU8(text)]));
    const snapshot = await importSource(ZIP_URL, zipFetch(zipSync(files)));
    expect(snapshot.charts.map((chart) => chart.artist.slug)).toEqual(['a', 'b']);
    expect(snapshot.charts[0].sourceRoot).toBe(ZIP_URL);
  });

  it('keeps chart IDs stable when the ZIP wrapper folder changes', async () => {
    const first = await scraperZip();
    const second = await scraperZip({ prefix: 'artist/' });
    expect((await importSource(ZIP_URL, zipFetch(first.bytes))).charts[0].id)
      .toBe((await importSource(ZIP_URL, zipFetch(second.bytes))).charts[0].id);
  });

  it('detects an extensionless ZIP endpoint after a missing catalogue manifest', async () => {
    const { bytes } = await scraperZip();
    const requests = [];
    const snapshot = await importSource('https://example.test/export', async (url) => {
      requests.push(url);
      return url === 'https://example.test/export' ? new Response(bytes, { headers: { 'Content-Type': 'application/zip' } }) : new Response('', { status: 404 });
    });
    expect(snapshot.charts).toHaveLength(1);
    expect(requests).toEqual(['https://example.test/export/source-manifest.json', 'https://example.test/export/', 'https://example.test/export']);
  });

  it('does not probe ZIP endpoints when a catalogue returns 403', async () => {
    let requests = 0;
    await expect(importSource(ROOT, async () => { requests++; return new Response('', { status: 403 }); })).rejects.toThrow('HTTP 403');
    expect(requests).toBe(1);
  });

  it('keeps the previous snapshot if a TXT is missing or its bytes fail verification', async () => {
    for (const options of [{ missingText: true }, { changeText: true }]) {
      const old = { root: ZIP_URL, charts: [{ id: 'old' }] };
      const store = memoryStore([old]);
      const { bytes } = await scraperZip(options);
      const results = await updateSources(ZIP_URL, store, zipFetch(bytes));
      expect(results[0].error).toMatch(/Missing chart text|Integrity check failed/);
      expect(await store.list()).toEqual([old]);
    }
  });

  it('rejects traversal, unsupported archives and non-ZIP responses', async () => {
    for (const [bytes, message] of [
      [zipSync({ '../escape.txt': strToU8('x') }), /Unsafe ZIP path/],
      [zipSync({ 'readme.json': strToU8('{}') }), /neither a Source Catalog/],
      [strToU8('<html>not a zip</html>'), /did not return a ZIP/],
    ]) await expect(importSource(ZIP_URL, zipFetch(bytes))).rejects.toThrow(message);
  });

  it('rejects oversized declared entries before decompressing and retains explicit HTTP failures', async () => {
    const bytes = zipSync({ 'song.txt': strToU8('small') });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    for (let i = 0; i < bytes.length - 24; i++) {
      if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 33 * 1024 * 1024, true); break; }
    }
    await expect(importSource(ZIP_URL, zipFetch(bytes))).rejects.toThrow('ZIP exceeds the extraction limit');
    await expect(importSource(ZIP_URL, async () => new Response('', { status: 403 }))).rejects.toThrow('HTTP 403');
  });
});
