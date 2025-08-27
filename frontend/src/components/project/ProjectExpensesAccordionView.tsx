import React, { useState } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  IconButton,
  Stack,
  Divider
} from '@mui/material';
import {
  ExpandMore,
  Delete,
  TrendingFlat,
  CheckCircle,
  Warning,
  Info
} from '@mui/icons-material';
import { formatCurrency } from '../../types/foreignCurrency';
import { CategoryBreakdownItem, UnplannedExpense } from '../../types/projects';
import {
  formatCompactCurrency,
  formatCompactDate,
  getCompactProgressColor,
  getCompactProgressWidth,
  getRecommendationChipColor,
  truncateText,
  COMPACT_SPACING
} from './ProjectExpensesCompactUtils';

interface ProjectExpensesAccordionViewProps {
  projectId?: string;
  plannedExpenses: CategoryBreakdownItem[];
  unplannedExpenses: UnplannedExpense[];
  projectCurrency: string;
  projectType?: string;
  onRemoveFromProject: (transactionId: string) => void;
  moveExpenseToPlanned: (transactionId: string, categoryId: string, subCategoryId: string) => Promise<void>;
  movingExpense: string | null;
}

const ProjectExpensesAccordionView: React.FC<ProjectExpensesAccordionViewProps> = ({
  projectId,
  plannedExpenses,
  unplannedExpenses,
  projectCurrency,
  projectType,
  onRemoveFromProject,
  moveExpenseToPlanned,
  movingExpense
}) => {
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [expandedUnplanned, setExpandedUnplanned] = useState<string[]>([]);

  const handleSubcategoryChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSubcategories(isExpanded 
      ? [...expandedSubcategories, panel]
      : expandedSubcategories.filter(p => p !== panel)
    );
  };

  const handleUnplannedChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedUnplanned(isExpanded 
      ? [...expandedUnplanned, panel]
      : expandedUnplanned.filter(p => p !== panel)
    );
  };

  // Group planned expenses by subcategory
  const groupedBySubcategory = plannedExpenses.reduce((groups, budgetItem) => {
    const subCategoryId = budgetItem.subCategoryId._id;
    if (!groups[subCategoryId]) {
      groups[subCategoryId] = {
        subcategory: budgetItem.subCategoryId,
        category: budgetItem.categoryId,
        budgetItems: []
      };
    }
    groups[subCategoryId].budgetItems.push(budgetItem);
    return groups;
  }, {} as Record<string, { subcategory: any; category: any; budgetItems: CategoryBreakdownItem[] }>);

  const getRecommendationIcon = (confidence: number, wouldExceedBudget: boolean) => {
    if (wouldExceedBudget) return <Warning sx={{ fontSize: 12 }} />;
    if (confidence >= 95) return <CheckCircle sx={{ fontSize: 12 }} />;
    return <Info sx={{ fontSize: 12 }} />;
  };

  return (
    <Box>
      {/* Planned Expenses */}
      {Object.values(groupedBySubcategory).map((group) => {
        const totalBudgeted = group.budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
        const totalActual = group.budgetItems.reduce((sum, item) => sum + item.actual, 0);
        const totalExpenseCount = group.budgetItems.reduce((sum, item) => sum + item.expenseCount, 0);
        const panelId = `planned-${group.subcategory._id}`;

        return (
          <Accordion
            key={group.subcategory._id}
            expanded={expandedSubcategories.includes(panelId)}
            onChange={handleSubcategoryChange(panelId)}
            sx={{
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'primary.light',
              '&:before': { display: 'none' },
              mb: COMPACT_SPACING.small
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{
                minHeight: 'auto',
                '& .MuiAccordionSummary-content': {
                  margin: `${COMPACT_SPACING.small}px 0`,
                  alignItems: 'center'
                }
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                <Box flex={1}>
                  <Typography variant="body2" fontWeight="bold" color="primary.dark" mb={0.5}>
                    {projectType === 'vacation' && group.category.name === 'Travel' 
                      ? group.subcategory.name 
                      : `${group.category.name} → ${group.subcategory.name}`}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      {formatCompactCurrency(totalActual, projectCurrency)} / {formatCompactCurrency(totalBudgeted, projectCurrency)}
                    </Typography>
                    <Box sx={{ flex: 1, maxWidth: 80 }}>
                      <LinearProgress
                        variant="determinate"
                        value={getCompactProgressWidth(totalActual, totalBudgeted)}
                        sx={{
                          height: 3,
                          borderRadius: 1,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getCompactProgressColor(totalActual, totalBudgeted)
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
                <Typography variant="body2" fontWeight="medium" color="primary.main" mr={1}>
                  {formatCompactCurrency(totalActual, projectCurrency)}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ py: COMPACT_SPACING.small, px: COMPACT_SPACING.medium }}>
              <Stack spacing={COMPACT_SPACING.small}>
                {group.budgetItems.map((budgetItem, budgetIndex) => (
                  <React.Fragment key={budgetItem.budgetId}>
                    {/* Budget Item Header (if has description or multiple budget items) */}
                    {(budgetItem.description || group.budgetItems.length > 1) && (
                      <Box
                        sx={{
                          p: COMPACT_SPACING.small,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.300'
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box flex={1}>
                            <Typography variant="caption" fontWeight="bold" color="text.primary">
                              {budgetItem.description || `Budget Item ${budgetIndex + 1}`}
                            </Typography>
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="caption" color="primary.main" fontWeight="medium">
                              {formatCompactCurrency(budgetItem.actual, budgetItem.currency)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" fontSize="0.6rem">
                              of {formatCompactCurrency(budgetItem.budgeted, budgetItem.currency)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={getCompactProgressWidth(budgetItem.actual, budgetItem.budgeted)}
                            sx={{
                              height: 2,
                              borderRadius: 1,
                              backgroundColor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: getCompactProgressColor(budgetItem.actual, budgetItem.budgeted)
                              }
                            }}
                          />
                        </Box>
                      </Box>
                    )}
                    
                    {/* Individual Transactions for this Budget Item */}
                    {budgetItem.expenses.map((expense, expenseIndex) => (
                      <Box
                        key={expense._id || expenseIndex}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          p: COMPACT_SPACING.small,
                          ml: (budgetItem.description || group.budgetItems.length > 1) ? 2 : 0,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.200'
                        }}
                      >
                        <Box flex={1}>
                          <Typography variant="caption" fontWeight="medium">
                            {truncateText(expense.description || 'Transaction', 25)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatCompactDate(expense.date)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="primary.main" fontWeight="medium">
                          {formatCompactCurrency(Math.abs(expense.amount), expense.currency)}
                        </Typography>
                      </Box>
                    ))}
                  </React.Fragment>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Section Divider */}
      {plannedExpenses.length > 0 && unplannedExpenses.length > 0 && (
        <Box sx={{ my: COMPACT_SPACING.medium, p: COMPACT_SPACING.small, borderRadius: 1 }}>
          <Typography variant="body2" fontWeight="bold" color="warning.dark" textAlign="center">
            Unplanned Expenses ({unplannedExpenses.length})
          </Typography>
        </Box>
      )}

      {/* Unplanned Expenses */}
      {unplannedExpenses.map((expense) => {
        const panelId = `unplanned-${expense.transactionId}`;
        const isMoving = movingExpense === expense.transactionId;

        return (
          <Accordion
            key={expense.transactionId}
            expanded={expandedUnplanned.includes(panelId)}
            onChange={handleUnplannedChange(panelId)}
            disabled={isMoving}
            sx={{
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'warning.light',
              '&:before': { display: 'none' },
              mb: COMPACT_SPACING.small,
              opacity: isMoving ? 0.7 : 1
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{
                minHeight: 'auto',
                '& .MuiAccordionSummary-content': {
                  margin: `${COMPACT_SPACING.small}px 0`,
                  alignItems: 'center'
                }
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography variant="body2" fontWeight="medium">
                      {truncateText(expense.transaction.chargedAccount || expense.transaction.description || 'Transaction', 25)}
                    </Typography>
                    {expense.recommendations && expense.recommendations.length > 0 && (
                      <Chip
                        label={`${expense.recommendations.length} rec`}
                        size="small"
                        color="info"
                        sx={{ height: 14, fontSize: '0.55rem' }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatCompactDate(expense.transactionDate)} • {expense.category.name} → {expense.subCategory.name}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box textAlign="right" mr={1}>
                    <Typography variant="body2" color="warning.dark" fontWeight="medium">
                      {formatCompactCurrency(expense.originalAmount, expense.originalCurrency)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromProject(expense.transactionId);
                    }}
                    sx={{ color: 'error.main', p: 0.25 }}
                    disabled={isMoving}
                  >
                    <Delete sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ py: COMPACT_SPACING.small, px: COMPACT_SPACING.medium }}>
              {expense.recommendations && expense.recommendations.length > 0 ? (
                <Stack spacing={COMPACT_SPACING.small}>
                  <Typography variant="caption" color="text.secondary">
                    Recommendations:
                  </Typography>
                  {expense.recommendations.slice(0, 3).map((rec, index) => (
                    <Box
                      key={`${rec.categoryId}-${rec.subCategoryId}`}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        p: COMPACT_SPACING.small,
                        backgroundColor: index === 0 ? 'primary.light' : 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: index === 0 ? 'primary.main' : 'grey.200'
                      }}
                    >
                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
                          {getRecommendationIcon(rec.confidence, rec.wouldExceedBudget)}
                          <Typography variant="caption" fontWeight="bold">
                            {truncateText(rec.subCategoryName, 16)}
                          </Typography>
                          <Chip
                            label={`${rec.confidence}%`}
                            size="small"
                            color={getRecommendationChipColor(rec.confidence, rec.wouldExceedBudget)}
                            sx={{ height: 14, fontSize: '0.55rem' }}
                          />
                          {index === 0 && (
                            <Chip
                              label="Best"
                              size="small"
                              color="primary"
                              sx={{ height: 14, fontSize: '0.55rem' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                          {truncateText(rec.reason, 30)}
                        </Typography>
                        {rec.wouldExceedBudget && (
                          <Typography variant="caption" color="error.main" display="block" fontSize="0.6rem">
                            ⚠ Would exceed budget
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant={index === 0 ? "contained" : "outlined"}
                        color={rec.wouldExceedBudget ? "warning" : "primary"}
                        startIcon={isMoving ? <CircularProgress size={8} /> : <TrendingFlat />}
                        onClick={() => moveExpenseToPlanned(expense.transactionId, rec.categoryId, rec.subCategoryId)}
                        disabled={isMoving}
                        sx={{ 
                          minWidth: 'auto', 
                          px: COMPACT_SPACING.small, 
                          py: 0.25,
                          fontSize: '0.55rem'
                        }}
                      >
                        Move
                      </Button>
                    </Box>
                  ))}
                  {expense.recommendations.length > 3 && (
                    <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                      +{expense.recommendations.length - 3} more recommendations
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" fontStyle="italic">
                  No recommendations available
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

export default ProjectExpensesAccordionView;
