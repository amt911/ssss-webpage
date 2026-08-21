import { describe, expect, it } from 'vitest';

import { ValidationError } from './errors';
import { SIZE_HINT_THRESHOLD_BYTES, secretSizeWarning, validateSplitParams } from './validate';

describe('validateSplitParams', () => {
  it('accepts the whole supported range', () => {
    expect(() => validateSplitParams(2, 2)).not.toThrow();
    expect(() => validateSplitParams(3, 2)).not.toThrow();
    expect(() => validateSplitParams(255, 2)).not.toThrow();
    expect(() => validateSplitParams(255, 255)).not.toThrow();
  });

  it('requires a whole number of shares', () => {
    expect(() => validateSplitParams(2.5, 2)).toThrow('Number of shares must be a whole number.');
    expect(() => validateSplitParams(Number.NaN, 2)).toThrow(
      'Number of shares must be a whole number.',
    );
    expect(() => validateSplitParams(Number.POSITIVE_INFINITY, 2)).toThrow(
      'Number of shares must be a whole number.',
    );
  });

  it('keeps the share count inside 2..255', () => {
    expect(() => validateSplitParams(1, 2)).toThrow('Number of shares must be between 2 and 255.');
    expect(() => validateSplitParams(0, 2)).toThrow('Number of shares must be between 2 and 255.');
    expect(() => validateSplitParams(-3, 2)).toThrow('Number of shares must be between 2 and 255.');
    expect(() => validateSplitParams(256, 2)).toThrow(
      'Number of shares must be between 2 and 255.',
    );
  });

  it('requires a whole threshold', () => {
    expect(() => validateSplitParams(3, 2.5)).toThrow('Threshold must be a whole number.');
    expect(() => validateSplitParams(3, Number.NaN)).toThrow('Threshold must be a whole number.');
  });

  it('keeps the threshold inside 2..255', () => {
    expect(() => validateSplitParams(3, 1)).toThrow('Threshold must be between 2 and 255.');
    expect(() => validateSplitParams(3, 0)).toThrow('Threshold must be between 2 and 255.');
    expect(() => validateSplitParams(255, 256)).toThrow('Threshold must be between 2 and 255.');
  });

  it('refuses a threshold above the share count', () => {
    expect(() => validateSplitParams(3, 4)).toThrow(
      'Threshold cannot be greater than the number of shares.',
    );
    expect(() => validateSplitParams(2, 3)).toThrow(
      'Threshold cannot be greater than the number of shares.',
    );
  });

  it('always throws a ValidationError', () => {
    expect(() => validateSplitParams(1, 1)).toThrow(ValidationError);
  });

  it('reports the share count before the threshold when both are wrong', () => {
    expect(() => validateSplitParams(1, 1)).toThrow('Number of shares must be between 2 and 255.');
  });
});

describe('secretSizeWarning', () => {
  it('stays quiet for ordinary secrets', () => {
    expect(secretSizeWarning(0)).toBeNull();
    expect(secretSizeWarning(1)).toBeNull();
    expect(secretSizeWarning(SIZE_HINT_THRESHOLD_BYTES - 1)).toBeNull();
  });

  it('warns from the threshold upwards', () => {
    expect(SIZE_HINT_THRESHOLD_BYTES).toBe(4096);
    expect(secretSizeWarning(SIZE_HINT_THRESHOLD_BYTES)).toContain('4.0 KB');
    expect(secretSizeWarning(SIZE_HINT_THRESHOLD_BYTES)).toContain('share');
    expect(secretSizeWarning(10240)).toContain('10.0 KB');
  });

  it('never blocks anything — it only ever returns a hint or nothing', () => {
    expect(typeof secretSizeWarning(5000)).toBe('string');
    expect(secretSizeWarning(10)).toBeNull();
  });
});
