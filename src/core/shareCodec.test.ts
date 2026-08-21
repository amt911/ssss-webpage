import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ShareFormatError } from './errors';
import { SHARE_PREFIX, parseShareInput, shareToString, stringToShare } from './shareCodec';

const MIN_SHARE_BYTES = 7;

describe('shareToString', () => {
  it('prefixes the versioned marker and encodes the bytes as Base64', () => {
    const share = Uint8Array.from([1, 2, 3, 4, 5, 6, 7]);
    expect(SHARE_PREFIX).toBe('sss1-');
    expect(shareToString(share)).toBe('sss1-AQIDBAUGBw==');
  });

  it('produces strings matching the documented share shape', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: MIN_SHARE_BYTES, maxLength: 200 }), (share) => {
        expect(shareToString(share)).toMatch(/^sss1-[A-Za-z0-9+/]+={0,2}$/);
      }),
    );
  });
});

describe('stringToShare', () => {
  it('round-trips whatever shareToString produced', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: MIN_SHARE_BYTES, maxLength: 300 }), (share) => {
        expect(stringToShare(shareToString(share))).toEqual(share);
      }),
    );
  });

  it('tolerates surrounding whitespace', () => {
    const share = Uint8Array.from([9, 8, 7, 6, 5, 4, 3]);
    const text = shareToString(share);
    expect(stringToShare(`  ${text}\t`)).toEqual(share);
  });

  it('tolerates whitespace inserted by line-wrapping mail clients', () => {
    const share = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const text = shareToString(share);
    const wrapped = `${text.slice(0, 9)}\n   ${text.slice(9, 14)} ${text.slice(14)}`;
    expect(stringToShare(wrapped)).toEqual(share);
  });

  it('requires the exact prefix, and says so', () => {
    const body = shareToString(Uint8Array.from([1, 2, 3, 4, 5, 6, 7])).slice(SHARE_PREFIX.length);
    for (const input of [body, `SSS1-${body}`, `sss2-${body}`, `xsss1-${body}`, '']) {
      expect(() => stringToShare(input)).toThrow(ShareFormatError);
      expect(() => stringToShare(input)).toThrow('A share must start with "sss1-".');
    }
  });

  it('rejects a payload that is not Base64', () => {
    expect(() => stringToShare('sss1-not base64!!')).toThrow('This is not valid Base64 data.');
    expect(() => stringToShare('sss1-')).toThrow(ShareFormatError);
  });

  it('rejects a share too short to carry a header, a byte of secret and an index', () => {
    // Six bytes: one short of the minimum.
    expect(() => stringToShare('sss1-AQIDBAUG')).toThrow(ShareFormatError);
    expect(() => stringToShare('sss1-AQIDBAUG')).toThrow(
      'This share is too short to be a valid share.',
    );
    expect(() => stringToShare('sss1-AQIDBAUGBw==')).not.toThrow();
  });
});

describe('parseShareInput', () => {
  it('splits on lines, trims them and drops the empty ones', () => {
    const input = '  sss1-aaaa\n\n\tsss1-bbbb  \r\n   \r\nsss1-cccc';
    expect(parseShareInput(input)).toEqual([
      { value: 'sss1-aaaa', line: 1 },
      { value: 'sss1-bbbb', line: 3 },
      { value: 'sss1-cccc', line: 5 },
    ]);
  });

  it('numbers lines from the original text, so blank lines still count', () => {
    expect(parseShareInput('\n\n\nsss1-zzzz')).toEqual([{ value: 'sss1-zzzz', line: 4 }]);
  });

  it('returns nothing for blank input', () => {
    expect(parseShareInput('')).toEqual([]);
    expect(parseShareInput('   \n\t\r\n  ')).toEqual([]);
  });

  it('keeps every non-blank line, whatever whitespace surrounds it', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[A-Za-z0-9+/=-]+$/), { minLength: 1, maxLength: 10 }),
        fc.constantFrom('\n', '\r\n'),
        (lines, separator) => {
          const padded = lines.map((line) => `  ${line} `).join(separator);
          expect(parseShareInput(padded)).toEqual(
            lines.map((value, index) => ({ value, line: index + 1 })),
          );
        },
      ),
    );
  });
});
