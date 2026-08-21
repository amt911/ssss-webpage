import { combine, split } from 'shamir-secret-sharing';

import { DuplicateShareError, ShareFormatError, ValidationError, explainError } from './errors';
import { decodePayload, encodePayload } from './payload';
import { parseShareInput, shareToString, stringToShare } from './shareCodec';
import { validateSplitParams } from './validate';

/**
 * The whole pipeline, and the only module that touches the crypto library.
 *
 * Text in, share strings out; share strings in, text out. Everything either
 * returns the original secret or throws — it never returns something that merely
 * looks like a secret.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** "1", "1 and 3", "1, 2 and 3" */
function formatLineList(lines: readonly number[]): string {
  if (lines.length === 1) {
    return String(lines[0]);
  }
  return `${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1]}`;
}

export async function splitSecret(
  secretText: string,
  shares: number,
  threshold: number,
): Promise<string[]> {
  // Deliberately not trimmed: whitespace can be part of a secret.
  if (secretText.length === 0) {
    throw new ValidationError('Enter a secret to split.');
  }
  validateSplitParams(shares, threshold);

  const payload = encodePayload(encoder.encode(secretText));
  const parts = await split(payload, shares, threshold);
  return parts.map(shareToString);
}

export async function combineShares(pastedText: string): Promise<string> {
  const entries = parseShareInput(pastedText);

  const decoded: { bytes: Uint8Array; line: number }[] = [];
  const badLines: number[] = [];
  let firstReason = '';

  for (const entry of entries) {
    try {
      decoded.push({ bytes: stringToShare(entry.value), line: entry.line });
    } catch (error) {
      badLines.push(entry.line);
      if (firstReason === '') {
        firstReason = explainError(error);
      }
    }
  }

  if (badLines.length > 0) {
    const single = badLines.length === 1;
    throw new ShareFormatError(
      `${single ? 'Line' : 'Lines'} ${formatLineList(badLines)} ` +
        `${single ? 'is not a valid share' : 'are not valid shares'}: ${firstReason}`,
      badLines,
    );
  }

  if (decoded.length < 2) {
    throw new ValidationError('Paste at least 2 shares, one per line.');
  }

  // Catch exact repeats ourselves so the message names the lines. The library
  // only reports a duplicate index, which also fires for shares of different
  // splits and reads as a puzzle rather than a fix.
  const seenAt = new Map<string, number>();
  for (const item of decoded) {
    const key = shareToString(item.bytes);
    const previousLine = seenAt.get(key);
    if (previousLine !== undefined) {
      throw new DuplicateShareError(
        `The same share appears more than once (lines ${previousLine} and ${item.line}). ` +
          'Each share must be different.',
      );
    }
    seenAt.set(key, item.line);
  }

  const payload = await combine(decoded.map((item) => item.bytes));
  return decoder.decode(decodePayload(payload));
}
