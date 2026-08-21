/**
 * CRC-32/ISO-HDLC (the "zip" CRC): reflected input and output, polynomial
 * 0xEDB88320, initial and final XOR of 0xFFFFFFFF.
 *
 * This is an error-detecting code, not a cryptographic hash. It exists so that a
 * combine done with too few or corrupted shares fails loudly instead of handing
 * back plausible-looking garbage.
 *
 * Why not SHA-256? Not because `crypto.subtle` is missing — `file://` is a secure
 * context in both Chrome and Firefox, and it is available there. Two other
 * reasons:
 *
 * 1. It would not buy the property people assume. There is no key here, so no
 *    unkeyed digest can authenticate anything: an attacker who supplies a share
 *    can pick the plaintext you recover and compute its hash just as easily as
 *    its CRC. Detecting *accidents* is the job, and CRC32 does that at 2^-32.
 * 2. Using it would make the page depend on secure-context status — browser
 *    policy, not law — for something opened off a USB stick years from now.
 *
 * Do state the real weakness honestly: CRC32 is linear, so someone modifying a
 * share can flip a chosen bit of the plaintext and compensate the checksum
 * without knowing the secret. A hash would close that narrower case; nothing
 * short of a key closes the general one.
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
