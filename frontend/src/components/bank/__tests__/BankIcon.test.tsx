import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, within } from '@testing-library/react';
import { BankIcon } from '../BankIcon';
import { SUPPORTED_BANKS, CHECKING_ACCOUNT_BANKS, CREDIT_CARD_PROVIDERS, API_BANKS, OTP_BANKS } from '../../../constants/banks';

describe('BankIcon', () => {
  // Most providers ship no logo, so the monogram is what actually renders for
  // them - it is a fallback in name only.
  it('shows the monogram for a bank with no logo', () => {
    render(<BankIcon bankId="visaCal" />);
    expect(screen.getByTestId('bank-icon-visaCal')).toHaveTextContent('CAL');
  });

  it('draws the real mark for a bank that has one', () => {
    render(<BankIcon bankId="hapoalim" />);
    // The mark is decorative - `alt=""` gives it the presentation role, because
    // the bank name is always written out beside it.
    expect(
      within(screen.getByTestId('bank-icon-hapoalim')).getByRole('presentation', { hidden: true })
    ).toHaveAttribute('src', '/banks/hapoalim.png');
  });

  // Several of these marks are diamonds or shields that carry the brand in
  // their corners, so the circular cover-crop an Avatar does by default would
  // cut them off.
  it('fits the whole logo in the tile instead of cropping it', () => {
    render(<BankIcon bankId="hapoalim" />);
    const logo = within(screen.getByTestId('bank-icon-hapoalim')).getByRole('presentation', { hidden: true });
    expect(logo).toHaveStyle({ objectFit: 'contain' });
  });

  // Account rows come from the database and can outlive a bank being dropped
  // from the supported list. Drawing nothing at all there looks broken.
  it('still renders something for a bank it does not know', () => {
    render(<BankIcon bankId="some-retired-bank" />);
    expect(screen.getByTestId('bank-icon-some-retired-bank')).toBeInTheDocument();
  });

  // The bank name is always rendered as text beside the icon, so announcing it
  // here as well would just make a screen reader say it twice.
  it('is hidden from assistive technology', () => {
    render(<BankIcon bankId="leumi" />);
    expect(screen.getByTestId('bank-icon-leumi')).toHaveAttribute('aria-hidden', 'true');
  });

  describe('the bank list itself', () => {
    it('gives every bank a monogram and a colour', () => {
      for (const bank of SUPPORTED_BANKS) {
        expect(bank.monogram).toMatch(/^[A-Z]{2,3}$/);
        expect(bank.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    // Within a group these are shown as a list of options, so a repeat reads as
    // a rendering bug rather than as a choice.
    it.each([
      ['checking accounts', CHECKING_ACCOUNT_BANKS],
      ['credit cards', CREDIT_CARD_PROVIDERS],
      ['API banks', API_BANKS],
      ['OTP providers', OTP_BANKS]
    ])('keeps %s telling apart from each other', (_label, group) => {
      expect(new Set(group.map((bank) => bank.monogram)).size).toBe(group.length);
      expect(new Set(group.map((bank) => bank.color)).size).toBe(group.length);
    });

    // A logo path that points at nothing fails silently in the browser - the
    // Avatar just falls back to the monogram - so a typo or a deleted asset
    // would only ever be caught by someone looking at the screen.
    it('points every declared logo at a file that exists', () => {
      const declared = SUPPORTED_BANKS.filter((bank) => bank.logo);
      expect(declared.length).toBeGreaterThan(0);

      for (const bank of declared) {
        const file = path.join(__dirname, '../../../../public', bank.logo as string);
        expect({ bank: bank.id, exists: fs.existsSync(file) }).toEqual({ bank: bank.id, exists: true });
      }
    });
  });
});
