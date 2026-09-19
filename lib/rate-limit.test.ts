import { describe, expect, it } from 'vitest';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from './rate-limit';

const freshKey = () => `test:${Math.random()}`;

describe('isRateLimited', () => {
  it('allows five requests a minute by default, then blocks', () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) expect(isRateLimited(key)).toBe(false);
    expect(isRateLimited(key)).toBe(true);
  });

  it('takes a higher budget for authenticated admin work', () => {
    const key = freshKey();
    for (let i = 0; i < ADMIN_REQUESTS_PER_WINDOW; i++) {
      expect(isRateLimited(key, ADMIN_REQUESTS_PER_WINDOW)).toBe(false);
    }
    expect(isRateLimited(key, ADMIN_REQUESTS_PER_WINDOW)).toBe(true);
  });

  it('keeps budgets per key, so one caller cannot exhaust another', () => {
    const noisy = freshKey();
    const quiet = freshKey();
    for (let i = 0; i < 6; i++) isRateLimited(noisy);

    expect(isRateLimited(noisy)).toBe(true);
    expect(isRateLimited(quiet)).toBe(false);
  });
});

describe('clientIp', () => {
  it('prefers the platform-set x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('takes only the first hop of x-forwarded-for, which a client cannot vary', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.1, 10.0.0.1' });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to a constant rather than a key the caller controls', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
