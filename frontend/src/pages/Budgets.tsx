import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import {
  Calculate as CalculatorIcon
} from '@mui/icons-material';
import { useBudget } from '../contexts/BudgetContext';
import MonthlyBudgetEditor from '../components/budget/MonthlyBudgetEditor';
import PatternDetectionDashboard from '../components/budget/PatternDetection/PatternDetectionDashboard';
import MonthNavigation from '../components/budget/MonthNavigation';
import BudgetStatusChips from '../components/budget/BudgetStatusChips';
import BudgetColumn from '../components/budget/BudgetColumn';
import BudgetBalanceCard from '../components/budget/BudgetBalanceCard';
import ProjectBudgetsList from '../components/budget/ProjectBudgetsList';
import { budgetsApi } from '../services/api/budgets';
import { BUDGET_STAGES, type BudgetStage } from '../constants/budgetStages';

const BudgetsPage: React.FC = () => {
  const {
    currentMonthlyBudget,
    projectBudgets,
    loading,
    error,
    currentYear,
    currentMonth,
    setCurrentPeriod,
    calculateMonthlyBudget,
    refreshBudgets
  } = useBudget();

  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [patternRefreshTrigger, setPatternRefreshTrigger] = useState(0);
  const [budgetStage, setBudgetStage] = useState<BudgetStage>(BUDGET_STAGES.INITIAL);

  // Handle period navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentPeriod(currentYear - 1, 12);
    } else {
      setCurrentPeriod(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentPeriod(currentYear + 1, 1);
    } else {
      setCurrentPeriod(currentYear, currentMonth + 1);
    }
  };

  // Handle automated budget creation with smart workflow
  const handleAutoCalculate = async () => {
    try {
      console.log('🚀 BudgetsPage: Starting auto-calculate workflow');
      
      // If we're in the patterns-detected stage, use the reject-remaining-and-proceed endpoint
      if (budgetStage === BUDGET_STAGES.PATTERNS_DETECTED) {
        console.log('🔄 BudgetsPage: User wants to proceed - rejecting remaining patterns and calculating budget');
        
        const proceedResult = await budgetsApi.rejectRemainingPatternsAndProceed(currentYear, currentMonth, 6);
        
        if (proceedResult.success && proceedResult.step === 'budget-calculated') {
          console.log('✅ BudgetsPage: Successfully rejected remaining patterns and calculated budget');
          console.log(`📊 BudgetsPage: Auto-rejected ${proceedResult.autoRejectedPatterns || 0} patterns`);
          
          // Set stage to budget created
          setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
          
          // Force refresh to see the new budget
          await refreshBudgets();
          return;
        } else {
          console.error('❌ BudgetsPage: Failed to proceed with budget calculation:', proceedResult);
        }
        return;
      }
      
      // Otherwise, try normal smart budget calculation first
      const smartResult = await budgetsApi.smartCalculateMonthlyBudget(currentYear, currentMonth, 6);
      
      console.log('🔍 BudgetsPage: Smart budget result:', smartResult);
      
      if (smartResult.step === 'pattern-approval-required') {
        // User needs to approve existing pending patterns first
        console.log('⏸️ BudgetsPage: Pattern approval required - user should approve patterns first');
        // Force refresh to show any new patterns in the dashboard
        await refreshBudgets();
        return;
      }
      
      if (smartResult.step === 'pattern-detection-complete') {
        // New patterns were detected - show them to user
        console.log('🎯 BudgetsPage: New patterns detected:', smartResult.detectedPatterns?.length || 0);
        console.log('🎯 BudgetsPage: Pattern details:', smartResult.detectedPatterns);
        
        // Set stage to patterns detected
        setBudgetStage(BUDGET_STAGES.PATTERNS_DETECTED);
        
        // Force refresh to show the new patterns in the dashboard
        await refreshBudgets();
        
        // Trigger pattern dashboard refresh
        console.log('🔄 BudgetsPage: Setting refresh trigger from', patternRefreshTrigger, 'to', patternRefreshTrigger + 1);
        setPatternRefreshTrigger(prev => prev + 1);
        return;
      }
      
      if (smartResult.step === 'budget-calculated') {
        // Budget was calculated successfully
        console.log('✅ BudgetsPage: Smart budget calculated with pattern awareness:', smartResult.calculation);
        
        // Set stage to budget created
        setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
        
        // Force refresh to see the new budget
        await refreshBudgets();
        return;
      }
      
      console.log('❓ BudgetsPage: Unexpected smart result step:', smartResult.step);
      
    } catch (error) {
      console.error('❌ BudgetsPage: Smart budget calculation failed:', error);
      
      // Fallback to regular calculation if smart calculation fails
      try {
        console.log('🔄 BudgetsPage: Falling back to regular budget calculation');
        await calculateMonthlyBudget(currentYear, currentMonth, 6);
        await refreshBudgets();
      } catch (fallbackError) {
        console.error('❌ BudgetsPage: Failed to auto-calculate budget:', fallbackError);
      }
    }
  };

  // Budget editor handlers
  const handleEditBudget = () => {
    setBudgetEditorOpen(true);
  };

  const handleViewDetails = () => {
    // TODO: Implement view details
    console.log('View details clicked');
  };

  const handleRecalculate = () => {
    handleAutoCalculate();
  };

  const handleBudgetSaved = () => {
    // Context will automatically refresh
    setBudgetEditorOpen(false);
  };

  const handleNewProject = () => {
    // TODO: Implement new project creation
    console.log('New project clicked');
  };

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  // Show different content based on budget stage
  // Handle API response format {success: true, data: null}
  const hasBudget = currentMonthlyBudget && (currentMonthlyBudget._id || (currentMonthlyBudget as any).data);
  if (!hasBudget) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Budget Management
          </Typography>
          {budgetStage === BUDGET_STAGES.PATTERNS_DETECTED && (
            <Button
              variant="contained"
              size="large"
              startIcon={<CalculatorIcon />}
              onClick={handleAutoCalculate}
              disabled={loading}
              sx={{ py: 1.5, px: 4 }}
            >
              Create Smart Budget
            </Button>
          )}
        </Box>

        {/* Stage 1: Initial - Show only Auto-Calculate button */}
        {budgetStage === BUDGET_STAGES.INITIAL && (
          <Card>
            <CardContent>
              <Box textAlign="center" py={8}>
                <Typography variant="body1" color="text.secondary" mb={4}>
                  Create your first budget to start tracking your income and expenses
                </Typography>
                
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<CalculatorIcon />}
                  onClick={handleAutoCalculate}
                  disabled={loading}
                  sx={{ py: 1.5, px: 4 }}
                >
                  Auto-Calculate Budget
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Stage 2: Patterns Detected - Show pattern approval dashboard */}
        {budgetStage === BUDGET_STAGES.PATTERNS_DETECTED && (
          <>
            {/* Guidance text above patterns */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Box textAlign="center" py={4}>
                  <Typography variant="h6" color="primary" mb={2}>
                    Patterns Detected!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" mb={2}>
                    Review and approve the spending patterns below, or click "Create Smart Budget" to proceed.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Any unapproved patterns will be automatically rejected when you create the budget.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            
            {/* Pattern Dashboard */}
            <PatternDetectionDashboard sx={{ mb: 4 }} refreshTrigger={patternRefreshTrigger} />
          </>
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Budget Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<CalculatorIcon />}
          onClick={handleAutoCalculate}
          disabled={loading}
        >
          Auto-Calculate Budget
        </Button>
      </Box>

      {/* Month Navigation */}
      <MonthNavigation
        currentYear={currentYear}
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        loading={loading}
      />

      {/* Budget Status */}
      {currentMonthlyBudget && (
        <BudgetStatusChips
          status={currentMonthlyBudget.status}
          isAutoCalculated={currentMonthlyBudget.isAutoCalculated}
          onEditBudget={handleEditBudget}
          onViewDetails={handleViewDetails}
          onRecalculate={handleRecalculate}
        />
      )}

      {/* Main Content - Two Column Layout */}
      <Box sx={{
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        gap: 3 
      }}>
        {/* Income Column */}
        <BudgetColumn
          title="Income"
          color="success"
          totalBudgeted={currentMonthlyBudget?.totalBudgetedIncome || 0}
          totalActual={currentMonthlyBudget?.totalActualIncome || 0}
          currentMonthlyBudget={currentMonthlyBudget}
          currentYear={currentYear}
          currentMonth={currentMonth}
          type="income"
        />

        {/* Expenses Column */}
        <BudgetColumn
          title="Expenses"
          color="error"
          totalBudgeted={currentMonthlyBudget?.totalBudgetedExpenses || 0}
          totalActual={currentMonthlyBudget?.totalActualExpenses || 0}
          currentMonthlyBudget={currentMonthlyBudget}
          currentYear={currentYear}
          currentMonth={currentMonth}
          type="expense"
        />
      </Box>

      {/* Budget Balance Summary */}
      {currentMonthlyBudget && (
        <BudgetBalanceCard budgetBalance={currentMonthlyBudget.budgetBalance} />
      )}

      {/* Project Budgets Section */}
      <ProjectBudgetsList
        projectBudgets={projectBudgets}
        loading={loading}
        onNewProject={handleNewProject}
      />

      {/* Monthly Budget Editor Dialog */}
      <MonthlyBudgetEditor
        open={budgetEditorOpen}
        budget={currentMonthlyBudget}
        year={currentYear}
        month={currentMonth}
        onClose={() => setBudgetEditorOpen(false)}
        onSave={handleBudgetSaved}
      />
    </Container>
  );
};

export default BudgetsPage;
