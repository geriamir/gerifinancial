import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import {
  TableChart,
  List,
  ExpandMore,
  AccountTree
} from '@mui/icons-material';
import { VIEW_MODES, CompactViewMode } from './ProjectExpensesCompactUtils';

interface ProjectExpensesViewToggleProps {
  selectedView: CompactViewMode['id'];
  onViewChange: (viewId: CompactViewMode['id']) => void;
}

const VIEW_ICONS = {
  table: <TableChart />,
  list: <List />
};

const ProjectExpensesViewToggle: React.FC<ProjectExpensesViewToggleProps> = ({
  selectedView,
  onViewChange
}) => {
  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newView: CompactViewMode['id'] | null
  ) => {
    if (newView !== null) {
      onViewChange(newView);
    }
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <ToggleButtonGroup
        value={selectedView}
        exclusive
        onChange={handleViewChange}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            px: 1,
            py: 0.5,
            minWidth: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              }
            }
          }
        }}
      >
        {VIEW_MODES.map((mode) => (
          <Tooltip key={mode.id} title={mode.description} arrow>
            <ToggleButton value={mode.id} aria-label={mode.name}>
              {VIEW_ICONS[mode.id]}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default ProjectExpensesViewToggle;
