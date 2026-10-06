import { describe, it, expect } from 'vitest';
import { hasValidCronSecret } from '../../../supabase/functions/_shared/cronAuth';

describe('hasValidCronSecret', () => {
  it('accepts only an exact match', () => {
    expect(hasValidCronSecret('s3cret', 's3cret')).toBe(true);
    expect(hasValidCronSecret('s3cret ', 's3cret')).toBe(false);
    expect(hasValidCronSecret('S3CRET', 's3cret')).toBe(false);
  });

  it('fails closed when the secret or the header is missing', () => {
    expect(hasValidCronSecret(null, 's3cret')).toBe(false);
    expect(hasValidCronSecret('', 's3cret')).toBe(false);
    expect(hasValidCronSecret('s3cret', undefined)).toBe(false);
    expect(hasValidCronSecret('s3cret', '')).toBe(false);
    expect(hasValidCronSecret(undefined, undefined)).toBe(false);
    expect(hasValidCronSecret('', '')).toBe(false);
  });
});
