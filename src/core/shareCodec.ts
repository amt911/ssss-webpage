import { base64ToBytes, bytesToBase64 } from './base64';
import { ShareFormatError } from './errors';
import { HEADER_SIZE } from './payload';

/**
 * The textual form of a share: a versioned prefix followed by standard Base64.
 * The prefix makes a pasted share recognisable at a glance and gives the format
 * somewhere to grow if it ever changes.
 */
export const SHARE_PREFIX = 'sss1-';

/** Header, at least one byte of secret, and the library's trailing index byte. */
const MIN_SHARE_BYTES = HEADER_SIZE + 1 + 1;

export function shareToString(share: Uint8Array): string {
  return SHARE_PREFIX + bytesToBase64(share);
}

export function stringToShare(text: string): Uint8Array {
  const trimmed = text.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) {
    throw new ShareFormatError(`A share must start with "${SHARE_PREFIX}".`);
  }

  // Mail clients and chat apps wrap long lines; the payload is Base64, so any
  // whitespace inside it was added in transit and can be dropped.
  const body = trimmed.slice(SHARE_PREFIX.length).replace(/\s+/g, '');
  const share = base64ToBytes(body);

  if (share.length < MIN_SHARE_BYTES) {
    throw new ShareFormatError('This share is too short to be a valid share.');
  }
  return share;
}

/** A candidate share together with the 1-based line it was pasted on. */
export interface ParsedShareLine {
  readonly value: string;
  readonly line: number;
}

/**
 * Splits pasted text into candidate shares, one per non-blank line.
 *
 * The original line number travels with each entry so that an error can point at
 * the line the user is actually looking at, blank lines included.
 */
export function parseShareInput(text: string): ParsedShareLine[] {
  return text
    .split(/\r?\n/)
    .map((rawLine, index) => ({ value: rawLine.trim(), line: index + 1 }))
    .filter((entry) => entry.value.length > 0);
}
