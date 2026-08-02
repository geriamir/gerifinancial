import React from 'react';
import { Avatar, SxProps, Theme } from '@mui/material';
import { AccountBalance as BankIconFallback } from '@mui/icons-material';
import { getBank } from '../../constants/banks';

interface BankIconProps {
  bankId: string;
  /** Diameter in pixels. 24 suits a dropdown row, 40 a card header. */
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * The visual identity of one bank.
 *
 * No bank logos are bundled with this repository - they are trademarks, and
 * shipping them is a licensing question rather than a technical one. So the
 * default mark is the bank's monogram on its own colour, which is enough for
 * the thing an icon is actually for here: telling four rows of a dropdown apart
 * at a glance. If a logo file is added and pointed at from `constants/banks.ts`,
 * MUI's Avatar renders it and falls back to these children on its own when the
 * image is missing or fails to load, so nothing here has to change.
 *
 * An unknown id still renders something. Account rows come from the database and
 * can outlive a bank being removed from the supported list, and a stored account
 * that draws nothing at all looks broken.
 */
export const BankIcon: React.FC<BankIconProps> = ({ bankId, size = 28, sx }) => {
  const bank = getBank(bankId);

  return (
    <Avatar
      src={bank?.logo}
      alt=""
      // The name is always rendered as text next to this, so announcing the
      // bank again here would just make a screen reader say it twice.
      aria-hidden
      data-testid={`bank-icon-${bankId}`}
      sx={{
        width: size,
        height: size,
        bgcolor: bank?.color ?? 'grey.500',
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
