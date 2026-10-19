import { Unzip, UnzipInflate, unzipSync } from 'fflate';

export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_ENTRY_BYTES = 32 * 1024 * 1024;

/** Checks the directory before inflating, then checks actual output as it arrives. */
export async function readZip(bytes) {
  const directory = new Map();
  let declaredTotal = 0;
  unzipSync(bytes, { filter(file) {
    const path = file.name;
    if (!path || /[\\\x00-\x1f]/.test(path) || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || path.split('/').some((part) => part === '..' || part === '.')) throw new Error(`Unsafe ZIP path: ${path}`);
    if (directory.has(path)) throw new Error(`Duplicate ZIP entry: ${path}`);
    directory.set(path, file.originalSize);
    declaredTotal += file.originalSize;
    if (directory.size > 100000 || file.originalSize > MAX_ENTRY_BYTES || declaredTotal > MAX_EXPANDED_BYTES) throw new Error('ZIP exceeds the extraction limit.');
    return false;
  } });
  const files = new Map();
  const seen = new Set();
  let total = 0;
  let pending = 0;
  const unzip = new Unzip((file) => {
    if (!directory.has(file.name) || seen.has(file.name)) throw new Error('Inconsistent ZIP directory.');
    seen.add(file.name);
    if (file.name.endsWith('/') || !/\.(txt|json|ndjson)$/i.test(file.name) || file.name.startsWith('__MACOSX/')) return;
    pending++;
    const chunks = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length;
      total += chunk.length;
      if (size > MAX_ENTRY_BYTES || total > MAX_EXPANDED_BYTES || size > directory.get(file.name)) throw new Error('ZIP exceeds the extraction limit.');
      chunks.push(chunk);
      if (final) {
        if (size !== directory.get(file.name)) throw new Error(`Invalid ZIP entry size: ${file.name}`);
        const output = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) { output.set(part, offset); offset += part.length; }
        files.set(file.name, output);
        pending--;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    unzip.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length);
    // Allow rendering and cancellation between compressed chunks.
    if (offset % (1024 * 1024) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (pending || seen.size !== directory.size) throw new Error('Incomplete ZIP archive.');
  return files;
}
