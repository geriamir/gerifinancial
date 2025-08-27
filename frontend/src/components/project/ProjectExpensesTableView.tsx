import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Typography,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  ExpandLess,
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

interface ProjectExpensesTableViewProps {
  projectId?: string;
  plannedExpenses: CategoryBreakdownItem[];
  unplannedExpenses: UnplannedExpense[];
  projectCurrency: string;
  projectType?: string;
  onRemoveFromProject: (transactionId: string) => void;
  moveExpenseToPlanned: (transactionId: string, categoryId: string, subCategoryId: string) => Promise<void>;
  movingExpense: string | null;
}

const ProjectExpensesTableView: React.FC<ProjectExpensesTableViewProps> = ({
  projectId,
  plannedExpenses,
  unplannedExpenses,
  projectCurrency,
  projectType,
  onRemoveFromProject,
  moveExpenseToPlanned,
  movingExpense
}) => {
  // Initialize with all subcategories expanded by default
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(() => {
    const subcategoryIds = new Set<string>();
    plannedExpenses.forEach(expense => {
      if (expense.subCategoryId?._id) {
        subcategoryIds.add(expense.subCategoryId._id);
      }
    });
    return subcategoryIds;
  });

  // Initialize with all unplanned expenses expanded by default
  const [expandedUnplanned, setExpandedUnplanned] = useState<Set<string>>(() => {
    return new Set(unplannedExpenses.map(expense => expense.transactionId));
  });

  const toggleSubcategory = (subcategoryId: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategoryId)) {
      newExpanded.delete(subcategoryId);
    } else {
      newExpanded.add(subcategoryId);
    }
    setExpandedSubcategories(newExpanded);
  };

  const toggleUnplanned = (transactionId: string) => {
    const newExpanded = new Set(expandedUnplanned);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedUnplanned(newExpanded);
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
    if (wouldExceedBudget) return <Warning sx={{ fontSize: 14 }} />;
    if (confidence >= 95) return <CheckCircle sx={{ fontSize: 14 }} />;
    return <Info sx={{ fontSize: 14 }} />;
  };

  return (
    <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: COMPACT_SPACING.small, px: COMPACT_SPACING.medium } }}>
        <TableBody>
          {/* Planned Expenses */}
          {Object.values(groupedBySubcategory).map((group) => {
            const totalBudgeted = group.budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
            const totalActual = group.budgetItems.reduce((sum, item) => sum + item.actual, 0);
            const totalExpenseCount = group.budgetItems.reduce((sum, item) => sum + item.expenseCount, 0);
            const isExpanded = expandedSubcategories.has(group.subcategory._id);

            return (
              <React.Fragment key={group.subcategory._id}>
                {/* Subcategory Header Row */}
                <TableRow 
                  sx={{ 
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleSubcategory(group.subcategory._id)}
                >
                  <TableCell></TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" color="primary.dark">
                      {projectType === 'vacation' && group.category.name === 'Travel' 
                        ? group.subcategory.name 
                        : `${group.category.name} → ${group.subcategory.name}`}
                    </Typography>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>
                    <Box sx={{ width: '100%' }}>
                      <LinearProgress
                        variant="determinate"
                        value={getCompactProgressWidth(totalActual, totalBudgeted)}
                        sx={{
                          height: 6,
                          borderRadius: 1,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getCompactProgressColor(totalActual, totalBudgeted)
                          }
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell align="right" sx={{ minWidth: 120 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCompactCurrency(totalActual, projectCurrency, 20)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      of {formatCompactCurrency(totalBudgeted, projectCurrency, 20)}
                    </Typography>
                  </TableCell>
                </TableRow>

                {/* Budget Items and Transactions */}
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Table size="small" sx={{ '& .MuiTableCell-root': { py: COMPACT_SPACING.small, px: 0 } }}>
                        <TableBody>
                          {group.budgetItems.map((budgetItem, budgetIndex) => (
                            <React.Fragment key={budgetItem.budgetId}>
                              {/* Budget Item Header Row (if has description or multiple budget items) */}
                              {(budgetItem.description || group.budgetItems.length > 1) && (
                                <TableRow>
                                  <TableCell width="40px"></TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium" color="text.primary">
                                      {budgetItem.description || `Budget Item ${budgetIndex + 1}`}
                                    </Typography>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell>
                                    <Box sx={{ width: '100%' }}>
                                      <LinearProgress
                                        variant="determinate"
                                        value={getCompactProgressWidth(budgetItem.actual, budgetItem.budgeted)}
                                        sx={{
                                          height: 4,
                                          borderRadius: 1,
                                          backgroundColor: 'grey.200',
                                          '& .MuiLinearProgress-bar': {
                                            backgroundColor: getCompactProgressColor(budgetItem.actual, budgetItem.budgeted)
                                          }
                                        }}
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell align="right" sx={{ minWidth: 120 }}>
                                    <Typography variant="body2" fontWeight="medium">
                                      {formatCompactCurrency(budgetItem.actual, budgetItem.currency, 20)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      of {formatCompactCurrency(budgetItem.budgeted, budgetItem.currency, 20)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                              
                              {/* Individual Transactions for this Budget Item */}
                              {budgetItem.expenses.map((expense, expenseIndex) => (
                                <TableRow 
                                  key={expense._id || `${budgetItem.budgetId}-expense-${expenseIndex}`}
                                >
                                  <TableCell width="40px"></TableCell>
                                  <TableCell sx={{ pl: (budgetItem.description || group.budgetItems.length > 1) ? 4 : 2 }}>
                                    <Typography variant="body2">
                                      {truncateText(expense.description || 'Transaction', 30)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">
                                      {formatCompactDate(expense.date)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell align="right" sx={{ minWidth: 120 }}>
                                    <Typography variant="body2" color="primary.main">
                                      {formatCompactCurrency(Math.abs(expense.amount), expense.currency, 20)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}

          {/* Divider Row */}
          {plannedExpenses.length > 0 && unplannedExpenses.length > 0 && (
            <TableRow>
              <TableCell colSpan={6} sx={{ py: COMPACT_SPACING.medium, px: COMPACT_SPACING.medium }}>
                <Typography variant="subtitle1" color="warning.main" fontWeight="bold">
                  Unplanned Expenses
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {/* Unplanned Expenses */}
          {unplannedExpenses.map((expense) => {
            const isExpanded = expandedUnplanned.has(expense.transactionId);
            const isMoving = movingExpense === expense.transactionId;

            return (
              <React.Fragment key={expense.transactionId}>
                {/* Unplanned Expense Row */}
                <TableRow 
                  sx={{ 
                    opacity: isMoving ? 0.7 : 1
                  }}
                >
                  <TableCell>
                    <IconButton 
                      size="small" 
                      sx={{ p: 0 }}
                      onClick={() => toggleUnplanned(expense.transactionId)}
                      disabled={isMoving}
                    >
                      {isExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {truncateText(expense.transaction.chargedAccount || expense.transaction.description || 'Transaction', 30)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {expense.category.name} → {expense.subCategory.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatCompactDate(expense.transactionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {expense.recommendations && expense.recommendations.length > 0 && (
                      <Chip
                        label={`${expense.recommendations.length} rec`}
                        size="small"
                        color="info"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => onRemoveFromProject(expense.transactionId)}
                      sx={{ color: 'error.main', p: 0 }}
                      disabled={isMoving}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 120 }}>
                    <Typography variant="body2" color="warning.dark" fontWeight="medium">
                      {formatCompactCurrency(expense.originalAmount, expense.originalCurrency, 20)}
                    </Typography>
                  </TableCell>
                </TableRow>

                {/* Recommendations */}
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ p: COMPACT_SPACING.medium }}>
                        {expense.recommendations && expense.recommendations.length > 0 ? (
                          <Box display="flex" flexDirection="column" gap={COMPACT_SPACING.small}>
                            <Typography variant="caption" color="text.secondary">
                              Recommendations:
                            </Typography>
                            {(() => {
                              // First, collect all unique budget items across all recommendations
                              const uniqueBudgetItems = new Map<string, { budgetItem: any; rec: any; bestRec?: any }>();
                              
                              // Process all recommendations to find unique budget items
                              expense.recommendations.forEach((rec, recIndex) => {
                                const matchingBudgetItems = plannedExpenses.filter(
                                  item => item.subCategoryId._id === rec.subCategoryId
                                );
                                
                                matchingBudgetItems.forEach((budgetItem) => {
                                  const budgetItemKey = `${rec.subCategoryId}-${budgetItem.budgetId}`;
                                  
                                  // If we haven't seen this budget item, add it
                                  // If we have seen it, keep the one with higher confidence
                                  if (!uniqueBudgetItems.has(budgetItemKey) || 
                                      (uniqueBudgetItems.get(budgetItemKey)?.rec.confidence || 0) < rec.confidence) {
                                    uniqueBudgetItems.set(budgetItemKey, { budgetItem, rec, bestRec: rec });
                                  }
                                });
                              });

                              // Convert to array and sort by confidence (best first)
                              const sortedBudgetItems = Array.from(uniqueBudgetItems.values())
                                .sort((a, b) => b.rec.confidence - a.rec.confidence);

                              // Generate the recommendations UI (limit to 4 for display)
                              return sortedBudgetItems.slice(0, 4).map((item, displayIndex) => {
                                const { budgetItem, rec } = item;
                                const budgetItemKey = `${rec.subCategoryId}-${budgetItem.budgetId}`;
                                
                                const displayName = budgetItem.description ? 
                                  `${rec.subCategoryName} (${budgetItem.description})` : 
                                  rec.subCategoryName;
                                
                                return (
                                  <Box
                                    key={budgetItemKey}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{
                                      p: COMPACT_SPACING.small,
                                      backgroundColor: displayIndex === 0 ? 'primary.light' : 'grey.50',
                                      borderRadius: 1,
                                      border: '1px solid',
                                      borderColor: displayIndex === 0 ? 'primary.main' : 'grey.200'
                                    }}
                                  >
                                    <Box flex={1}>
                                      <Box display="flex" alignItems="center" gap={COMPACT_SPACING.small}>
                                        <Typography variant="caption" fontWeight="bold">
                                          {truncateText(displayName, 35)}
                                        </Typography>
                                        <Chip
                                          icon={getRecommendationIcon(rec.confidence, rec.wouldExceedBudget)}
                                          label={`${rec.confidence}%`}
                                          size="small"
                                          color={getRecommendationChipColor(rec.confidence, rec.wouldExceedBudget)}
                                          sx={{ height: 18, fontSize: '0.6rem' }}
                                        />
                                        {displayIndex === 0 && (
                                          <Chip
                                            label="Best"
                                            size="small"
                                            color="primary"
                                            sx={{ height: 18, fontSize: '0.6rem' }}
                                          />
                                        )}
                                      </Box>
                                      <Typography variant="caption" color="text.secondary">
                                        {truncateText(rec.reason, 40)}
                                      </Typography>
                                    </Box>
                                    <Button
                                      size="small"
                                      variant={displayIndex === 0 ? "contained" : "outlined"}
                                      color={rec.wouldExceedBudget ? "warning" : "primary"}
                                      startIcon={isMoving ? <CircularProgress size={12} /> : <TrendingFlat />}
                                      onClick={() => moveExpenseToPlanned(expense.transactionId, rec.categoryId, rec.subCategoryId)}
                                      disabled={isMoving}
                                      sx={{ minWidth: 'auto', px: COMPACT_SPACING.small, py: 0.25 }}
                                    >
                                      Move
                                    </Button>
                                  </Box>
                                );
                              });
                            })()}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary" fontStyle="italic">
                            No recommendations available
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ProjectExpensesTableView;
