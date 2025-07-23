import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  AutoGraph as AutoGraphIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
  Calculate as CalculatorIcon
} from '@mui/icons-material';

interface BudgetStatusChipsProps {
  status: string;
  isAutoCalculated?: boolean;
  onEditBudget: () => void;
  onViewDetails: () => void;
  onRecalculate: () => void;
}

const BudgetStatusChips: React.FC<BudgetStatusChipsProps> = ({
  status,
  isAutoCalculated = false,
  onEditBudget,
  onViewDetails,
  onRecalculate
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'planning': return 'warning';
      case 'on-hold': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box display="flex" alignItems="center" gap={2} mb={3}>
      <Chip
        label={status}
        color={getStatusColor(status) as any}
        size="small"
      />
      {isAutoCalculated && (
        <Chip
          label="Auto-calculated"
          color="info"
          size="small"
          icon={<AutoGraphIcon />}
        />
      )}
      <Box ml="auto" display="flex" gap={1}>
        <IconButton
          size="small"
          onClick={handleMenuOpen}
        >
          <MoreVertIcon />
        </IconButton>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onEditBudget(); handleMenuClose(); }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit Budget
        </MenuItem>
        <MenuItem onClick={() => { onViewDetails(); handleMenuClose(); }}>
          <TrendingUpIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={() => { onRecalculate(); handleMenuClose(); }}>
          <CalculatorIcon sx={{ mr: 1 }} fontSize="small" />
          Recalculate
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default BudgetStatusChips;
