import { crc32 } from './crc32';
import { IntegrityError, ValidationError } from './errors';

/**
 * The secret is wrapped in a tiny header before it is split, and the header is
 * checked after it is recombined.
 *
 * Why: `combine()` cannot tell that it was given fewer shares than the threshold —
 * the threshold is not encoded in the shares — so it happily returns plausible
 * bytes that are not the secret. Cure53's audit of the library recommends an
 * application-level integrity tag for exactly this. Ours is:
 *
 *     [ version 0x01 ][ CRC32 of the secret, big-endian, 4 bytes ][ secret ]
 *
 * Below the threshold the recovered header is effectively random, so the chance
 * of it passing both checks is about 2^-40.
 *
 * This detects accidents — too few shares, a mistyped share, a share from another
 * split. It is NOT tamper-proofing: anyone who can alter a share can recompute
 * the CRC. Say so in the UI, do not oversell it.
 */

export const PAYLOAD_VERSION = 0x01;

/** One version byte plus a four-byte checksum. */
export const HEADER_SIZE = 5;

const INTEGRITY_MESSAGE =
  'Could not recover a valid secret. Check that you pasted enough distinct, ' +
  'uncorrupted shares from the same split.';

export function encodePayload(secret: Uint8Array): Uint8Array {
  if (secret.length === 0) {
    throw new ValidationError('Enter a secret to split.');
  }

  const checksum = crc32(secret);
  const payload = new Uint8Array(HEADER_SIZE + secret.length);
  payload[0] = PAYLOAD_VERSION;
  payload[1] = (checksum >>> 24) & 0xff;
  payload[2] = (checksum >>> 16) & 0xff;
  payload[3] = (checksum >>> 8) & 0xff;
  payload[4] = checksum & 0xff;
  payload.set(secret, HEADER_SIZE);
  return payload;
}

export function decodePayload(payload: Uint8Array): Uint8Array {
  if (payload.length <= HEADER_SIZE) {
    throw new IntegrityError(INTEGRITY_MESSAGE, 'version');
  }
  if (payload[0] !== PAYLOAD_VERSION) {
    throw new IntegrityError(INTEGRITY_MESSAGE, 'version');
  }

  const expected =
    ((payload[1]! << 24) | (payload[2]! << 16) | (payload[3]! << 8) | payload[4]!) >>> 0;
  const secret = payload.slice(HEADER_SIZE);

  if (crc32(secret) !== expected) {
    throw new IntegrityError(INTEGRITY_MESSAGE, 'checksum');
  }
  return secret;
}
