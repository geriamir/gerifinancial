import { formatAccountLabel } from '../accountLabel';

describe('formatAccountLabel', () => {
  it('adds the masked login hint when available', () => {
    expect(formatAccountLabel('Visa Cal Credit Cards', 'Login ending 1234'))
      .toBe('Visa Cal Credit Cards (Login ending 1234)');
  });

  it('keeps the original name without a hint', () => {
    expect(formatAccountLabel('Visa Cal Credit Cards')).toBe('Visa Cal Credit Cards');
  });
});
