import { hashRefreshToken, isRefreshExpired } from './auth-refresh.util';

describe('auth refresh utils', () => {
  it('hashes refresh tokens deterministically', () => {
    expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
    expect(hashRefreshToken('abc')).not.toBe(hashRefreshToken('xyz'));
    expect(hashRefreshToken('abc')).toHaveLength(64);
  });

  it('detects expired refresh tokens', () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(isRefreshExpired(past)).toBe(true);
    expect(isRefreshExpired(future)).toBe(false);
  });
});
