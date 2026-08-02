import React from 'react';
import { render, screen } from '@testing-library/react';
import { BankIcon } from '../BankIcon';
import { SUPPORTED_BANKS, CHECKING_ACCOUNT_BANKS, CREDIT_CARD_PROVIDERS, API_BANKS, OTP_BANKS } from '../../../constants/banks';

describe('BankIcon', () => {
  it('shows the monogram for a known bank', () => {
    render(<BankIcon bankId="hapoalim" />);
    expect(screen.getByTestId('bank-icon-hapoalim')).toHaveTextContent('HP');
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

    // No bank logos are bundled - they are trademarks. The monogram is the
    // default on purpose, and this is the test that notices if one is added.
    it('ships no logo files, so every bank falls back to its monogram', () => {
      expect(SUPPORTED_BANKS.filter((bank) => bank.logo)).toEqual([]);
    });
  });
});
