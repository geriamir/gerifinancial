const { _internals } = require('../index');

const { numberFromEnv } = _internals;

// The spend ceiling on Azure OpenAI is the one setting in this app where being
// wrong costs money rather than accuracy, and where 0 is a real, meaningful
// value rather than "unset". That combination rules out both of the obvious
// ways to read it, so the rule is pinned here.
describe('numberFromEnv', () => {
  it('reads a value that is present', () => {
    expect(numberFromEnv('50000', 200000)).toBe(50000);
  });

  // `||` would swallow this and restore the default, quietly putting the cap
  // back on for someone who deliberately removed it.
  it('keeps an explicit 0 rather than treating it as unset', () => {
    expect(numberFromEnv('0', 200000)).toBe(0);
  });

  it('falls back when the variable is absent', () => {
    expect(numberFromEnv(undefined, 200000)).toBe(200000);
  });

  // `AI_DAILY_TOKEN_BUDGET=` in a .env file arrives as an empty string, and
  // `Number('')` is 0 - which for this setting means "no ceiling at all". An
  // empty variable is one nobody set, not a decision to spend freely.
  it('falls back on an empty variable instead of removing the ceiling', () => {
    expect(numberFromEnv('', 200000)).toBe(200000);
    expect(numberFromEnv('   ', 200000)).toBe(200000);
  });

  it('falls back on a value that is not a number', () => {
    expect(numberFromEnv('unlimited', 200000)).toBe(200000);
  });
});
