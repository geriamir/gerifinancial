import React, { useState, useEffect } from 'react';
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
import { useProject } from '../contexts/ProjectContext';
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
    loading,
    error,
    currentYear,
    currentMonth,
    setCurrentPeriod,
    calculateMonthlyBudget,
    refreshBudgets
  } = useBudget();

  const { projects: projectBudgets, loading: projectsLoading } = useProject();

  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [patternRefreshTrigger, setPatternRefreshTrigger] = useState(0);
  const [budgetStage, setBudgetStage] = useState<BudgetStage>(BUDGET_STAGES.INITIAL);
  const [patternsChecked, setPatternsChecked] = useState(false);

  // Check for pending patterns on mount and when budget changes
  useEffect(() => {
    // Check if we have a real budget (not just an empty response wrapper)
    const hasRealBudget = currentMonthlyBudget && 
                          (currentMonthlyBudget._id || 
                           ((currentMonthlyBudget as any).data && (currentMonthlyBudget as any).data._id));
    
    const checkPendingPatterns = async () => {
      try {
        const response = await budgetsApi.getPendingPatterns();
        const count = response.count || 0;
        setPatternsChecked(true);
        
        // Update budget stage based on server state
        // BUT: Don't override if we're already in PATTERNS_DETECTED stage with a count
        // (this prevents race conditions when patterns were just detected)
        if (count > 0) {
          setBudgetStage(BUDGET_STAGES.PATTERNS_DETECTED);
        } else if (!hasRealBudget && budgetStage !== BUDGET_STAGES.PATTERNS_DETECTED) {
          // Only reset to INITIAL if we're not already showing patterns
          setBudgetStage(BUDGET_STAGES.INITIAL);
        } else if (hasRealBudget) {
          setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
        }
      } catch (error) {
        console.error('Failed to check pending patterns:', error);
        setPatternsChecked(true);
        // Default to initial if we can't check - show the button
        setBudgetStage(hasRealBudget ? BUDGET_STAGES.BUDGET_CREATED : BUDGET_STAGES.INITIAL);
      }
    };

    // Only check if we don't have a real budget
    if (!hasRealBudget) {
      checkPendingPatterns();
    } else {
      setPatternsChecked(true);
      setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
    }
  }, [currentMonthlyBudget, patternRefreshTrigger]);

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
        // Update pending patterns count immediately from the result
        
        // Update pending patterns count immediately from the result
        setPatternsChecked(true);
        
        // Set stage to patterns detected
        setBudgetStage(BUDGET_STAGES.PATTERNS_DETECTED);
        
        // Trigger pattern dashboard refresh (this will fetch the patterns from the backend)
        console.log('🔄 BudgetsPage: Setting refresh trigger from', patternRefreshTrigger, 'to', patternRefreshTrigger + 1);
        setPatternRefreshTrigger(prev => prev + 1);
        
        // DON'T call refreshBudgets() here - there's no budget to refresh yet!
        // The pattern dashboard will fetch patterns independently
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
  // Check if we have a real budget with actual data (not just {success: true, data: null})
  const hasBudget = currentMonthlyBudget && 
                    (currentMonthlyBudget._id || 
                     ((currentMonthlyBudget as any).data && (currentMonthlyBudget as any).data._id));
  
  // Debug logging
  console.log('🔍 BudgetsPage render:', {
    hasBudget,
    budgetStage,
    patternsChecked,
    currentMonthlyBudget,
    currentMonthlyBudgetKeys: currentMonthlyBudget ? Object.keys(currentMonthlyBudget) : [],
    hasId: currentMonthlyBudget?._id,
    hasDataId: (currentMonthlyBudget as any)?.data?._id,
    loading
  });
  
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
        loading={loading || projectsLoading}
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
