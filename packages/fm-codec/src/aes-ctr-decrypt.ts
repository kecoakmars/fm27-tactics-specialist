export const ENCRYPTED_AFE_HEADER = [
  0x02, 0x01, 0x61, 0x66, 0x65, 0x2e, 0x08, 0x00, 0x00,
] as const;

const PLAIN_FMF_MAGIC = [
  0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e, 0x08, 0x00, 0x00,
] as const;

const INLINE_CRYPTO_HEADER_BYTES = 40;

export function isEncryptedAfeArchive(data: Uint8Array): boolean {
  if (data.byteLength < ENCRYPTED_AFE_HEADER.length + 17) {
    return false;
  }
  for (let i = 0; i < ENCRYPTED_AFE_HEADER.length; i++) {
    if (data[i] !== ENCRYPTED_AFE_HEADER[i]) return false;
  }
  return true;
}

/**
 * Detects native FM27 per-member `afe.` archives where the outer TOC structure is plain
 * (`firstMemberRelOffset === 17` + trailing `fmf.` TOC header) and each packed member
 * carries its own `[int32(16), int32(16), key(16), iv(16), ciphertext]` envelope.
 */
export function isPerMemberEncryptedAfeArchive(data: Uint8Array): boolean {
  if (!isEncryptedAfeArchive(data) || data.byteLength < 35) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tocRel = Number(view.getBigInt64(9, true));
  const firstRel = Number(view.getBigInt64(17, true));
  if (firstRel !== 17 || tocRel < 17) return false;
  const secondHdr = 9 + tocRel;
  if (secondHdr + PLAIN_FMF_MAGIC.length > data.byteLength) return false;
  for (let i = 0; i < PLAIN_FMF_MAGIC.length; i++) {
    if (data[secondHdr + i] !== PLAIN_FMF_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Decrypts a single member slice inside a native FM27 per-member `afe.` archive:
 * `[keyLen:int32=16][ivLen:int32=16][key:16][iv:16][AES-128-CTR Zstd frame]`.
 */
export async function decryptAfeMemberSlice(memberBytes: Uint8Array): Promise<Uint8Array> {
  if (memberBytes.byteLength < INLINE_CRYPTO_HEADER_BYTES) {
    throw new Error(`Encrypted afe. member slice too short (${memberBytes.byteLength} bytes)`);
  }
  const view = new DataView(
    memberBytes.buffer,
    memberBytes.byteOffset,
    memberBytes.byteLength,
  );
  const keyLen = view.getInt32(0, true);
  const ivLen = view.getInt32(4, true);
  if (keyLen !== 16 || ivLen !== 16) {
    throw new Error(`Unexpected afe. member key/iv lengths (${keyLen}, ${ivLen})`);
  }
  const keyBytes = memberBytes.slice(8, 24);
  const ivBytes = memberBytes.slice(24, 40);
  const ciphertext = memberBytes.slice(40);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    false,
    ["decrypt"],
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-CTR", counter: ivBytes, length: 128 },
    cryptoKey,
    ciphertext,
  );
  return new Uint8Array(decrypted);
}

/**
 * Decrypts a whole-stream `afe.` container (`\x02\x01afe.\x08\x00\x00` + 40-byte inline header)
 * using Web Crypto AES-128-CTR (`key` at [4..19], `iv` at [20..35]).
 */
export async function decryptAesCtrFmf(encryptedData: Uint8Array): Promise<Uint8Array> {
  if (!isEncryptedAfeArchive(encryptedData)) {
    throw new Error("Input buffer does not start with encrypted afe. header");
  }
  if (encryptedData.byteLength < ENCRYPTED_AFE_HEADER.length + INLINE_CRYPTO_HEADER_BYTES) {
    throw new Error("Encrypted afe. buffer too short for inline crypto header");
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
