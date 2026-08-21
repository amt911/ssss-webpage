import { describe, expect, it } from 'vitest';

import {
  DuplicateShareError,
  IntegrityError,
  ShareFormatError,
  ValidationError,
  explainError,
} from './errors';

describe('error classes', () => {
  it('carry their own name so they survive instanceof-free checks', () => {
    expect(new ValidationError('x').name).toBe('ValidationError');
    expect(new ShareFormatError('x').name).toBe('ShareFormatError');
    expect(new DuplicateShareError('x').name).toBe('DuplicateShareError');
    expect(new IntegrityError('x', 'checksum').name).toBe('IntegrityError');
  });

  it('are real Errors with the given message', () => {
    const error = new ValidationError('nope');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('nope');
  });

  it('records the offending line numbers on a format error', () => {
    expect(new ShareFormatError('bad', [2, 5]).lines).toEqual([2, 5]);
    expect(new ShareFormatError('bad').lines).toEqual([]);
  });

  it('records why integrity failed, without leaking it into the message', () => {
    expect(new IntegrityError('nope', 'version').reason).toBe('version');
    expect(new IntegrityError('nope', 'checksum').reason).toBe('checksum');
  });
});

describe('explainError', () => {
  it('passes our own errors through unchanged', () => {
    expect(explainError(new ValidationError('Threshold must be a whole number.'))).toBe(
      'Threshold must be a whole number.',
    );
    expect(explainError(new ShareFormatError('Line 2 is not a valid share.'))).toBe(
      'Line 2 is not a valid share.',
    );
    expect(explainError(new DuplicateShareError('Duplicated share.'))).toBe('Duplicated share.');
    expect(explainError(new IntegrityError('Could not recover.', 'checksum'))).toBe(
      'Could not recover.',
    );
  });

  it('translates the library error for shares of different lengths', () => {
    const message = explainError(new Error('all shares must have the same byte length'));
    expect(message).toBe(
      'These shares are not from the same split — they have different lengths.',
    );
  });

  it('translates the library error for a repeated share index', () => {
    const message = explainError(
      new Error('shares must contain unique values but a duplicate was found'),
    );
    expect(message).toBe(
      'Two shares have the same index. They are either duplicates or from different splits.',
    );
  });

  it('translates the library error for a too-short share', () => {
    expect(explainError(new Error('each share must be at least 2 bytes'))).toBe(
      'At least one share is too short to be a valid share.',
    );
  });

  it('translates the library range errors', () => {
    expect(explainError(new RangeError('shares must be at least 2 and at most 255'))).toBe(
      'Number of shares must be between 2 and 255.',
    );
    expect(explainError(new RangeError('threshold must be at least 2 and at most 255'))).toBe(
      'Threshold must be between 2 and 255.',
    );
    expect(
      explainError(new RangeError('shares must have at least 2 and at most 255 elements')),
    ).toBe('Provide between 2 and 255 shares.');
    expect(explainError(new Error('shares cannot be less than threshold'))).toBe(
      'Threshold cannot be greater than the number of shares.',
    );
    expect(explainError(new Error('secret cannot be empty'))).toBe('Enter a secret to split.');
  });

  it('matches library messages even when wrapped in extra text', () => {
    expect(explainError(new Error('Error: all shares must have the same byte length'))).toBe(
      'These shares are not from the same split — they have different lengths.',
    );
  });

  it('falls back to a generic message for anything unrecognised', () => {
    const generic = 'Unexpected error. Check your input and try again.';
    expect(explainError(new Error('kaboom'))).toBe(generic);
    expect(explainError('a bare string')).toBe(generic);
    expect(explainError(null)).toBe(generic);
    expect(explainError(undefined)).toBe(generic);
    expect(explainError({ message: 'all shares must have the same byte length' })).toBe(generic);
  });
});
