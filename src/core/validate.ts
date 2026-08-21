import { ValidationError } from './errors';

/**
 * Parameter checks run before the library sees anything, so the user gets a
 * message about the field they got wrong rather than a translated library error.
 */

/** The library works over GF(2^8) with x=0 reserved, so both values live in 2..255. */
const MIN_PARTS = 2;
const MAX_PARTS = 255;

/** Above this, shares get unwieldy to copy or transcribe. A hint, never a block. */
export const SIZE_HINT_THRESHOLD_BYTES = 4096;

export function validateSplitParams(shares: number, threshold: number): void {
  if (!Number.isInteger(shares)) {
    throw new ValidationError('Number of shares must be a whole number.');
  }
  if (shares < MIN_PARTS || shares > MAX_PARTS) {
    throw new ValidationError(`Number of shares must be between ${MIN_PARTS} and ${MAX_PARTS}.`);
  }
  if (!Number.isInteger(threshold)) {
    throw new ValidationError('Threshold must be a whole number.');
  }
  if (threshold < MIN_PARTS || threshold > MAX_PARTS) {
    throw new ValidationError(`Threshold must be between ${MIN_PARTS} and ${MAX_PARTS}.`);
  }
  if (threshold > shares) {
    throw new ValidationError('Threshold cannot be greater than the number of shares.');
  }
}

/** A gentle note for large secrets, or null when there is nothing worth saying. */
export function secretSizeWarning(byteLength: number): string | null {
  if (byteLength < SIZE_HINT_THRESHOLD_BYTES) {
    return null;
  }
  const kilobytes = (byteLength / 1024).toFixed(1);
  return (
    `This secret is ${kilobytes} KB. Every share will be slightly larger than that, ` +
    'which makes them awkward to copy around or transcribe.'
  );
}
