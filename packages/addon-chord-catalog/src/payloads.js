import { createHash } from 'node:crypto';
import { toContentJson as contentJson } from './payloads-core.js';
export * from './payloads-core.js';

export function checksumOf(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function toContentJson(chart, options) {
  return contentJson(chart, { ...options, checksum: checksumOf(chart.text) });
}
