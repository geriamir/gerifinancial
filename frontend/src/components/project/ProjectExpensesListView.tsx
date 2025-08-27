import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  IconButton,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Avatar,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Delete,
  TrendingFlat,
  CheckCircle,
  Warning,
  Info,
  Category,
  Receipt,
  AccountBalance
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

interface ProjectExpensesListViewProps {
  projectId?: string;
  plannedExpenses: CategoryBreakdownItem[];
  unplannedExpenses: UnplannedExpense[];
  projectCurrency: string;
  projectType?: string;
  onRemoveFromProject: (transactionId: string) => void;
  moveExpenseToPlanned: (transactionId: string, categoryId: string, subCategoryId: string) => Promise<void>;
  movingExpense: string | null;
}

const ProjectExpensesListView: React.FC<ProjectExpensesListViewProps> = ({
  projectId,
  plannedExpenses,
  unplannedExpenses,
  projectCurrency,
  projectType,
  onRemoveFromProject,
  moveExpenseToPlanned,
  movingExpense
}) => {
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [expandedUnplanned, setExpandedUnplanned] = useState<Set<string>>(new Set());

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
    <Box>
      <List dense disablePadding sx={{ '& .MuiListItem-root': { py: COMPACT_SPACING.minimal } }}>
        {/* Planned Expenses */}
        {Object.values(groupedBySubcategory).map((group, groupIndex) => {
          const totalBudgeted = group.budgetItems.reduce((sum, item) => sum + item.budgeted, 0);
          const totalActual = group.budgetItems.reduce((sum, item) => sum + item.actual, 0);
          const isExpanded = expandedSubcategories.has(group.subcategory._id);

          return (
            <React.Fragment key={group.subcategory._id}>
              {/* Subcategory Header */}
              <ListItemButton
                onClick={() => toggleSubcategory(group.subcategory._id)}
                sx={{
                  py: COMPACT_SPACING.small
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Avatar sx={{ width: 24, height: 24, backgroundColor: 'primary.main' }}>
                    <Category sx={{ fontSize: 14 }} />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight="bold" color="primary.dark">
                      {projectType === 'vacation' && group.category.name === 'Travel' 
                        ? group.subcategory.name 
                        : `${group.category.name} → ${group.subcategory.name}`}
                    </Typography>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {formatCompactCurrency(totalActual, projectCurrency)} / {formatCompactCurrency(totalBudgeted, projectCurrency)}
                      </Typography>
                      <Box sx={{ flex: 1, maxWidth: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={getCompactProgressWidth(totalActual, totalBudgeted)}
                          sx={{
                            height: 4,
                            borderRadius: 1,
                            backgroundColor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: getCompactProgressColor(totalActual, totalBudgeted)
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>

              {/* Budget Items and Transactions */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding dense>
                  {group.budgetItems.map((budgetItem, budgetIndex) => (
                    <React.Fragment key={budgetItem.budgetId}>
                      {/* Budget Item Header (if has description or multiple budget items) */}
                      {(budgetItem.description || group.budgetItems.length > 1) && (
                        <ListItem
                          sx={{
                            pl: 4
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <AccountBalance sx={{ fontSize: 14, color: 'primary.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight="medium" color="text.primary">
                                {budgetItem.description || `Budget Item ${budgetIndex + 1}`}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {formatCompactCurrency(budgetItem.actual, budgetItem.currency)} / {formatCompactCurrency(budgetItem.budgeted, budgetItem.currency)}
                              </Typography>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Box sx={{ width: 60 }}>
                              <LinearProgress
                                variant="determinate"
                                value={getCompactProgressWidth(budgetItem.actual, budgetItem.budgeted)}
                                sx={{
                                  height: 3,
                                  borderRadius: 1,
                                  backgroundColor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: getCompactProgressColor(budgetItem.actual, budgetItem.budgeted)
                                  }
                                }}
                              />
                            </Box>
                          </ListItemSecondaryAction>
                        </ListItem>
                      )}
                      
                      {/* Individual Transactions for this Budget Item */}
                      {budgetItem.expenses.map((expense, expenseIndex) => (
                        <ListItem
                          key={expense._id || expenseIndex}
                          sx={{
                            pl: (budgetItem.description || group.budgetItems.length > 1) ? 8 : 6
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <Receipt sx={{ fontSize: 14, color: 'text.secondary' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2">
                                {truncateText(expense.description || 'Transaction', 25)}
                              </Typography>
                            }
                            secondary={formatCompactDate(expense.date)}
                          />
                          <ListItemSecondaryAction>
                            <Typography variant="body2" color="primary.main" fontWeight="medium">
                              {formatCompactCurrency(Math.abs(expense.amount), expense.currency)}
                            </Typography>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </React.Fragment>
                  ))}
                </List>
              </Collapse>

              {groupIndex < Object.values(groupedBySubcategory).length - 1 && (
                <Divider sx={{ mx: 2 }} />
              )}
            </React.Fragment>
          );
        })}

        {/* Section Divider */}
        {plannedExpenses.length > 0 && unplannedExpenses.length > 0 && (
          <>
            <Divider sx={{ my: COMPACT_SPACING.medium }} />
            <ListItem sx={{ py: COMPACT_SPACING.small }}>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight="bold" color="warning.dark" textAlign="center">
                    Unplanned Expenses ({unplannedExpenses.length})
                  </Typography>
                }
              />
            </ListItem>
            <Divider />
          </>
        )}

        {/* Unplanned Expenses */}
        {unplannedExpenses.map((expense, expenseIndex) => {
          const isExpanded = expandedUnplanned.has(expense.transactionId);
          const isMoving = movingExpense === expense.transactionId;

          return (
            <React.Fragment key={expense.transactionId}>
              {/* Unplanned Expense Item */}
              <ListItemButton
                onClick={() => toggleUnplanned(expense.transactionId)}
                sx={{
                  opacity: isMoving ? 0.7 : 1,
                  py: COMPACT_SPACING.small
                }}
                disabled={isMoving}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Avatar sx={{ width: 24, height: 24, backgroundColor: 'warning.main' }}>
                    <AccountBalance sx={{ fontSize: 14 }} />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {truncateText(expense.transaction.chargedAccount || expense.transaction.description || 'Transaction', 25)}
                      </Typography>
                      {expense.recommendations && expense.recommendations.length > 0 && (
                        <Chip
                          label={`${expense.recommendations.length} rec`}
                          size="small"
                          color="info"
                          sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" color="text.secondary">
                        {formatCompactDate(expense.transactionDate)} • {expense.category.name} → {expense.subCategory.name}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Box textAlign="right" mr={1}>
                      <Typography variant="body2" color="warning.dark" fontWeight="medium">
                        {formatCompactCurrency(expense.originalAmount, expense.originalCurrency)}
                      </Typography>
                    </Box>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromProject(expense.transactionId);
                      }}
                      sx={{ color: 'error.main' }}
                      disabled={isMoving}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton edge="end" size="small">
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItemButton>

              {/* Recommendations */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ p: COMPACT_SPACING.medium, mx: 2, borderRadius: 1 }}>
                  {expense.recommendations && expense.recommendations.length > 0 ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Recommendations:
                      </Typography>
                      <List dense disablePadding>
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
                              <ListItem
                                key={budgetItemKey}
                                sx={{
                                  p: COMPACT_SPACING.small,
                                  backgroundColor: displayIndex === 0 ? 'primary.light' : 'grey.50',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: displayIndex === 0 ? 'primary.main' : 'grey.200',
                                  mb: COMPACT_SPACING.small
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                  {getRecommendationIcon(rec.confidence, rec.wouldExceedBudget)}
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Typography variant="caption" fontWeight="bold">
                                        {truncateText(displayName, 15)}
                                      </Typography>
                                      <Chip
                                        label={`${rec.confidence}%`}
                                        size="small"
                                        color={getRecommendationChipColor(rec.confidence, rec.wouldExceedBudget)}
                                        sx={{ height: 16, fontSize: '0.55rem' }}
                                      />
                                      {displayIndex === 0 && (
                                        <Chip
                                          label="Best"
                                          size="small"
                                          color="primary"
                                          sx={{ height: 16, fontSize: '0.55rem' }}
                                        />
                                      )}
                                    </Box>
                                  }
                                  secondary={
                                    <Typography variant="caption" color="text.secondary">
                                      {truncateText(rec.reason, 35)}
                                    </Typography>
                                  }
                                />
                                <ListItemSecondaryAction>
                                  <Button
                                    size="small"
                                    variant={displayIndex === 0 ? "contained" : "outlined"}
                                    color={rec.wouldExceedBudget ? "warning" : "primary"}
                                    startIcon={isMoving ? <CircularProgress size={10} /> : <TrendingFlat />}
                                    onClick={() => moveExpenseToPlanned(expense.transactionId, rec.categoryId, rec.subCategoryId)}
                                    disabled={isMoving}
                                    sx={{ 
                                      minWidth: 'auto', 
                                      px: COMPACT_SPACING.small, 
                                      py: 0.25,
                                      fontSize: '0.6rem'
                                    }}
                                  >
                                    Move
                                  </Button>
                                </ListItemSecondaryAction>
                              </ListItem>
                            );
                          });
                        })()}
                      </List>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                      No recommendations available
                    </Typography>
                  )}
                </Box>
              </Collapse>

              {expenseIndex < unplannedExpenses.length - 1 && (
                <Divider sx={{ mx: 2 }} />
              )}
            </React.Fragment>
          );
        })}
      </List>
    </Box>
  );
};

export default ProjectExpensesListView;
