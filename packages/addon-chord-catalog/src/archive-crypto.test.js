import { describe, expect, it } from 'vitest';
import { decryptArchive } from './archive-crypto.js';
import { encryptedTestArchive } from './test-crypto-fixture.js';

describe('encrypted archive reader', () => {
  it('opens only with the matching local certificate and passphrase', async () => {
    const plaintext = new TextEncoder().encode('archive payload');
    const fixture = await encryptedTestArchive(plaintext, 'a correct horse battery 2026');
    const result = await decryptArchive(fixture.bytes, fixture.certificate, 'a correct horse battery 2026');
    expect(new TextDecoder().decode(result)).toBe('archive payload');
    await expect(decryptArchive(fixture.bytes, fixture.certificate, 'wrong password')).rejects.toThrow(/certificate|passphrase|decrypt/i);
  });

  it('rejects a changed authenticated header and a different certificate', async () => {
    const fixture = await encryptedTestArchive(new TextEncoder().encode('protected'), 'a correct horse battery 2026');
    const changed = fixture.bytes.slice();
    changed[5] ^= 1;
    await expect(decryptArchive(changed, fixture.certificate, 'a correct horse battery 2026')).rejects.toThrow();
    const other = await encryptedTestArchive(new TextEncoder().encode('other'), 'another correct horse battery 2026');
    await expect(decryptArchive(fixture.bytes, other.certificate, 'another correct horse battery 2026')).rejects.toThrow(/certificate|key/i);
  });
});
