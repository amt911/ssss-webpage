/**
 * Error types for the whole pipeline, plus the single place where any thrown
 * value is turned into a sentence a user can act on.
 */

/** Input the user can fix directly: an empty secret, a threshold above the share count. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** A pasted share is not a share at all. `lines` holds the 1-based offending lines. */
export class ShareFormatError extends Error {
  readonly lines: readonly number[];

  constructor(message: string, lines: readonly number[] = []) {
    super(message);
    this.name = 'ShareFormatError';
    this.lines = lines;
  }
}

/** The same share was supplied more than once. */
export class DuplicateShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateShareError';
  }
}

export type IntegrityFailureReason = 'version' | 'checksum';

/**
 * The bytes came back from `combine()` but they are not a secret we produced.
 *
 * `reason` is for tests and debugging only. It is deliberately kept out of the
 * user-facing message: below the threshold the recovered header is random, so a
 * bad version byte is the *common* failure, and telling a user their shares were
 * "made by a newer version" would be actively misleading.
 */
export class IntegrityError extends Error {
  readonly reason: IntegrityFailureReason;

  constructor(message: string, reason: IntegrityFailureReason) {
    super(message);
    this.name = 'IntegrityError';
    this.reason = reason;
  }
}

const GENERIC_MESSAGE = 'Unexpected error. Check your input and try again.';

/**
 * Messages thrown by shamir-secret-sharing@0.0.4, matched by substring so that a
 * wrapped or prefixed message still resolves. Bumping the library means
 * re-checking this table against its source.
 */
const LIBRARY_MESSAGES: ReadonlyArray<readonly [string, string]> = [
  [
    'all shares must have the same byte length',
    'These shares are not from the same split — they have different lengths.',
  ],
  [
    'shares must contain unique values but a duplicate was found',
    'Two shares have the same index. They are either duplicates or from different splits.',
  ],
  ['each share must be at least 2 bytes', 'At least one share is too short to be a valid share.'],
  ['shares must have at least 2 and at most 255 elements', 'Provide between 2 and 255 shares.'],
  ['shares must be at least 2 and at most 255', 'Number of shares must be between 2 and 255.'],
  ['threshold must be at least 2 and at most 255', 'Threshold must be between 2 and 255.'],
  [
    'shares cannot be less than threshold',
    'Threshold cannot be greater than the number of shares.',
  ],
  ['secret cannot be empty', 'Enter a secret to split.'],
];

/** Turns any thrown value into a sentence safe to show the user. */
export function explainError(error: unknown): string {
  if (
    error instanceof ValidationError ||
    error instanceof ShareFormatError ||
    error instanceof DuplicateShareError ||
    error instanceof IntegrityError
  ) {
    return error.message;
  }

  if (error instanceof Error) {
    for (const [needle, message] of LIBRARY_MESSAGES) {
      if (error.message.includes(needle)) {
        return message;
      }
    }
  }

  return GENERIC_MESSAGE;
}
