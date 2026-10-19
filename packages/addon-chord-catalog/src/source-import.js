import { MAX_ARCHIVE_BYTES, readZip } from './zip-source.js';
import { readTarZstd } from './tar-zstd-source.js';
import { decryptArchive } from './archive-crypto.js';

const ENTITY_TYPES = new Set(['artist', 'musicalWork', 'playableVersion', 'chordChart', 'voicing', 'chordAlias']);
const SCHEMAS = new Set(['1.0.0', '1.1.0', '1.2.0', '1.3.0']);
const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function sourceRoot(value) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) catalogue root URL without credentials.');
  if (url.hash) throw new Error('Source URLs must not contain a fragment.');
  if (url.pathname.endsWith('/source-manifest.json')) url.pathname = url.pathname.slice(0, -'source-manifest.json'.length);
  if (/\.(zip|tar\.zst|tzst|tar\.zst\.enc)$/i.test(url.pathname) || url.search) return url.href;
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url.href;
}

export function sourceLines(value) {
  const seen = new Set();
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try {
      const url = new URL(line);
      let token;
      if (url.hash) {
        const parameters = new URLSearchParams(url.hash.slice(1));
        token = parameters.get('token');
        if (parameters.size !== 1 || !token) throw new Error('Source URL fragment must contain only an access token.');
        if (!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 512) throw new Error('Invalid source access token.');
        url.hash = '';
      }
      const root = sourceRoot(url.href);
      const identity = `${root}\0${token ?? ''}`;
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [{ root, ...(token ? { token } : {}) }];
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

async function readBytes(url, fetchFn, maxBytes = MAX_FILE_BYTES, suppliedResponse) {
  const response = suppliedResponse ?? await fetchFn(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
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

async function importCatalogue(root, fetchFn, files, prefix = '') {
  const readFile = async (path, limit = MAX_FILE_BYTES) => {
    const url = fileUrl(files ? 'https://archive.invalid/' : root, path);
    if (!files) return readBytes(url, fetchFn, limit);
    const bytes = files.get(`${prefix}${decodeURIComponent(new URL(url).pathname.slice(1))}`);
    if (!bytes) throw new Error(`HTTP 404 at ${path}`);
    if (bytes.length > limit) throw new Error('Catalogue file exceeds the download limit.');
    return bytes;
  };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const manifest = JSON.parse(decoder.decode(await readFile('source-manifest.json', 1024 * 1024)));
  requiredText(manifest.id, 'source ID');
  requiredText(manifest.name, 'source name');
  if (!SCHEMAS.has(manifest.schemaVersion) || manifest.mode !== 'readonly' || manifest.capabilities?.pull !== true || manifest.capabilities?.auth !== 'none') throw new Error('Unsupported Source Catalog manifest.');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0 || manifest.files.length > 64) throw new Error('Invalid entity file list.');
  // Every song is licensed by default. Only transport and data relationships are validated here.
  let checksums;
  try {
    checksums = JSON.parse(decoder.decode(await readFile('checksums.json', 1024 * 1024)));
  } catch (error) {
    if (!String(error.message).startsWith('HTTP 404 ') || manifest.files.some((file) => !file.sha256)) throw error;
  }
  const records = [];
  const paths = new Set();
  const identities = new Set();
  let total = 0;
  for (const file of manifest.files) {
    const url = fileUrl(files ? 'https://archive.invalid/' : root, file.url);
    if (paths.has(url) || !ENTITY_TYPES.has(file.entityType) || file.mediaType !== 'application/x-ndjson') throw new Error('Invalid or duplicate entity file.');
    paths.add(url);
    const sidecar = checksums?.[file.url];
    const expected = file.sha256 ?? (typeof sidecar === 'string' ? sidecar : sidecar?.sha256);
    const sideHash = typeof sidecar === 'string' ? sidecar : sidecar?.sha256;
    if (!/^[a-f\d]{64}$/i.test(expected ?? '') || (sideHash && sideHash !== expected)) throw new Error(`Missing or inconsistent SHA-256 for ${file.url}`);
    const bytes = await readFile(file.url);
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

function originUrl(value, context) {
  const url = new URL(requiredText(value, context));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid ${context}.`);
  return url.href;
}

async function importScraper(root, files) {
  const jsonDecoder = new TextDecoder('utf-8', { fatal: true });
  const textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const charts = [];
  const identities = new Set();
  const paired = new Set();
  for (const [path, bytes] of files) {
    if (!path.endsWith('.source.json')) continue;
    let data;
    try { data = JSON.parse(jsonDecoder.decode(bytes)); } catch { throw new Error(`Invalid scraper metadata: ${path}`); }
    const txtPath = path.slice(0, -'.source.json'.length) + '.txt';
    const txt = files.get(txtPath);
    if (!txt) throw new Error(`Missing chart text: ${txtPath}`);
    if (data.file?.name && data.file.name !== txtPath.split('/').at(-1)) throw new Error(`Inconsistent chart filename: ${path}`);
    const checksum = await sha256(txt);
    if ((data.file?.sha256 && data.file.sha256.toLowerCase() !== checksum) || (data.file?.bytes !== undefined && data.file.bytes !== txt.length)) throw new Error(`Integrity check failed: ${txtPath}`);
    const sourceUrl = originUrl(data.sourceUrl, 'chart source URL');
    if (identities.has(sourceUrl)) throw new Error(`Duplicate chart source URL: ${sourceUrl}`);
    identities.add(sourceUrl);
    if (!data.artist || typeof data.artist !== 'object') throw new Error(`Missing artist metadata: ${path}`);
    requiredText(data.collectedAt, 'collection date');
    if (!Number.isFinite(Date.parse(data.collectedAt))) throw new Error(`Invalid collection date: ${path}`);
    const details = data.chart ?? {};
    const text = requiredText(textDecoder.decode(txt), 'chart text');
    const instrument = { 'cifra-group': 'guitar', guitar: 'guitar', ukulele: 'ukulele', cavaco: 'cavaquinho', keyboard: 'keyboard', bass: 'bass' }[details.instrument?.slug];
    const chords = Array.isArray(data.chords) ? data.chords : [];
    const chordNames = [...new Set(chords.map((chord) => typeof chord === 'string' ? chord : chord.name).filter((name) => typeof name === 'string' && name.trim()))];
    charts.push({
      id: `source:${encodeURIComponent(root)}:scraper:${encodeURIComponent(sourceUrl)}`,
      title: requiredText(data.title, 'chart title'),
      artist: { name: requiredText(data.artist.name, 'artist name'), slug: requiredText(data.artist.slug, 'artist slug') },
      text, checksum, key: details.displayedKey ?? details.originalKey ?? '', capo: details.capo ?? 0,
      tempo: details.strummings?.find((item) => Number.isFinite(item.bpm))?.bpm ?? 0,
      time: '', difficulty: 5, chords: chordNames, composers: details.composers ?? [],
      tags: data.artist.genre?.name ? [data.artist.genre.name] : [], visits: details.statistics?.allTimeViews ?? 0,
      updatedAt: details.sourceUpdatedAt ?? data.collectedAt, collectedAt: data.collectedAt,
      sourceRoot: root, sourceId: 'artist-portal-scraper', sourceName: data.source ?? 'Artist Portal Scraper', sourceUrl,
      versionLabel: details.version?.name ?? 'Imported version', instrumentId: instrument ?? details.instrument?.slug ?? 'unknown',
      tuningId: instrument === 'guitar' && details.tuning === 'E A D G B E' ? 'guitar-standard' : undefined,
      tuning: details.tuning, scraperMetadata: data,
    });
    paired.add(txtPath);
  }
  if (!charts.length) throw new Error('Archive contains neither a Source Catalog nor scraper .txt + .source.json pairs.');
  const unpaired = [...files.keys()].filter((path) => path.endsWith('.txt') && !paired.has(path));
  const warnings = unpaired.length ? [`${unpaired.length} TXT file(s) without .source.json were ignored.`] : [];
  return { root, sourceId: 'artist-portal-scraper', name: `Artist Portal Scraper (${new Set(charts.map((chart) => chart.artist.slug)).size} artists)`, importedAt: new Date().toISOString(), charts, warnings };
}

/** Downloads and converts a complete source before publishing any records locally. */
export async function importSource(value, fetchFn = fetch, credentials = {}) {
  const root = sourceRoot(value);
  const url = new URL(root);
  const encrypted = /\.tar\.zst\.enc$/i.test(url.pathname);
  if (encrypted && (!credentials.certificate || !credentials.passphrase)) throw new Error('A local private certificate and its passphrase are required for this encrypted archive.');
  let downloadUrl = root;
  let response;
  if (url.pathname.endsWith('/') && !url.search) {
    try { return await importCatalogue(root, fetchFn); } catch (error) {
      // Only a missing manifest allows detection of an extensionless archive endpoint.
      if (!String(error.message).startsWith(`HTTP 404 at ${root}source-manifest.json`)) throw error;
    }
    response = await fetchFn(root, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (response.status === 404 && url.pathname !== '/') {
      await response.body?.cancel();
      downloadUrl = root.slice(0, -1);
      response = undefined;
    }
  }
  let bytes = await readBytes(downloadUrl, fetchFn, MAX_ARCHIVE_BYTES + (encrypted ? 1024 : 0), response);
  if (encrypted) bytes = await decryptArchive(bytes, credentials.certificate, credentials.passphrase);
  let files;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) files = await readZip(bytes);
  else if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) files = await readTarZstd(bytes);
  else throw new Error('Source URL did not return a ZIP or TAR.ZST archive.');
  const manifests = [...files.keys()].filter((path) => path.split('/').at(-1) === 'source-manifest.json');
  if (manifests.length > 1) throw new Error('Archive contains multiple Source Catalog manifests.');
  if (manifests.length) return importCatalogue(root, fetchFn, files, manifests[0].slice(0, -'source-manifest.json'.length));
  return importScraper(root, files);
}

export async function updateSources(value, store, fetchFn = fetch, credentials = {}) {
  const results = [];
  for (const source of sourceLines(value)) {
    try {
      if (source.error) throw new Error(source.error);
      const authenticatedFetch = source.token ? (url, options = {}) => {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${source.token}`);
        return fetchFn(url, { ...options, headers });
      } : fetchFn;
      const snapshot = await importSource(source.root, authenticatedFetch, credentials);
      await store.put(snapshot);
      results.push({ root: source.root, count: snapshot.charts.length, ...(snapshot.warnings?.length ? { warnings: snapshot.warnings } : {}) });
    } catch (error) { results.push({ root: source.root, error: error.message }); }
  }
  return results;
}
