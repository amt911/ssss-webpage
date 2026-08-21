import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { crc32 } from './crc32';

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('crc32', () => {
  it('matches the canonical CRC-32/ISO-HDLC check vector', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
  });

  it('matches other well-known vectors', () => {
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
    expect(crc32(ascii('a'))).toBe(0xe8b7be43);
    expect(crc32(ascii('abc'))).toBe(0x352441c2);
    expect(crc32(ascii('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('treats bytes as unsigned', () => {
    expect(crc32(new Uint8Array([0xff]))).toBe(0xff000000);
    expect(crc32(new Uint8Array([0x00]))).toBe(0xd202ef8d);
  });

  it('always returns an unsigned 32-bit integer', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
        const value = crc32(bytes);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffffff);
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
        expect(crc32(bytes)).toBe(crc32(Uint8Array.from(bytes)));
      }),
    );
  });

  it('changes when any single byte changes', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (bytes, rawIndex, delta) => {
          const index = rawIndex % bytes.length;
          const mutated = Uint8Array.from(bytes);
          mutated[index] = ((mutated[index] ?? 0) + delta) % 256;
          expect(crc32(mutated)).not.toBe(crc32(bytes));
        },
      ),
    );
  });
});
