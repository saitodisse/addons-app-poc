import { Decompress } from 'fzstd';

const decoder = new TextDecoder('utf-8', { fatal: true });
const text = (bytes) => decoder.decode(bytes).replace(/\0.*$/s, '');
const number = (bytes) => {
  const value = text(bytes).trim();
  if (!/^[0-7]*$/.test(value)) throw new Error('Unsupported TAR numeric field.');
  const result = parseInt(value || '0', 8);
  if (!Number.isSafeInteger(result)) throw new Error('Invalid TAR size.');
  return result;
};
const join = (chunks, size) => {
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
};

/** Reads headers and file bodies incrementally without retaining the expanded TAR. */
export async function readTarZstd(bytes) {
  const files = new Map();
  const seen = new Set();
  let header = new Uint8Array(512);
  let headerSize = 0;
  let entry;
  let padding = 0;
  let expanded = 0;
  let zeroBlocks = 0;
  let longName;
  let attributes = {};
  const finish = () => {
    if (entry.keep) {
      const body = join(entry.chunks, entry.size);
      if (entry.type === 'L') longName = text(body);
      else if (entry.type === 'x' || entry.type === 'g') {
        let offset = 0;
        const parsed = {};
        while (offset < body.length) {
          const space = body.indexOf(32, offset);
          const lengthText = decoder.decode(body.subarray(offset, space));
          const length = Number(lengthText);
          if (space < offset || !/^\d+$/.test(lengthText) || length <= space - offset + 1 || offset + length > body.length || body[offset + length - 1] !== 10) throw new Error('Invalid TAR extended header.');
          const record = decoder.decode(body.subarray(space + 1, offset + length - 1));
          const equals = record.indexOf('=');
          if (equals < 1) throw new Error('Invalid TAR extended attribute.');
          parsed[record.slice(0, equals)] = record.slice(equals + 1);
          offset += length;
        }
        if (entry.type === 'g') {
          if (parsed.path || parsed.size) throw new Error('Unsupported global TAR path or size.');
        } else attributes = parsed;
      } else files.set(entry.path, body);
    }
    padding = (512 - entry.size % 512) % 512;
    entry = undefined;
  };
  const stream = new Decompress((chunk) => {
    expanded += chunk.length;
    if (expanded > 512 * 1024 * 1024) throw new Error('TAR exceeds the extraction limit.');
    let offset = 0;
    while (offset < chunk.length) {
      if (entry) {
        const count = Math.min(entry.remaining, chunk.length - offset);
        if (entry.keep) entry.chunks.push(chunk.slice(offset, offset + count));
        entry.remaining -= count;
        offset += count;
        if (!entry.remaining) finish();
      } else if (padding) {
        const count = Math.min(padding, chunk.length - offset);
        padding -= count;
        offset += count;
      } else {
        const count = Math.min(512 - headerSize, chunk.length - offset);
        header.set(chunk.subarray(offset, offset + count), headerSize);
        offset += count;
        headerSize += count;
        if (headerSize < 512) continue;
        headerSize = 0;
        if (header.every((byte) => byte === 0)) { zeroBlocks++; continue; }
        if (zeroBlocks) throw new Error('Invalid data after TAR end marker.');
        const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
        if (checksum !== number(header.subarray(148, 156))) throw new Error('Invalid TAR header checksum.');
        const type = String.fromCharCode(header[156] || 48);
        const special = ['L', 'x', 'g'].includes(type);
        if (!special && !['0', '5'].includes(type)) throw new Error(`Unsupported TAR entry type: ${type}`);
        let path = text(header.subarray(0, 100));
        if (header[262] === 0) {
          const prefix = text(header.subarray(345, 500));
          if (prefix) path = `${prefix}/${path}`;
        }
        if (!special) path = attributes.path ?? longName ?? path;
        path = path.replace(/^(\.\/)+/, '');
        if (!path || /[\\\x00-\x1f]/.test(path) || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || path.split('/').some((part) => part === '..' || part === '.')) throw new Error(`Unsafe TAR path: ${path}`);
        let size = number(header.subarray(124, 136));
        if (!special && attributes.size !== undefined) {
          if (!/^\d+$/.test(attributes.size)) throw new Error('Invalid TAR extended size.');
          size = Number(attributes.size);
        }
        if (!Number.isSafeInteger(size) || size > 32 * 1024 * 1024) throw new Error('TAR exceeds the extraction limit.');
        if (!special) {
          if (seen.has(path)) throw new Error(`Duplicate TAR entry: ${path}`);
          seen.add(path);
          if (seen.size > 100000) throw new Error('TAR exceeds the extraction limit.');
          longName = undefined;
          attributes = {};
        }
        entry = { path, type, size, remaining: size, chunks: [], keep: special || (type === '0' && /\.(txt|json|ndjson)$/i.test(path)) };
        if (!size) finish();
      }
    }
  });
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    stream.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length);
    if (offset % (1024 * 1024) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (entry || padding || headerSize || zeroBlocks < 2 || longName || Object.keys(attributes).length) throw new Error('Incomplete TAR archive.');
  return files;
}
