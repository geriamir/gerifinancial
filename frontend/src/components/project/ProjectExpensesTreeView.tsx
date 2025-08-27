import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  ExpandMore,
  ChevronRight,
  Delete,
  TrendingFlat,
  CheckCircle,
  Warning,
  Info,
  Category,
  Receipt,
  AccountBalance
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

interface ProjectExpensesTreeViewProps {
  projectId?: string;
  plannedExpenses: CategoryBreakdownItem[];
  unplannedExpenses: UnplannedExpense[];
  projectCurrency: string;
  projectType?: string;
  onRemoveFromProject: (transactionId: string) => void;
  moveExpenseToPlanned: (transactionId: string, categoryId: string, subCategoryId: string) => Promise<void>;
  movingExpense: string | null;
}

const ProjectExpensesTreeView: React.FC<ProjectExpensesTreeViewProps> = ({
  projectId,
  plannedExpenses,
  unplannedExpenses,
  projectCurrency,
  projectType,
  onRemoveFromProject,
  moveExpenseToPlanned,
  movingExpense
}) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  const handleToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
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
    if (wouldExceedBudget) return <Warning sx={{ fontSize: 10 }} />;
    if (confidence >= 95) return <CheckCircle sx={{ fontSize: 10 }} />;
    return <Info sx={{ fontSize: 10 }} />;
  };

  return (
    <Box>
      <SimpleTreeView
        expandedItems={expanded}
        onExpandedItemsChange={(event, itemIds) => setExpanded(itemIds)}
        sx={{
          flexGrow: 1,
          '& .MuiTreeItem-root': {
            '& .MuiTreeItem-content': {
              py: COMPACT_SPACING.minimal,
              px: COMPACT_SPACING.small,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'grey.100'
              },
              '&.Mui-focused': {
                backgroundColor: 'grey.200'
              }
            },
            '& .MuiTreeItem-label': {
              fontSize: '0.75rem'
            }
          }
        }}
      >
        {/* Planned Expenses Root */}
        <TreeItem 
          itemId="planned-root" 
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <Category sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight="bold" color="primary.main">
                Planned Expenses
              </Typography>
            </Box>
          }
        >
          {Object.values(groupedBySubcategory).map((group) => {
            const totalBudgeted = group.budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
            const totalActual = group.budgetItems.reduce((sum, item) => sum + item.actual, 0);
            const totalExpenseCount = group.budgetItems.reduce((sum, item) => sum + item.expenseCount, 0);

            return (
              <TreeItem
                key={group.subcategory._id}
                itemId={`subcategory-${group.subcategory._id}`}
                label={
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                    <Box display="flex" alignItems="center" gap={1} flex={1}>
                      <Typography variant="caption" fontWeight="bold" color="primary.dark">
                        {projectType === 'vacation' && group.category.name === 'Travel' 
                          ? group.subcategory.name 
                          : `${group.category.name} → ${group.subcategory.name}`}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} mr={2}>
                      <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                        {formatCompactCurrency(totalActual, projectCurrency, 8)}
                      </Typography>
                      <Box sx={{ width: 40 }}>
                        <LinearProgress
                          variant="determinate"
                          value={getCompactProgressWidth(totalActual, totalBudgeted)}
                          sx={{
                            height: 2,
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
                }
              >
                {group.budgetItems.map((budgetItem) => (
                  <TreeItem
                    key={budgetItem.budgetId}
                    itemId={`budget-item-${budgetItem.budgetId}`}
                    label={
                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                        <Box display="flex" alignItems="center" gap={0.5} flex={1}>
                          <AccountBalance sx={{ fontSize: 12, color: 'secondary.main' }} />
                          <Typography variant="caption" fontWeight="medium" fontSize="0.65rem" color="secondary.dark">
                            {budgetItem.description || 'Budget Item'}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={0.5} mr={2}>
                          <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                            {formatCompactCurrency(budgetItem.actual, projectCurrency, 8)} / {formatCompactCurrency(budgetItem.budgeted, projectCurrency, 8)}
                          </Typography>
                          <Box sx={{ width: 30 }}>
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
                      </Box>
                    }
                  >
                    {budgetItem.expenses.map((expense, expenseIndex) => (
                      <TreeItem
                        key={expense._id || expenseIndex}
                        itemId={`expense-${expense._id || expenseIndex}`}
                        label={
                          <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                            <Box display="flex" alignItems="center" gap={0.5} flex={1}>
                              <Receipt sx={{ fontSize: 12, color: 'text.secondary' }} />
                              <Typography variant="caption" fontSize="0.65rem">
                                {truncateText(expense.description || 'Transaction', 20)}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={0.5} mr={2}>
                              <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                                {formatCompactDate(expense.date)}
                              </Typography>
                              <Typography variant="caption" color="primary.main" fontWeight="medium" fontSize="0.6rem">
                                {formatCompactCurrency(Math.abs(expense.amount), expense.currency, 8)}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            );
          })}
        </TreeItem>

        {/* Unplanned Expenses Root */}
        {unplannedExpenses.length > 0 && (
          <TreeItem 
            itemId="unplanned-root" 
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <AccountBalance sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="body2" fontWeight="bold" color="warning.main">
                  Unplanned Expenses
                </Typography>
              </Box>
            }
          >
            {unplannedExpenses.map((expense) => {
              const isMoving = movingExpense === expense.transactionId;

              return (
                <TreeItem
                  key={expense.transactionId}
                  itemId={`unplanned-${expense.transactionId}`}
                  label={
                    <Box 
                      display="flex" 
                      alignItems="center" 
                      justifyContent="space-between" 
                      width="100%"
                      sx={{ opacity: isMoving ? 0.7 : 1 }}
                    >
                      <Box display="flex" alignItems="center" gap={0.5} flex={1}>
                        <Typography variant="caption" fontWeight="medium" fontSize="0.65rem">
                          {truncateText(expense.transaction.chargedAccount || expense.transaction.description || 'Transaction', 18)}
                        </Typography>
                        {expense.recommendations && expense.recommendations.length > 0 && (
                          <Chip
                            label={`${expense.recommendations.length}r`}
                            size="small"
                            color="info"
                            sx={{ height: 10, fontSize: '0.45rem' }}
                          />
                        )}
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.25} mr={2}>
                        <Typography variant="caption" color="text.secondary" fontSize="0.55rem">
                          {formatCompactDate(expense.transactionDate)}
                        </Typography>
                        <Typography variant="caption" color="warning.dark" fontWeight="medium" fontSize="0.6rem">
                          {formatCompactCurrency(expense.originalAmount, expense.originalCurrency, 8)}
                        </Typography>
                        <Tooltip title="Remove from project">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFromProject(expense.transactionId);
                            }}
                            sx={{ color: 'error.main', p: 0.125 }}
                            disabled={isMoving}
                          >
                            <Delete sx={{ fontSize: 10 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  }
                >
                  {/* Recommendations as child nodes */}
                  {expense.recommendations && expense.recommendations.length > 0 && 
                    expense.recommendations.slice(0, 3).map((rec, index) => (
                      <TreeItem
                        key={`rec-${rec.categoryId}-${rec.subCategoryId}`}
                        itemId={`rec-${expense.transactionId}-${index}`}
                        label={
                          <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                            <Box display="flex" alignItems="center" gap={0.25} flex={1}>
                              {getRecommendationIcon(rec.confidence, rec.wouldExceedBudget)}
                              <Typography variant="caption" fontWeight="bold" fontSize="0.6rem">
                                {truncateText(rec.subCategoryName, 12)}
                              </Typography>
                              <Chip
                                label={`${rec.confidence}%`}
                                size="small"
                                color={getRecommendationChipColor(rec.confidence, rec.wouldExceedBudget)}
                                sx={{ height: 10, fontSize: '0.45rem' }}
                              />
                              {index === 0 && (
                                <Chip
                                  label="★"
                                  size="small"
                                  color="primary"
                                  sx={{ height: 10, fontSize: '0.45rem' }}
                                />
                              )}
                            </Box>
                            <Box mr={2}>
                              <Tooltip title={`Move to ${rec.subCategoryName}${rec.wouldExceedBudget ? ' (would exceed budget)' : ''}`}>
                                <Button
                                  size="small"
                                  variant={index === 0 ? "contained" : "outlined"}
                                  color={rec.wouldExceedBudget ? "warning" : "primary"}
                                  startIcon={isMoving ? <CircularProgress size={6} /> : <TrendingFlat />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveExpenseToPlanned(expense.transactionId, rec.categoryId, rec.subCategoryId);
                                  }}
                                  disabled={isMoving}
                                  sx={{ 
                                    minWidth: 'auto', 
                                    px: COMPACT_SPACING.minimal, 
                                    py: 0.125,
                                    fontSize: '0.5rem',
                                    height: 16
                                  }}
                                >
                                  Move
                                </Button>
                              </Tooltip>
                            </Box>
                          </Box>
                        }
                      />
                    ))
                  }
                  
                  {/* More recommendations indicator */}
                  {expense.recommendations && expense.recommendations.length > 3 && (
                    <TreeItem
                      itemId={`more-rec-${expense.transactionId}`}
                      label={
                        <Typography variant="caption" color="text.secondary" fontSize="0.55rem" fontStyle="italic">
                          +{expense.recommendations.length - 3} more recommendations
                        </Typography>
                      }
                    />
                  )}
                </TreeItem>
              );
            })}
          </TreeItem>
        )}
      </SimpleTreeView>
    </Box>
  );
};

export default ProjectExpensesTreeView;
