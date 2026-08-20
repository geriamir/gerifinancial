const { buildAccountLoginHint } = require('../accountLoginHint');

describe('buildAccountLoginHint', () => {
  it('uses only the last four login characters', () => {
    expect(buildAccountLoginHint('123456789')).toBe('Login ending 6789');
  });

  it('uses the email local part instead of the domain', () => {
    expect(buildAccountLoginHint('account@example.com')).toBe('Login ending ount');
  });

  it('returns null when no login is available', () => {
    expect(buildAccountLoginHint('   ')).toBeNull();
    expect(buildAccountLoginHint()).toBeNull();
  });
});
