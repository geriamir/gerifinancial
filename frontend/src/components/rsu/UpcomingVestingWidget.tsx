import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Skeleton,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { UpcomingVestingEvent } from '../../services/api/rsus';

interface UpcomingVestingWidgetProps {
  events: UpcomingVestingEvent[];
  loading?: boolean;
  maxEvents?: number;
}

const UpcomingVestingWidget: React.FC<UpcomingVestingWidgetProps> = ({
  events,
  loading = false,
  maxEvents = 5
}) => {
  // Group events by month and accumulate shares/values (memoized for performance)
  const { groupedEvents, sortedGroupedEvents } = useMemo(() => {
    const grouped = events.reduce((acc, event) => {
      const date = new Date(event.vestDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          date: date,
          totalShares: 0,
          totalValue: 0,
          events: [],
          stockSymbols: new Set()
        };
      }
      
      acc[monthKey].totalShares += event.shares;
      acc[monthKey].totalValue += event.estimatedValue;
      acc[monthKey].events.push(event);
      acc[monthKey].stockSymbols.add(event.stockSymbol);
      
      return acc;
    }, {} as Record<string, {
      month: string,
      date: Date,
      totalShares: number,
      totalValue: number,
      events: UpcomingVestingEvent[],
      stockSymbols: Set<string>
    }>);

    // Sort grouped events by date and limit to maxEvents
    const sorted = Object.values(grouped)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, maxEvents);

    return { groupedEvents: grouped, sortedGroupedEvents: sorted };
  }, [events, maxEvents]);

  if (loading) {
    return (
      <Box>
        {[1, 2, 3].map((item) => (
          <Box key={item} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
          </Box>
        ))}
      </Box>
    );
  }

  if (sortedGroupedEvents.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Upcoming Vesting Events
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All your RSU grants are fully vested or no grants available
        </Typography>
      </Box>
    );
  }

  const formatMonthDate = (date: Date) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();

    // Calculate actual month difference
    const monthDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);

    // Add relative time based on actual month difference
    if (monthDiff < 0) {
      return { relative: 'Past month' };
    } else if (monthDiff === 0) {
      return { relative: 'This month' };
    } else if (monthDiff === 1) {
      return { relative: 'Next month' };
    } else if (monthDiff <= 3) {
      return { relative: `${monthDiff} months` };
    } else {
      return { relative: `${monthDiff} months` };
    }
  };

  const getUrgencyColor = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { icon: 'error' as const, chip: 'error' as const };
    if (diffDays <= 30) return { icon: 'warning' as const, chip: 'warning' as const };
    if (diffDays <= 60) return { icon: 'info' as const, chip: 'info' as const };
    return { icon: 'inherit' as const, chip: 'default' as const };
  };

  // Calculate total upcoming value from grouped events
  const totalUpcomingValue = sortedGroupedEvents.reduce((sum, group) => sum + group.totalValue, 0);
  const totalUpcomingShares = sortedGroupedEvents.reduce((sum, group) => sum + group.totalShares, 0);

  return (
    <Box>
      {/* Summary Header */}
      <Card variant="outlined" sx={{ mb: 2, bgcolor: 'action.hover' }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Next {sortedGroupedEvents.length} Months
              </Typography>
              <Typography variant="h6" color="primary">
                {totalUpcomingShares.toLocaleString()} shares
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Est. Value (Pre-Tax)
              </Typography>
              <Typography variant="h6" color="success.main">
                ${totalUpcomingValue.toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Monthly Events List */}
      <List sx={{ p: 0 }}>
        {sortedGroupedEvents.map((group, index) => {
          const { relative } = formatMonthDate(group.date);
          const urgencyColor = getUrgencyColor(group.date);
          const stockSymbolsList = Array.from(group.stockSymbols).join(', ');

          return (
            <React.Fragment key={`${group.month}-${index}`}>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ScheduleIcon color={urgencyColor.icon} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ flex: 1 }}>
                        <Typography variant="subtitle2" component="span">
                          {group.month}
                        </Typography>
                        <br />
                        <Typography variant="body2" color="text.secondary" component="span">
                          {stockSymbolsList} • {group.events.length} events
                        </Typography>
                        <br />
                        <Typography variant="body2" color="text.secondary" component="span">
                          {group.totalShares.toLocaleString()} shares • ${group.totalValue.toLocaleString()} (pre-tax)
                        </Typography>
                      </span>
                      <span style={{ textAlign: 'right', marginLeft: '16px' }}>
                        <Chip
                          label={relative}
                          size="small"
                          color={urgencyColor.chip}
                          variant="outlined"
                          sx={{ fontSize: '0.75rem', height: 20 }}
                        />
                      </span>
                    </span>
                  }
                />
              </ListItem>
              {index < sortedGroupedEvents.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </List>

      {/* Show More Indicator */}
      {Object.keys(groupedEvents).length > maxEvents && (
        <Box sx={{ textAlign: 'center', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            +{Object.keys(groupedEvents).length - maxEvents} more months
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default UpcomingVestingWidget;
