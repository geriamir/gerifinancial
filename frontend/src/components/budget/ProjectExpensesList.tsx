import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  Alert
} from '@mui/material';
import {
  Add
} from '@mui/icons-material';
import { formatCurrency } from '../../types/foreignCurrency';
import { CategoryBreakdownItem, UnplannedExpense, CategoryBudget } from '../../types/projects';
import ProjectExpensesViewToggle from '../project/ProjectExpensesViewToggle';
import ProjectExpensesTableView from '../project/ProjectExpensesTableView';
import ProjectExpensesListView from '../project/ProjectExpensesListView';
import AddPlannedExpenseDialog from '../project/AddPlannedExpenseDialog';
import { budgetsApi } from '../../services/api/budgets';

type ViewType = 'table' | 'list';

interface ProjectExpensesListProps {
  projectId?: string; // Add projectId for recommendations
  plannedExpenses: CategoryBreakdownItem[]; // Now contains enhanced data with grouped expenses
  unplannedExpenses: UnplannedExpense[];
  projectCurrency: string;
  projectType?: string; // Add project type to determine display logic
  availableCategories: Array<{
    _id: string;
    name: string;
    type: 'Income' | 'Expense' | 'Transfer';
    subCategories: Array<{
      _id: string;
      name: string;
      keywords: string[];
    }>;
  }>;
  // Editing handlers
  onEditPlannedExpense: (index: number, updates: Partial<CategoryBreakdownItem>) => void;
  onDeletePlannedExpense: (index: number) => void;
  onAddPlannedExpense: (expense: Partial<CategoryBudget>) => void; // Changed to accept expense data
  // Unplanned expense handlers
  onRemoveFromProject: (transactionId: string) => void;
  onExpensesMoved?: () => void; // Callback when expenses are moved to refresh data
  // Loading states
  loading?: boolean;
}

const ProjectExpensesList: React.FC<ProjectExpensesListProps> = ({
  projectId,
  plannedExpenses,
  unplannedExpenses,
  projectCurrency,
  projectType,
  availableCategories,
  onEditPlannedExpense,
  onDeletePlannedExpense,
  onAddPlannedExpense,
  onRemoveFromProject,
  onExpensesMoved,
  loading = false
}) => {
  const [movingExpense, setMovingExpense] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('table');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Calculate totals using enhanced CategoryBreakdownItem structure
  const totalPlannedBudget = plannedExpenses.reduce((sum, exp) => sum + exp.budgeted, 0);
  const totalPlannedActual = plannedExpenses.reduce((sum, exp) => sum + exp.actual, 0);
  const totalUnplannedAmount = unplannedExpenses.reduce((sum, exp) => sum + exp.convertedAmount, 0);
  const totalExpenses = totalPlannedActual + totalUnplannedAmount;

  const handleAddExpense = (expense: Partial<CategoryBudget>) => {
    onAddPlannedExpense(expense);
    setAddDialogOpen(false);
  };

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" color="error.main">
            Project Expenses
          </Typography>
          <ProjectExpensesViewToggle
            selectedView={currentView}
            onViewChange={setCurrentView}
          />
        </Box>

        <Box mt={3}>
          {/* Planned Expenses Section - Grouped by Subcategory */}
          <Box mb={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1" color="primary.main" fontWeight="bold">
                Planned Expenses
              </Typography>
              <Button
                startIcon={<Add />}
                onClick={() => setAddDialogOpen(true)}
                variant="outlined"
                size="small"
              >
                Add Item
              </Button>
            </Box>

            {!plannedExpenses || plannedExpenses.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No planned expenses yet. Click "Add Item" to create your first budget item.
              </Alert>
            ) : (
              <Box>
                {/* Render appropriate compact view */}
                {currentView === 'table' && (
                  <ProjectExpensesTableView
                    projectId={projectId}
                    plannedExpenses={plannedExpenses}
                    unplannedExpenses={unplannedExpenses}
                    projectCurrency={projectCurrency}
                    projectType={projectType}
                    onRemoveFromProject={onRemoveFromProject}
                    moveExpenseToPlanned={async (transactionId: string, categoryId: string, subCategoryId: string) => {
                      if (!projectId) {
                        console.error('Project ID is required to move expense');
                        return;
                      }

                      try {
                        setMovingExpense(transactionId);
                        await budgetsApi.moveExpenseToPlanned(projectId, transactionId, categoryId, subCategoryId);
                        
                        // Call refresh callback after successful move
                        if (onExpensesMoved) {
                          onExpensesMoved();
                        }
                      } catch (error) {
                        console.error('Failed to move expense to planned:', error);
                        // TODO: Show error message to user
                      } finally {
                        setMovingExpense(null);
                      }
                    }}
                    movingExpense={movingExpense}
                  />
                )}

                {currentView === 'list' && (
                  <ProjectExpensesListView
                    projectId={projectId}
                    plannedExpenses={plannedExpenses}
                    unplannedExpenses={unplannedExpenses}
                    projectCurrency={projectCurrency}
                    projectType={projectType}
                    onRemoveFromProject={onRemoveFromProject}
                    moveExpenseToPlanned={async (transactionId: string, categoryId: string, subCategoryId: string) => {
                      if (!projectId) {
                        console.error('Project ID is required to move expense');
                        return;
                      }

                      try {
                        setMovingExpense(transactionId);
                        await budgetsApi.moveExpenseToPlanned(projectId, transactionId, categoryId, subCategoryId);
                        
                        // Call refresh callback after successful move
                        if (onExpensesMoved) {
                          onExpensesMoved();
                        }
                      } catch (error) {
                        console.error('Failed to move expense to planned:', error);
                        // TODO: Show error message to user
                      } finally {
                        setMovingExpense(null);
                      }
                    }}
                    movingExpense={movingExpense}
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>

      {/* Add Planned Expense Dialog */}
      <AddPlannedExpenseDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddExpense}
        availableCategories={availableCategories}
        projectCurrency={projectCurrency}
        projectType={projectType}
      />
    </Card>
  );
};

export default ProjectExpensesList;
