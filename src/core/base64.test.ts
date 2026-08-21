import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { base64ToBytes, bytesToBase64 } from './base64';
import { ShareFormatError } from './errors';

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('bytesToBase64', () => {
  it('matches the RFC 4648 test vectors', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(bytesToBase64(ascii('f'))).toBe('Zg==');
    expect(bytesToBase64(ascii('fo'))).toBe('Zm8=');
    expect(bytesToBase64(ascii('foo'))).toBe('Zm9v');
    expect(bytesToBase64(ascii('foob'))).toBe('Zm9vYg==');
    expect(bytesToBase64(ascii('fooba'))).toBe('Zm9vYmE=');
    expect(bytesToBase64(ascii('foobar'))).toBe('Zm9vYmFy');
  });

  it('encodes high bytes without mangling them', () => {
    expect(bytesToBase64(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe('//79');
    expect(bytesToBase64(new Uint8Array([0x00, 0x80, 0xff]))).toBe('AID/');
  });

  it('handles inputs far larger than one conversion chunk', () => {
    const big = new Uint8Array(20000).map((_, index) => index % 256);
    expect(() => bytesToBase64(big)).not.toThrow();
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});

describe('base64ToBytes', () => {
  it('decodes the RFC 4648 test vectors', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
    expect(base64ToBytes('Zg==')).toEqual(ascii('f'));
    expect(base64ToBytes('Zm9vYmFy')).toEqual(ascii('foobar'));
  });

  it('rejects a length that is not a multiple of four, and says why', () => {
    expect(() => base64ToBytes('Zm9')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('Zm9')).toThrow('This is not valid Base64 data.');
    expect(() => base64ToBytes('Zg=')).toThrow(ShareFormatError);
  });

  it('rejects characters outside the standard alphabet', () => {
    expect(() => base64ToBytes('Zm9-')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('Zm9_')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('Zm 9')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('Zm9\n')).toThrow(ShareFormatError);
  });

  it('rejects misplaced or excessive padding', () => {
    expect(() => base64ToBytes('A===')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('====')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('=Zm9')).toThrow(ShareFormatError);
    expect(() => base64ToBytes('Zm=9')).toThrow(ShareFormatError);
  });
});

describe('base64 round-trip', () => {
  it('round-trips arbitrary byte arrays, including sizes past the chunk boundary', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 20000 }), (bytes) => {
        expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
      }),
      { numRuns: 60 },
    );
  });

  it('always produces a canonically padded string', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        const encoded = bytesToBase64(bytes);
        expect(encoded.length % 4).toBe(0);
        expect(encoded).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
      }),
    );
  });
});
