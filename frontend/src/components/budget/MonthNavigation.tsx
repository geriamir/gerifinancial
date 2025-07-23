import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import { DateRange as DateRangeIcon } from '@mui/icons-material';
import { getMonthNameByNumber } from '../../constants/dateConstants';

interface MonthNavigationProps {
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading?: boolean;
}

const MonthNavigation: React.FC<MonthNavigationProps> = ({
  currentYear,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  loading = false
}) => {
  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Button onClick={onPrevMonth} disabled={loading}>
            ← Previous
          </Button>
          <Box display="flex" alignItems="center" gap={1}>
            <DateRangeIcon />
            <Typography variant="h6">
              {getMonthNameByNumber(currentMonth)} {currentYear}
            </Typography>
          </Box>
          <Button onClick={onNextMonth} disabled={loading}>
            Next →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MonthNavigation;
