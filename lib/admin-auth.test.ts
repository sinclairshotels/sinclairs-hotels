import { describe, expect, it } from 'vitest';
import { constantTimeEqual } from './admin-auth';

// Staff authentication moved to lib/auth.ts and its own test file. What is
// left here is the shared-secret comparison, still used by the cron endpoint.
describe('constantTimeEqual', () => {
  it('matches identical strings', () => {
    expect(constantTimeEqual('Bearer abc123', 'Bearer abc123')).toBe(true);
  });

  it('rejects a different value of the same length', () => {
    expect(constantTimeEqual('Bearer abc123', 'Bearer abc124')).toBe(false);
  });

  it('rejects values of different lengths without short-circuiting on length', () => {
    expect(constantTimeEqual('short', 'considerably longer')).toBe(false);
    expect(constantTimeEqual('', 'x')).toBe(false);
  });

  it('matches two empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
