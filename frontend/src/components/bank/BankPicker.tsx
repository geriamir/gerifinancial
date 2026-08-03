import React from 'react';
import { Box, FormControl, FormLabel, FormHelperText, RadioGroup, Radio, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { SupportedBank } from '../../constants/banks';
import { BankIcon } from './BankIcon';

interface BankPickerProps {
  banks: SupportedBank[];
  value: string;
  onChange: (bankId: string) => void;
  label: string;
  helperText?: string;
  /** Test id for the group. Individual tiles get `${testId}-option-${bankId}`. */
  testId: string;
}

/**
 * Pick one bank from a short list, shown as a row of logo tiles.
 *
 * This is a radio group rather than a dropdown or a set of toggle buttons.
 * There are only a handful of options and the logo is the whole point - a
 * dropdown hides it behind a click, which defeats recognising your bank
 * without reading. Radio semantics also come with the keyboard behaviour a
 * single-choice required field needs (arrow keys move within the group, the
 * group is one tab stop) instead of it having to be hand-rolled.
 *
 * The radio inputs themselves are visually hidden rather than removed, so they
 * still take focus and still announce as radios; the tile carries the visible
 * selected and focused states via `:focus-within`.
 *
 * Each tile is a `<label>` wrapping its own radio, which is what makes clicking
 * anywhere on the tile select it and what gives the radio its accessible name -
 * the bank name rendered inside. No `aria-label` is needed, and adding one only
 * creates a second place for that name to drift.
 */
export const BankPicker: React.FC<BankPickerProps> = ({
  banks,
  value,
  onChange,
  label,
  helperText,
  testId
}) => (
  <FormControl component="fieldset" required fullWidth margin="dense" sx={{ mt: 1 }}>
    <FormLabel component="legend" sx={{ fontSize: '0.75rem', mb: 1 }}>
      {label}
    </FormLabel>
    <RadioGroup
      name="bankId"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-testid={testId}
      // A real grid rather than `row`, so all the tiles share one width and the
      // row stays even when one bank's name wraps and another's does not.
      sx={{ display: 'grid', gridTemplateColumns: `repeat(${banks.length}, 1fr)`, gap: 1 }}
    >
      {banks.map((bank) => {
        const selected = value === bank.id;

        return (
          <Box
            component="label"
            key={bank.id}
            data-testid={`${testId}-option-${bank.id}`}
            data-selected={selected}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 0.75,
              px: 0.5,
              py: 1.25,
              cursor: 'pointer',
              borderRadius: 2,
              border: 2,
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? 'action.selected' : 'transparent',
              transition: 'border-color 120ms, background-color 120ms',
              '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
              '&:focus-within': {
                borderColor: 'primary.main',
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2
              }
            }}
          >
            <Radio value={bank.id} sx={visuallyHidden} />
            <BankIcon bankId={bank.id} size={40} />
            <Typography
              variant="caption"
              align="center"
              sx={{
                lineHeight: 1.2,
                fontWeight: selected ? 600 : 400,
                color: selected ? 'text.primary' : 'text.secondary'
              }}
            >
              {bank.name}
            </Typography>
          </Box>
        );
      })}
    </RadioGroup>
    {helperText && <FormHelperText>{helperText}</FormHelperText>}
  </FormControl>
);
