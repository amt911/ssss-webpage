import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { crc32 } from './crc32';
import { IntegrityError, ValidationError } from './errors';
import { HEADER_SIZE, PAYLOAD_VERSION, decodePayload, encodePayload } from './payload';

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('encodePayload', () => {
  it('prefixes the version byte and the CRC32 in big-endian order', () => {
    const secret = ascii('hi');
    const payload = encodePayload(secret);
    const checksum = crc32(secret);

    expect(HEADER_SIZE).toBe(5);
    expect(payload.length).toBe(HEADER_SIZE + secret.length);
    expect(payload[0]).toBe(PAYLOAD_VERSION);
    expect(payload[1]).toBe((checksum >>> 24) & 0xff);
    expect(payload[2]).toBe((checksum >>> 16) & 0xff);
    expect(payload[3]).toBe((checksum >>> 8) & 0xff);
    expect(payload[4]).toBe(checksum & 0xff);
    expect(payload.subarray(HEADER_SIZE)).toEqual(secret);
  });

  it('refuses an empty secret', () => {
    expect(() => encodePayload(new Uint8Array(0))).toThrow(ValidationError);
    expect(() => encodePayload(new Uint8Array(0))).toThrow('Enter a secret to split.');
  });
});

describe('decodePayload', () => {
  it('round-trips any non-empty secret', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 2000 }), (secret) => {
        expect(decodePayload(encodePayload(secret))).toEqual(secret);
      }),
    );
  });

  it('rejects a payload too short to hold a header and a byte of secret', () => {
    for (let length = 0; length <= HEADER_SIZE; length += 1) {
      const short = new Uint8Array(length);
      expect(() => decodePayload(short)).toThrow(IntegrityError);
    }
  });

  it('rejects a header with no body, which would otherwise checksum as an empty secret', () => {
    // crc32 of an empty body is 0x00000000, so this five-byte payload passes both
    // the version check and the checksum check. Only the length guard stops it
    // from being reported as a successfully recovered empty secret.
    const headerOnly = Uint8Array.from([PAYLOAD_VERSION, 0x00, 0x00, 0x00, 0x00]);
    expect(crc32(new Uint8Array(0))).toBe(0);

    try {
      const recovered = decodePayload(headerOnly);
      expect.unreachable(`decodePayload returned ${recovered.length} bytes instead of throwing`);
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      expect((error as IntegrityError).reason).toBe('version');
    }
  });

  it('rejects an unknown version byte', () => {
    const payload = encodePayload(ascii('hi'));
    payload[0] = PAYLOAD_VERSION + 1;
    try {
      decodePayload(payload);
      expect.unreachable('decodePayload should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      expect((error as IntegrityError).reason).toBe('version');
    }
  });

  it('rejects a checksum that does not match the body', () => {
    const payload = encodePayload(ascii('hi'));
    payload[HEADER_SIZE] = payload[HEADER_SIZE]! ^ 0xff;
    try {
      decodePayload(payload);
      expect.unreachable('decodePayload should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrityError);
      expect((error as IntegrityError).reason).toBe('checksum');
    }
  });

  it('reports both failure modes with the same user-facing message', () => {
    const badVersion = encodePayload(ascii('hi'));
    badVersion[0] = 0x7f;
    const badChecksum = encodePayload(ascii('hi'));
    badChecksum[1] = badChecksum[1]! ^ 0xff;

    const messages = [badVersion, badChecksum].map((payload) => {
      try {
        decodePayload(payload);
        return 'did not throw';
      } catch (error) {
        return (error as Error).message;
      }
    });

    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe(
      'Could not recover a valid secret. Check that you pasted enough distinct, ' +
        'uncorrupted shares from the same split.',
    );
  });

  it('rejects a change to any single byte of the payload', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 200 }),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (secret, rawIndex, delta) => {
          const payload = encodePayload(secret);
          const index = rawIndex % payload.length;
          payload[index] = ((payload[index] ?? 0) + delta) % 256;
          expect(() => decodePayload(payload)).toThrow(IntegrityError);
        },
      ),
    );
  });

  it('rejects a truncated payload', () => {
    const payload = encodePayload(ascii('a longer secret than strictly necessary'));
    expect(() => decodePayload(payload.subarray(0, payload.length - 1))).toThrow(IntegrityError);
  });
});
