import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { importSource } from '../packages/addon-chord-catalog/src/source-import.js';

const archive = resolve(process.argv[2] ?? '../artist-portal-scraper/downloads.tar.zst');
const directory = await mkdtemp(join(tmpdir(), 'verify-chord-archive-'));
const server = createServer((request, response) => {
  if (request.url !== '/downloads.tar.zst') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'application/zstd', 'Access-Control-Allow-Origin': '*' });
  createReadStream(archive).pipe(response);
});
try {
  await stat(archive);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const start = performance.now();
  const snapshot = await importSource(`http://127.0.0.1:${server.address().port}/downloads.tar.zst`);
  // GNU tar is an independent reference for the browser decoder and conversion.
  await promisify(execFile)('tar', ['-I', 'zstd', '-xf', archive, '-C', directory]);
  const charts = new Map(snapshot.charts.map((chart) => [chart.sourceUrl, chart]));
  let verified = 0;
  async function check(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await check(path);
      else if (entry.name.endsWith('.source.json')) {
        const metadata = JSON.parse(await readFile(path, 'utf8'));
        const text = await readFile(path.slice(0, -'.source.json'.length) + '.txt');
        const chart = charts.get(metadata.sourceUrl);
        assert.ok(chart, `Missing chart: ${path}`);
        assert.equal(chart.text, text.toString('utf8'), `Text differs: ${path}`);
        assert.equal(chart.checksum, createHash('sha256').update(text).digest('hex'));
        assert.deepEqual(chart.scraperMetadata, metadata, `Metadata differs: ${path}`);
        verified++;
      }
    }
  }
  await check(directory);
  assert.equal(snapshot.charts.length, verified);
  console.log(JSON.stringify({ archive, charts: verified, artists: new Set(snapshot.charts.map((chart) => chart.artist.slug)).size, warnings: snapshot.warnings, seconds: Math.round((performance.now() - start) / 100) / 10 }, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
