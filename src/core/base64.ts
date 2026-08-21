import { ShareFormatError } from './errors';

/**
 * Standard Base64 (RFC 4648) between `Uint8Array` and `string`, using the
 * `btoa`/`atob` globals so the bundle stays dependency-free.
 */

/**
 * Spreading a whole array into `String.fromCharCode` blows the argument limit on
 * large inputs, so the conversion walks the array in chunks.
 */
const CHUNK_SIZE = 0x2000;

/** Standard alphabet, padding only at the very end. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToBytes(input: string): Uint8Array {
  if (input.length % 4 !== 0 || !BASE64_PATTERN.test(input)) {
    throw new ShareFormatError('This is not valid Base64 data.');
  }

  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
