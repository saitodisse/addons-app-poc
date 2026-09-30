const ENTITY_TYPES = new Set(['artist', 'musicalWork', 'playableVersion', 'chordChart', 'voicing', 'chordAlias']);
const SCHEMAS = new Set(['1.0.0', '1.1.0', '1.2.0', '1.3.0']);
const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function sourceRoot(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) catalogue root URL without credentials.');
  if (url.search || url.hash) throw new Error('Catalogue roots must not contain a query or fragment.');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url.href;
}

export function sourceLines(value) {
  const seen = new Set();
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try {
      const root = sourceRoot(line);
      if (seen.has(root)) return [];
      seen.add(root);
      return [{ root }];
    } catch (error) { return [{ root: line, error: error.message }]; }
  });
}

export async function sha256(bytes) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fileUrl(root, path) {
  if (typeof path !== 'string' || !path || /[\\?#]/.test(path) || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path)) throw new Error('Entity files must use relative paths.');
  const decoded = decodeURIComponent(path);
  if (decoded.split('/').includes('..') || decoded.includes('\\') || decoded.startsWith('/')) throw new Error('Entity files must stay below the catalogue root.');
  const url = new URL(path, root);
  if (!url.href.startsWith(root)) throw new Error('Entity file escaped the catalogue root.');
  return url.href;
}

async function readBytes(url, fetchFn, maxBytes = MAX_FILE_BYTES) {
  const response = await fetchFn(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
  if (response.url && response.url !== url) throw new Error('Catalogue files must not redirect.');
  if (Number(response.headers?.get('content-length')) > maxBytes) throw new Error('Catalogue file exceeds the download limit.');
  // Read incrementally so an oversized file does not exhaust browser memory.
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error('Catalogue file exceeds the download limit.');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel(); throw error; }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error('Catalogue file exceeds the download limit.');
  return bytes;
}

function requiredText(value, context) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${context}.`);
  return value;
}

function uniqueIndex(rows, key, context) {
  const index = new Map();
  for (const row of rows) {
    const value = requiredText(key(row), context);
    if (index.has(value)) throw new Error(`Duplicate ${context}: ${value}`);
    index.set(value, row);
  }
  return index;
}

export async function chartsFromRecords(root, manifest, rows) {
  const artists = uniqueIndex(rows.filter((r) => r.entityType === 'artist'), (r) => r.payload.slug, 'artist slug');
  const workRows = rows.filter((r) => r.entityType === 'musicalWork');
  const works = uniqueIndex(workRows, (r) => r.payload.identityKey ?? r.sourceRecordId, 'musical work key');
  const versions = uniqueIndex(rows.filter((r) => r.entityType === 'playableVersion'), (r) => r.sourceRecordId, 'playable version ID');
  const charts = [];
  for (const row of rows.filter((r) => r.entityType === 'chordChart')) {
    const version = versions.get(row.payload.playableVersionSourceRecordId);
    const work = version && works.get(version.payload.musicalWorkKey);
    const artist = work && artists.get(work.payload.artistSlug);
    if (!version || !work || !artist || (version.payload.artistSlug && version.payload.artistSlug !== artist.payload.slug)) throw new Error(`Broken chart relationship: ${row.sourceRecordId}`);
    const text = requiredText(row.payload.rawText, 'chart text');
    const id = `source:${encodeURIComponent(root)}:${encodeURIComponent(manifest.id)}:${encodeURIComponent(row.sourceRecordId)}`;
    charts.push({
      id, title: requiredText(work.payload.title, 'musical work title'),
      artist: { name: requiredText(artist.payload.name, 'artist name'), slug: artist.payload.slug },
      text, checksum: await sha256(text), key: version.payload.sourceKey ?? '',
      capo: version.payload.capo ?? 0, tempo: version.payload.tempo ?? 0,
      time: version.payload.time ?? '', difficulty: version.payload.difficulty ?? 5,
      chords: [], tags: [], composers: [], updatedAt: row.updatedAt ?? manifest.generatedAt ?? '',
      sourceRoot: root, sourceId: manifest.id, sourceName: manifest.name,
      versionLabel: version.payload.title, instrumentId: version.payload.instrumentId,
      tuningId: version.payload.tuningId,
    });
  }
  return charts;
}

/** Downloads a complete source before publishing any of its records locally. */
export async function importSource(root, fetchFn = fetch) {
  root = sourceRoot(root);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const manifest = JSON.parse(decoder.decode(await readBytes(new URL('source-manifest.json', root).href, fetchFn, 1024 * 1024)));
  requiredText(manifest.id, 'source ID');
  requiredText(manifest.name, 'source name');
  if (!SCHEMAS.has(manifest.schemaVersion) || manifest.mode !== 'readonly' || manifest.capabilities?.pull !== true || manifest.capabilities?.auth !== 'none') throw new Error('Unsupported Source Catalog manifest.');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0 || manifest.files.length > 64) throw new Error('Invalid entity file list.');
  // Every song is licensed by default. Only transport and data relationships are validated here.
  let checksums;
  try {
    checksums = JSON.parse(decoder.decode(await readBytes(new URL('checksums.json', root).href, fetchFn, 1024 * 1024)));
  } catch (error) {
    if (!String(error.message).startsWith('HTTP 404 ') || manifest.files.some((file) => !file.sha256)) throw error;
  }
  const records = [];
  const paths = new Set();
  const identities = new Set();
  let total = 0;
  for (const file of manifest.files) {
    const url = fileUrl(root, file.url);
    if (paths.has(url) || !ENTITY_TYPES.has(file.entityType) || file.mediaType !== 'application/x-ndjson') throw new Error('Invalid or duplicate entity file.');
    paths.add(url);
    const sidecar = checksums?.[file.url];
    const expected = file.sha256 ?? (typeof sidecar === 'string' ? sidecar : sidecar?.sha256);
    const sideHash = typeof sidecar === 'string' ? sidecar : sidecar?.sha256;
    if (!/^[a-f\d]{64}$/i.test(expected ?? '') || (sideHash && sideHash !== expected)) throw new Error(`Missing or inconsistent SHA-256 for ${file.url}`);
    const bytes = await readBytes(url, fetchFn);
    total += bytes.length;
    if (total > 128 * 1024 * 1024) throw new Error('Catalogue exceeds the download limit.');
    if ((file.sizeBytes !== undefined && file.sizeBytes !== bytes.length) || await sha256(bytes) !== expected.toLowerCase()) throw new Error(`Integrity check failed: ${file.url}`);
    for (const [index, line] of decoder.decode(bytes).split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { throw new Error(`Invalid JSON at ${file.url}:${index + 1}`); }
      if (!row || row.sourceId !== manifest.id || row.schemaVersion !== manifest.schemaVersion || row.entityType !== file.entityType || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) throw new Error(`Invalid envelope at ${file.url}:${index + 1}`);
      requiredText(row.sourceRecordId, 'source record ID');
      const identity = `${row.entityType}:${row.sourceRecordId}`;
      if (identities.has(identity)) throw new Error(`Duplicate record: ${identity}`);
      identities.add(identity);
      records.push(row);
    }
  }
  return { root, sourceId: manifest.id, name: manifest.name, importedAt: new Date().toISOString(), charts: await chartsFromRecords(root, manifest, records) };
}

export async function updateSources(value, store, fetchFn = fetch) {
  const results = [];
  for (const source of sourceLines(value)) {
    try {
      if (source.error) throw new Error(source.error);
      const snapshot = await importSource(source.root, fetchFn);
      await store.put(snapshot);
      results.push({ root: source.root, count: snapshot.charts.length });
    } catch (error) { results.push({ root: source.root, error: error.message }); }
  }
  return results;
}
