import React from 'react';
import { Avatar, SxProps, Theme } from '@mui/material';
import { AccountBalance as BankIconFallback } from '@mui/icons-material';
import { getBank } from '../../constants/banks';

interface BankIconProps {
  bankId: string;
  /** Diameter in pixels. 24 suits an inline row of text, 40 a picker tile. */
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * The visual identity of one bank.
 *
 * Where a bank's own public site publishes a mark, it is bundled under
 * `public/banks/` and pointed at from `constants/banks.ts`. Anywhere else the
 * fallback is the bank's monogram on its own colour, which is enough for the
 * thing an icon is actually for here: telling a row of options apart at a
 * glance. MUI's Avatar falls back to the children on its own when the file is
 * missing or fails to load, so a broken asset degrades to a readable badge.
 *
 * A real logo is drawn `contain`ed on a light rounded tile rather than
 * cover-cropped in a circle: several of these marks are diamonds or shields
 * whose corners carry the brand, and a circular crop cuts them off.
 *
 * An unknown id still renders something. Account rows come from the database and
 * can outlive a bank being removed from the supported list, and a stored account
 * that draws nothing at all looks broken.
 */
export const BankIcon: React.FC<BankIconProps> = ({ bankId, size = 28, sx }) => {
  const bank = getBank(bankId);
  const hasLogo = Boolean(bank?.logo);

  return (
    <Avatar
      src={bank?.logo}
      alt=""
      variant={hasLogo ? 'rounded' : 'circular'}
      // The name is always rendered as text next to this, so announcing the
      // bank again here would just make a screen reader say it twice.
      aria-hidden
      data-testid={`bank-icon-${bankId}`}
      slotProps={{ img: { style: { objectFit: 'contain' } } }}
      sx={{
        width: size,
        height: size,
        // A logo carries its own colours, and the marks that have no background
        // of their own were drawn for a light one. The monogram is the only
        // case that needs the bank's colour behind it.
        bgcolor: hasLogo ? 'common.white' : bank?.color ?? 'grey.500',
        color: '#fff',
        // Monograms are up to three characters, so they have to shrink faster
        // than the circle does to keep "CAL" inside it.
        fontSize: size * 0.36,
        fontWeight: 600,
        letterSpacing: 0,
        ...sx
      }}
    >
      {bank ? bank.monogram : <BankIconFallback sx={{ fontSize: size * 0.6 }} />}
    </Avatar>
  );
};
