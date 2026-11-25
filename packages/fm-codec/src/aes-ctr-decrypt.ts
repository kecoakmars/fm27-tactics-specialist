export const ENCRYPTED_AFE_HEADER = [
  0x02, 0x01, 0x61, 0x66, 0x65, 0x2e, 0x08, 0x00, 0x00,
] as const;

const INLINE_CRYPTO_HEADER_BYTES = 40;

export function isEncryptedAfeArchive(data: Uint8Array): boolean {
  if (data.byteLength < ENCRYPTED_AFE_HEADER.length + INLINE_CRYPTO_HEADER_BYTES) {
    return false;
  }
  for (let i = 0; i < ENCRYPTED_AFE_HEADER.length; i++) {
    if (data[i] !== ENCRYPTED_AFE_HEADER[i]) return false;
  }
  return true;
}

/**
 * Decrypts an FM27 encrypted `.fmf` container (`\x02\x01afe.\x08\x00\x00` + 40-byte inline header)
 * using Web Crypto AES-128-CTR (`key` at [4..19], `iv` at [20..35]).
 */
export async function decryptAesCtrFmf(encryptedData: Uint8Array): Promise<Uint8Array> {
  if (!isEncryptedAfeArchive(encryptedData)) {
    throw new Error("Input buffer does not start with encrypted afe. header");
  }

  const headerStart = ENCRYPTED_AFE_HEADER.length;
  const inlineHeader = encryptedData.subarray(
    headerStart,
    headerStart + INLINE_CRYPTO_HEADER_BYTES,
  );
  const keyBytes = inlineHeader.slice(4, 20);
  const ivBytes = inlineHeader.slice(20, 36);
  const ciphertext = encryptedData.slice(headerStart + INLINE_CRYPTO_HEADER_BYTES);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    false,
    ["decrypt"],
  );

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-CTR",
      counter: ivBytes,
      length: 128,
    },
    cryptoKey,
    ciphertext,
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Encrypts a plain `.fmf` archive into an `afe.` AES-128-CTR container (used for round-trip tests).
 */
export async function encryptAesCtrFmf(
  plainFmf: Uint8Array,
  options?: { key?: Uint8Array; iv?: Uint8Array },
): Promise<Uint8Array> {
  const keyBytes =
    options?.key && options.key.byteLength === 16
      ? options.key.slice()
      : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes =
    options?.iv && options.iv.byteLength === 16
      ? options.iv.slice()
      : globalThis.crypto.getRandomValues(new Uint8Array(16));

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    false,
    ["encrypt"],
  );

  const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-CTR",
      counter: ivBytes,
      length: 128,
    },
    cryptoKey,
    plainFmf.slice(),
  );
  const ciphertext = new Uint8Array(ciphertextBuf);

  const out = new Uint8Array(
    ENCRYPTED_AFE_HEADER.length + INLINE_CRYPTO_HEADER_BYTES + ciphertext.byteLength,
  );
  out.set(ENCRYPTED_AFE_HEADER, 0);

  const headerOffset = ENCRYPTED_AFE_HEADER.length;
  out[headerOffset] = 0x01; // crypto version flag
  out.set(keyBytes, headerOffset + 4);
  out.set(ivBytes, headerOffset + 20);
  out.set(ciphertext, headerOffset + INLINE_CRYPTO_HEADER_BYTES);

  return out;
}
