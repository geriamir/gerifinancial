import React from 'react';
import { Card, CardContent, Box, Typography, useTheme } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { getSummaryCardGradient, getSummaryIconBg } from '../../theme';

export type SummaryCardColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

export interface SummaryCardProps {
  label: string;
  value: string | React.ReactNode;
  icon?: React.ReactNode;
  color?: SummaryCardColor;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  subtitle?: string;
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  color = 'primary',
  trend,
  subtitle,
  onClick,
  sx,
}) => {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const gradient = getSummaryCardGradient(color, mode);
  const iconBg = getSummaryIconBg(color, mode);
  const colorValue = theme.palette[color]?.main ?? theme.palette.primary.main;

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        background: gradient,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: mode === 'dark'
            ? '0 8px 24px rgba(0,0,0,0.4)'
            : '0 8px 24px rgba(26,35,126,0.12)',
        } : {},
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        ...sx,
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ lineHeight: 1.2 }}
          >
            {label}
          </Typography>
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: iconBg,
                color: colorValue,
                flexShrink: 0,
                ml: 1,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: 'text.primary', mb: trend || subtitle ? 0.5 : 0 }}
        >
          {value}
        </Typography>

        {(trend || subtitle) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            {trend && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  color: trend.direction === 'up'
                    ? 'success.main'
                    : trend.direction === 'down'
                      ? 'error.main'
                      : 'text.secondary',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {trend.direction === 'up' && <TrendingUpIcon sx={{ fontSize: 16 }} />}
                {trend.direction === 'down' && <TrendingDownIcon sx={{ fontSize: 16 }} />}
                {trend.value}
              </Box>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default SummaryCard;
