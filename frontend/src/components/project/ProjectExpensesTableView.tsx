import React, { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Typography,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  Select,
  MenuItem,
  FormControl} from '@mui/material';
import {
  Delete,
  TrendingFlat,
  Warning,
  Undo
} from '@mui/icons-material';
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
  moveExpenseToPlanned: (transactionId: string, categoryId: string, subCategoryId: string, budgetId?: string) => Promise<void>;
  onUnassignExpense?: (transactionId: string) => Promise<void>;
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
  onUnassignExpense,
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

  // Auto-expand new subcategories when plannedExpenses changes
  React.useEffect(() => {
    const currentSubcategoryIds = new Set<string>();
    plannedExpenses.forEach(expense => {
      if (expense.subCategoryId?._id) {
        currentSubcategoryIds.add(expense.subCategoryId._id);
      }
    });
    
    // Check if there are any new subcategories that aren't in the expanded set
    const hasNewSubcategories = Array.from(currentSubcategoryIds).some(
      id => !expandedSubcategories.has(id)
    );
    
    // If there are new subcategories, expand them
    if (hasNewSubcategories) {
      setExpandedSubcategories(currentSubcategoryIds);
    }
  }, [plannedExpenses, expandedSubcategories]);

  const toggleSubcategory = (subcategoryId: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategoryId)) {
      newExpanded.delete(subcategoryId);
    } else {
      newExpanded.add(subcategoryId);
    }
    setExpandedSubcategories(newExpanded);
  };

  // Track custom target overrides per unplanned expense (key: transactionId, value: "categoryId|subCategoryId|budgetId")
  const [customTargets, setCustomTargets] = useState<Record<string, string>>({});

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

  // Index planned expenses by subCategoryId for O(1) lookup in recommendation matching
  const plannedBySubCategory = useMemo(() => {
    const map = new Map<string, CategoryBreakdownItem[]>();
    plannedExpenses.forEach(item => {
      const key = item.subCategoryId._id;
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    });
    return map;
  }, [plannedExpenses]);

  // Helper to build a display label for a budget item
  const budgetItemLabel = (item: CategoryBreakdownItem) => {
    const catSub = `${item.categoryId.name} → ${item.subCategoryId.name}`;
    return item.description ? `${catSub} — ${item.description}` : catSub;
  };

  return (
    <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: COMPACT_SPACING.small, px: COMPACT_SPACING.medium } }}>
        <TableBody>
          {/* Planned Expenses */}
          {Object.values(groupedBySubcategory).map((group) => {
            // Use converted amounts in project currency for totals
            const totalBudgeted = group.budgetItems.reduce((sum, item) => 
              sum + (item.budgetedInProjectCurrency ?? item.budgeted), 0);
            const totalActual = group.budgetItems.reduce((sum, item) => 
              sum + (item.actualInProjectCurrency ?? item.actual), 0);
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
                          backgroundColor: 'action.selected',
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
                            <React.Fragment key={budgetItem.budgetId || `budget-${group.subcategory._id}-${budgetIndex}`}>
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
                                          backgroundColor: 'action.selected',
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
                                  <TableCell>
                                    {onUnassignExpense && expense._id && (
                                      <IconButton
                                        size="small"
                                        onClick={() => onUnassignExpense(expense._id)}
                                        title="Unassign from this category"
                                        sx={{ color: 'warning.main', p: 0 }}
                                      >
                                        <Undo sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    )}
                                  </TableCell>
                                  <TableCell align="right" sx={{ minWidth: 120 }}>
                                    <Typography variant="body2" color="primary.main">
                                      {formatCompactCurrency(-expense.amount, expense.currency, 20)}
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
            const isMoving = movingExpense === expense.transactionId;
            const customTarget = customTargets[expense.transactionId];

            // Build recommendation list matched to specific budget items
            const recBudgetItems: Array<{ budgetItem: CategoryBreakdownItem; rec: any }> = [];
            (expense.recommendations || []).forEach((rec: any) => {
              const matchingBudgetItems = plannedBySubCategory.get(rec.subCategoryId) || [];
              matchingBudgetItems.forEach((budgetItem) => {
                const existing = recBudgetItems.find(r => r.budgetItem.budgetId === budgetItem.budgetId);
                if (!existing || (existing.rec.confidence || 0) < rec.confidence) {
                  if (existing) {
                    existing.rec = rec;
                  } else {
                    recBudgetItems.push({ budgetItem, rec });
                  }
                }
              });
            });
            const sortedRecs = recBudgetItems.sort((a, b) => b.rec.confidence - a.rec.confidence);
            const recBudgetIds = new Set(sortedRecs.map(r => r.budgetItem.budgetId));

            // Determine what will actually be moved
            let moveTargetCategoryId: string | null = null;
            let moveTargetSubCategoryId: string | null = null;
            let moveTargetBudgetId: string | undefined = undefined;
            let moveTargetLabel = '';

            if (customTarget) {
              const [catId, subCatId, budId] = customTarget.split('|');
              moveTargetCategoryId = catId;
              moveTargetSubCategoryId = subCatId;
              moveTargetBudgetId = budId || undefined;
              const match = plannedExpenses.find(p => p.budgetId === budId);
              moveTargetLabel = match ? budgetItemLabel(match) : 'Custom';
            } else if (sortedRecs.length > 0) {
              const best = sortedRecs[0];
              moveTargetCategoryId = best.rec.categoryId;
              moveTargetSubCategoryId = best.rec.subCategoryId;
              moveTargetBudgetId = best.budgetItem.budgetId;
              moveTargetLabel = budgetItemLabel(best.budgetItem);
            }

            return (
              <React.Fragment key={expense.transactionId}>
                {/* Unplanned expense card row */}
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
                    <Box sx={{
                      m: COMPACT_SPACING.small,
                      p: COMPACT_SPACING.medium,
                      border: '1px solid',
                      borderColor: 'warning.light',
                      borderRadius: 1,
                      backgroundColor: 'warning.50',
                      opacity: isMoving ? 0.7 : 1
                    }}>
                      {/* Expense header */}
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box flex={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {expense.transaction.chargedAccount || expense.transaction.description || 'Transaction'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {expense.category.name} → {expense.subCategory.name} · {formatCompactDate(expense.transactionDate)}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" color="warning.dark" fontWeight="bold">
                            {formatCompactCurrency(-expense.originalAmount, expense.originalCurrency, 20)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => onRemoveFromProject(expense.transactionId)}
                            sx={{ color: 'error.main', p: 0 }}
                            disabled={isMoving}
                            title="Remove from project"
                          >
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>

                      {/* Assign to section */}
                      <Box sx={{
                        p: COMPACT_SPACING.small,
                        backgroundColor: 'background.paper',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>
                          Assign to:
                        </Typography>

                        {/* Target selector — dropdown of all planned categories + recommendations */}
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <FormControl size="small" sx={{ minWidth: 250, flex: 1 }}>
                            <Select
                              value={customTarget || (sortedRecs.length > 0 ? `${sortedRecs[0].rec.categoryId}|${sortedRecs[0].rec.subCategoryId}|${sortedRecs[0].budgetItem.budgetId}` : '')}
                              onChange={(e) => {
                                setCustomTargets(prev => ({ ...prev, [expense.transactionId]: e.target.value as string }));
                              }}
                              displayEmpty
                              sx={{ fontSize: '0.8rem', height: 32 }}
                            >
                              {sortedRecs.length > 0 && (
                                <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: '1 !important' }}>
                                  — Recommendations —
                                </MenuItem>
                              )}
                              {sortedRecs.map(({ budgetItem, rec }) => (
                                <MenuItem key={`rec-${budgetItem.budgetId}`} value={`${rec.categoryId}|${rec.subCategoryId}|${budgetItem.budgetId}`}>
                                  <Box display="flex" alignItems="center" gap={0.5} width="100%">
                                    <Typography variant="body2" sx={{ flex: 1 }}>
                                      {budgetItemLabel(budgetItem)}
                                    </Typography>
                                    <Chip
                                      label={`${rec.confidence}%`}
                                      size="small"
                                      color={getRecommendationChipColor(rec.confidence, rec.wouldExceedBudget)}
                                      sx={{ height: 18, fontSize: '0.6rem' }}
                                    />
                                    {rec.wouldExceedBudget && (
                                      <Warning sx={{ fontSize: 14, color: 'warning.main' }} />
                                    )}
                                  </Box>
                                </MenuItem>
                              ))}
                              {plannedExpenses.length > 0 && (
                                <MenuItem disabled sx={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: '1 !important' }}>
                                  — All planned items —
                                </MenuItem>
                              )}
                              {plannedExpenses
                                .filter(p => !recBudgetIds.has(p.budgetId))
                                .map(p => (
                                  <MenuItem key={`plan-${p.budgetId}`} value={`${p.categoryId._id}|${p.subCategoryId._id}|${p.budgetId}`}>
                                    <Typography variant="body2">
                                      {budgetItemLabel(p)}
                                    </Typography>
                                  </MenuItem>
                                ))
                              }
                              {plannedExpenses.length === 0 && sortedRecs.length === 0 && (
                                <MenuItem disabled>
                                  <Typography variant="body2" color="text.secondary">No planned items available</Typography>
                                </MenuItem>
                              )}
                            </Select>
                          </FormControl>

                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={isMoving ? <CircularProgress size={14} /> : <TrendingFlat />}
                            onClick={() => {
                              if (moveTargetCategoryId && moveTargetSubCategoryId) {
                                moveExpenseToPlanned(expense.transactionId, moveTargetCategoryId, moveTargetSubCategoryId, moveTargetBudgetId);
                              }
                            }}
                            disabled={isMoving || !moveTargetCategoryId}
                            sx={{ whiteSpace: 'nowrap', height: 32 }}
                          >
                            Assign
                          </Button>
                        </Box>

                        {/* Show what will happen */}
                        {moveTargetLabel && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Will assign to: <strong>{moveTargetLabel}</strong>
                          </Typography>
                        )}
                      </Box>
                    </Box>
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
