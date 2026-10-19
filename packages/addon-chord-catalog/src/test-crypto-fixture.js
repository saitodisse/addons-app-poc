const encoder = new TextEncoder();
const ITERATIONS = 600_000;

function base64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function derive(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
}

export async function encryptedTestArchive(plaintext, passphrase) {
  const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const keyDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
  const keyId = [...keyDigest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const certificateIv = crypto.getRandomValues(new Uint8Array(12));
  const certificateKey = await derive(passphrase, salt);
  const aad = encoder.encode(`chord-catalog-certificate:v1:${keyId}`);
  const encryptedPrivateKey = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: certificateIv, additionalData: aad }, certificateKey, pkcs8));
  const certificate = JSON.stringify({
    format: 'chord-catalog-certificate', version: 1, keyId, publicKey: base64(spki),
    encryptedPrivateKey: { algorithm: 'PBKDF2-SHA256+A256GCM', iterations: ITERATIONS, salt: base64(salt), iv: base64(certificateIv), ciphertext: base64(encryptedPrivateKey) },
  });

  const contentKey = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pair.publicKey, contentKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new Uint8Array(51 + wrapped.length);
  header.set(encoder.encode('CCAE'), 0);
  header[4] = 1;
  header.set(keyDigest, 5);
  header.set(iv, 37);
  new DataView(header.buffer).setUint16(49, wrapped.length, false);
  header.set(wrapped, 51);
  const dataKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, dataKey, plaintext));
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header);
  bytes.set(body, header.length);
  return { bytes, certificate };
}
