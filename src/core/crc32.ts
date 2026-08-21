/**
 * CRC-32/ISO-HDLC (the "zip" CRC): reflected input and output, polynomial
 * 0xEDB88320, initial and final XOR of 0xFFFFFFFF.
 *
 * This is an error-detecting code, not a cryptographic hash. It exists so that a
 * combine done with too few or corrupted shares fails loudly instead of handing
 * back plausible-looking garbage. SHA-256 is not an option here: `crypto.subtle`
 * is undefined over file://, which is exactly how this page is meant to be used.
 */

const POLYNOMIAL = 0xedb88320;

const TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (value >>> 1) ^ POLYNOMIAL : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

/** Returns the CRC-32 of `bytes` as an unsigned 32-bit integer. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    // The index is masked into 0..255, so the table lookup is always defined.
    crc = (crc >>> 8) ^ TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
