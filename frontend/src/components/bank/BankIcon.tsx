import React, { useState } from 'react';
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
 * glance.
 *
 * A real logo is drawn `contain`ed on a light rounded tile rather than
 * cover-cropped in a circle: several of these marks are diamonds or shields
 * whose corners carry the brand, and a circular crop cuts them off.
 *
 * A logo that will not load - a 404, a bad deploy base path, a decode error -
 * drops the whole tile back to monogram styling, colour included. Keeping the
 * light logo background while showing the monogram would put white text on
 * white and read as a blank tile, which is worse than either state on its own.
 * The failure is recorded against the bank it happened to, so one broken mark
 * cannot blank out the next bank rendered through the same instance.
 *
 * An unknown id still renders something. Account rows come from the database and
 * can outlive a bank being removed from the supported list, and a stored account
 * that draws nothing at all looks broken.
 */
export const BankIcon: React.FC<BankIconProps> = ({ bankId, size = 28, sx }) => {
  const bank = getBank(bankId);

  // Keyed by bank rather than a bare boolean: this component is reused across a
  // row of tiles, so a flag would follow the instance instead of the image.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const showLogo = Boolean(bank?.logo) && failedFor !== bankId;

  return (
    <Avatar
      src={showLogo ? bank?.logo : undefined}
      alt=""
      variant={showLogo ? 'rounded' : 'circular'}
      // The name is always rendered as text next to this, so announcing the
      // bank again here would just make a screen reader say it twice.
      aria-hidden
      data-testid={`bank-icon-${bankId}`}
      slotProps={{
        img: {
          style: { objectFit: 'contain' },
          // Avatar has its own internal load tracking, but it only swaps in the
          // children - it cannot restyle the tile, which is the half that
          // matters here.
          onError: () => setFailedFor(bankId)
        }
      }}
      sx={{
        width: size,
        height: size,
        // A logo carries its own colours, and the marks that have no background
        // of their own were drawn for a light one. Every other case is the
        // monogram, which needs the bank's colour behind it to be legible.
        bgcolor: showLogo ? 'common.white' : bank?.color ?? 'grey.500',
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
