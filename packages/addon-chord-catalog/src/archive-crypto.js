import { MAX_ARCHIVE_BYTES } from './zip-source.js';

const CERTIFICATE_FORMAT = 'chord-catalog-certificate';
const CERTIFICATE_AAD_PREFIX = 'chord-catalog-certificate:v1:';
const ENVELOPE_MAGIC = [0x43, 0x43, 0x41, 0x45];
const ENVELOPE_HEADER_BYTES = 51;
const MIN_PBKDF2_ITERATIONS = 600_000;
const MAX_PBKDF2_ITERATIONS = 1_200_000;
const MAX_CERTIFICATE_BYTES = 64 * 1024;

function arrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function decodeBase64(value, label, expectedLength) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`Invalid certificate ${label}.`);
  }
  let decoded;
  try { decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
  catch { throw new Error(`Invalid certificate ${label}.`); }
  if (expectedLength !== undefined && decoded.length !== expectedLength) throw new Error(`Invalid certificate ${label}.`);
  return decoded;
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function parseCertificate(serialized, passphrase) {
  if (typeof serialized !== 'string' || !serialized || serialized.length > MAX_CERTIFICATE_BYTES) throw new Error('Select a valid local certificate file.');
  if (typeof passphrase !== 'string' || !passphrase) throw new Error('Enter the local certificate passphrase.');
  let certificate;
  try { certificate = JSON.parse(serialized); }
  catch { throw new Error('The local certificate is not valid JSON.'); }
  const protectedKey = certificate?.encryptedPrivateKey;
  if (certificate?.format !== CERTIFICATE_FORMAT || certificate.version !== 1 || !/^[a-f\d]{64}$/i.test(certificate.keyId ?? '')
    || protectedKey?.algorithm !== 'PBKDF2-SHA256+A256GCM'
    || !Number.isSafeInteger(protectedKey.iterations) || protectedKey.iterations < MIN_PBKDF2_ITERATIONS || protectedKey.iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error('Unsupported local certificate format.');
  }
  const spki = decodeBase64(certificate.publicKey, 'public key');
  const keyId = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', spki)));
  if (keyId !== certificate.keyId.toLowerCase()) throw new Error('The certificate public key fingerprint is invalid.');
  const salt = decodeBase64(protectedKey.salt, 'salt', 16);
  const certificateIv = decodeBase64(protectedKey.iv, 'private-key IV', 12);
  const protectedPrivateKey = decodeBase64(protectedKey.ciphertext, 'encrypted private key');
  if (protectedPrivateKey.length < 16) throw new Error('Invalid certificate encrypted private key.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const wrappingKey = await crypto.subtle.deriveKey({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations: protectedKey.iterations,
  }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const aad = new TextEncoder().encode(`${CERTIFICATE_AAD_PREFIX}${keyId}`);
  let pkcs8;
  try {
    pkcs8 = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: certificateIv, additionalData: aad, tagLength: 128 }, wrappingKey, protectedPrivateKey));
  } catch {
    throw new Error('The certificate passphrase is incorrect or the certificate is damaged.');
  }
  try {
    const privateKey = await crypto.subtle.importKey('pkcs8', arrayBuffer(pkcs8), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const modulusLength = privateKey.algorithm.modulusLength;
    if (!Number.isInteger(modulusLength) || modulusLength < 2048 || modulusLength > 4096) throw new Error('Unsupported certificate key size.');
    return { privateKey, keyId, modulusLength };
  } finally { pkcs8.fill(0); }
}

/** Decrypts the CCAE envelope entirely in the browser. The private key never leaves this page. */
export async function decryptArchive(input, certificateText, passphrase) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < ENVELOPE_HEADER_BYTES + 16) throw new Error('Encrypted archive is truncated.');
  if (!ENVELOPE_MAGIC.every((value, index) => bytes[index] === value) || bytes[4] !== 1) throw new Error('Unsupported encrypted archive format.');
  const wrappedLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(49, false);
  const headerLength = ENVELOPE_HEADER_BYTES + wrappedLength;
  if (wrappedLength < 256 || wrappedLength > 512 || bytes.length < headerLength + 16) throw new Error('Encrypted archive header is invalid.');
  if (bytes.length > MAX_ARCHIVE_BYTES + 1024) throw new Error('Encrypted archive exceeds the import limit.');

  const { privateKey, keyId, modulusLength } = await parseCertificate(certificateText, passphrase);
  if (wrappedLength !== modulusLength / 8) throw new Error('The certificate does not match this encrypted archive.');
  const envelopeKeyId = hex(bytes.subarray(5, 37));
  if (envelopeKeyId !== keyId) throw new Error('The certificate does not match this encrypted archive.');
  const header = bytes.subarray(0, headerLength);
  const iv = bytes.subarray(37, 49);
  const wrappedKey = bytes.subarray(ENVELOPE_HEADER_BYTES, headerLength);
  const contentKeyBytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrappedKey));
  if (contentKeyBytes.length !== 32) throw new Error('Encrypted archive data key is invalid.');
  const contentKey = await crypto.subtle.importKey('raw', arrayBuffer(contentKeyBytes), 'AES-GCM', false, ['decrypt']);
  contentKeyBytes.fill(0);
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({
      name: 'AES-GCM', iv, additionalData: arrayBuffer(header), tagLength: 128,
    }, contentKey, arrayBuffer(bytes.subarray(headerLength))));
  } catch {
    throw new Error('Encrypted archive authentication failed; the file may have changed or be incomplete.');
  }
  if (plaintext.length > MAX_ARCHIVE_BYTES) throw new Error('Decrypted archive exceeds the import limit.');
  return plaintext;
}
