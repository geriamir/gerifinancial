import { formatCurrency } from '../types/foreignCurrency';

// Data Interfaces
export interface ProjectOverviewSegment {
  name: string;
  value: number;
  color: string;
  percentage: number;
  formattedValue: string;
}

export interface ProjectOverviewData {
  segments: ProjectOverviewSegment[];
  scenario: 1 | 2 | 3 | 4;
  totalValue: number;
  title: string;
}

// Color Scheme Constants
export const PROJECT_OVERVIEW_COLORS = {
  budgetRemaining: '#4caf50',      // Green - Good
  unutilizedPlanned: '#ff9800',    // Orange - Caution
  totalPaid: '#f44336',            // Red - Spent
  overbudgetPlan: '#ff5722',       // Deep Orange - Warning
  budgetedPlan: '#4caf50',         // Green - Available
  overPaid: '#ff5722',             // Deep Orange - Over limit
  plan: '#2196f3',                 // Blue - Planned
  unplannedExpenses: '#9c27b0'     // Purple - Unplanned
} as const;

/**
 * Calculate project overview data for visualization
 * Supports both pie chart and progress bar representations
 */
export const calculateProjectOverviewData = (
  totalFunding: number,
  totalBudget: number,
  totalPaid: number,
  currency: string,
  totalUnplanned: number = 0
): ProjectOverviewData => {
  const segments: ProjectOverviewSegment[] = [];
  let scenario: 1 | 2 | 3 | 4;
  let totalValue: number;
  let title: string;

  // Calculate planned spending (total paid minus unplanned)
  const totalPlannedSpent = totalPaid - totalUnplanned;

  // Helper function to create segment
  const createSegment = (name: string, value: number, color: string): ProjectOverviewSegment => ({
    name,
    value,
    color,
    percentage: 0, // Will be calculated after totalValue is determined
    formattedValue: formatCurrency(value, currency)
  });

  if (totalPaid > totalFunding) {
    // Scenario 4: Over-Budget
    scenario = 4;
    totalValue = totalPaid;
    title = "Over-Budget Spending";
    
    const overPaidAmount = totalPaid - totalFunding;
    segments.push(createSegment('Over Paid', overPaidAmount, PROJECT_OVERVIEW_COLORS.overPaid));
    
    // Add unplanned expenses if they exist
    if (totalUnplanned > 0) {
      segments.push(createSegment('Unplanned Expenses', totalUnplanned, PROJECT_OVERVIEW_COLORS.unplannedExpenses));
    }
    
    // Apply sub-scenario logic for remaining segments based on Budget vs Planned relationship
    if (totalBudget > totalFunding) {
      // Sub-scenario: Also over-planned
      const overbudgetPlan = totalBudget - totalFunding;
      const budgetedPlan = totalFunding;
      segments.push(
        createSegment('Overbudget Plan', overbudgetPlan, PROJECT_OVERVIEW_COLORS.overbudgetPlan),
        createSegment('Budgeted Plan', budgetedPlan, PROJECT_OVERVIEW_COLORS.budgetedPlan)
      );
    } else {
      // Sub-scenario: Budget was sufficient for plan
      const budgetRemaining = totalFunding - totalBudget;
      segments.push(
        createSegment('Unplanned Budget', budgetRemaining, PROJECT_OVERVIEW_COLORS.budgetRemaining),
        createSegment('Planned Expenses', totalBudget, PROJECT_OVERVIEW_COLORS.plan)
      );
    }
    
  } else if (totalPaid > totalBudget && totalPaid <= totalFunding) {
    // Scenario 3: Over-Paid but In Budget
    scenario = 3;
    totalValue = totalFunding;
    title = "Over-Plan Spending";
    
    segments.push(
      createSegment('Funding Remaining', totalFunding - totalPaid, PROJECT_OVERVIEW_COLORS.budgetRemaining)
    );
    
    // Add unplanned expenses if they exist
    if (totalUnplanned > 0) {
      segments.push(createSegment('Unplanned Expenses', totalUnplanned, PROJECT_OVERVIEW_COLORS.unplannedExpenses));
    }
    
    // Add over-plan spending (planned expenses beyond budget)
    const overPlanAmount = totalPlannedSpent - totalBudget;
    if (overPlanAmount > 0) {
      segments.push(createSegment('Paid (Over Plan)', overPlanAmount, PROJECT_OVERVIEW_COLORS.overPaid));
    }
    
    // Add planned expenses up to budget
    const plannedWithinBudget = Math.min(totalPlannedSpent, totalBudget);
    if (plannedWithinBudget > 0) {
      segments.push(createSegment('Paid (As Planned)', plannedWithinBudget, PROJECT_OVERVIEW_COLORS.totalPaid));
    }
    
  } else if (totalBudget > totalFunding) {
    // Scenario 2: Over-Planned
    scenario = 2;
    totalValue = totalBudget;
    title = "Over-Planned Budget";
    
    segments.push(
      createSegment('Overbudget Plan', totalBudget - totalFunding, PROJECT_OVERVIEW_COLORS.overbudgetPlan),
      createSegment('Budgeted Plan', totalFunding, PROJECT_OVERVIEW_COLORS.budgetedPlan)
    );
    
    // Add unplanned expenses if they exist
    if (totalUnplanned > 0) {
      segments.push(createSegment('Unplanned Expenses', totalUnplanned, PROJECT_OVERVIEW_COLORS.unplannedExpenses));
    }
    
    // Add planned expenses
    if (totalPlannedSpent > 0) {
      segments.push(createSegment('Planned Paid', totalPlannedSpent, PROJECT_OVERVIEW_COLORS.totalPaid));
    }
    
  } else {
    // Scenario 1: Good Situation
    scenario = 1;
    totalValue = totalFunding;
    title = "Budget Overview";
    
    segments.push(
      createSegment('Budget Remaining', totalFunding - totalBudget, PROJECT_OVERVIEW_COLORS.budgetRemaining)
    );
    
    // Add unplanned expenses if they exist
    if (totalUnplanned > 0) {
      segments.push(createSegment('Unplanned Expenses', totalUnplanned, PROJECT_OVERVIEW_COLORS.unplannedExpenses));
    }
    
    // Add unutilized planned budget
    const unutilizedPlanned = totalBudget - totalPlannedSpent;
    if (unutilizedPlanned > 0) {
      segments.push(createSegment('Unutilized Planned', unutilizedPlanned, PROJECT_OVERVIEW_COLORS.unutilizedPlanned));
    }
    
    // Add planned expenses
    if (totalPlannedSpent > 0) {
      segments.push(createSegment('Planned Paid', totalPlannedSpent, PROJECT_OVERVIEW_COLORS.totalPaid));
    }
  }

  // Filter out zero-value segments and calculate percentages
  const filteredSegments = segments.filter(segment => segment.value > 0);
  const segmentsWithPercentages = filteredSegments.map(segment => ({
    ...segment,
    percentage: totalValue > 0 ? Math.round((segment.value / totalValue) * 100) : 0
  }));

  return { 
    segments: segmentsWithPercentages, 
    scenario, 
    totalValue, 
    title 
  };
};

/**
 * Get segment descriptions for tooltips and legends
 */
export const getSegmentDescription = (
  segmentName: string, 
  totalFunding: number, 
  totalBudget: number, 
  totalPaid: number, 
  currency: string
): string => {
  switch (segmentName) {
    case 'Budget Remaining':
      return `Available from ${formatCurrency(totalFunding, currency)} total funding`;
    case 'Funding Remaining':
      return `Available from ${formatCurrency(totalFunding, currency)} total funding`;
    case 'Unplanned Budget':
      return `Available from ${formatCurrency(totalFunding, currency)} total funding`;
    case 'Unutilized Planned':
      return `Planned but not yet spent from ${formatCurrency(totalBudget, currency)} budget`;
    case 'Total Paid':
    case 'Paid':
      return `Amount already spent`;
    case 'Planned Paid':
      return `Amount spent on planned expenses`;
    case 'Paid (As Planned)':
      return `Amount spent according to original plan (${formatCurrency(totalBudget, currency)})`;
    case 'Paid (Over Plan)':
      return `Amount spent beyond the planned budget (${formatCurrency(totalBudget, currency)})`;
    case 'Over Paid':
      return `Amount spent beyond planned budget`;
    case 'Overbudget Plan':
      return `Planned amount exceeding available funding`;
    case 'Budgeted Plan':
      return `Planned amount within available funding`;
    case 'Plan':
      return `Original planned budget amount`;
    case 'Planned Expenses':
      return `Total planned budget amount (${formatCurrency(totalBudget, currency)})`;
    case 'Unplanned Expenses':
      return `Amount spent on expenses not included in original budget plan`;
    default:
      return segmentName;
  }
};

/**
 * Get scenario-specific insights and recommendations
 */
export const getScenarioInsights = (
  scenario: 1 | 2 | 3 | 4,
  totalFunding: number,
  totalBudget: number,
  totalPaid: number,
  currency: string
): { status: 'good' | 'warning' | 'danger'; message: string; recommendation?: string } => {
  switch (scenario) {
    case 1:
      return {
        status: 'good',
        message: 'Project is on track with sufficient funding and controlled spending.',
        recommendation: 'Continue monitoring expenses and stay within planned budget.'
      };
    
    case 2:
      return {
        status: 'warning',
        message: `Budget plan (${formatCurrency(totalBudget, currency)}) exceeds available funding (${formatCurrency(totalFunding, currency)}).`,
        recommendation: 'Consider revising the budget plan or securing additional funding.'
      };
    
    case 3:
      return {
        status: 'warning',
        message: `Spending (${formatCurrency(totalPaid, currency)}) has exceeded the planned budget (${formatCurrency(totalBudget, currency)}) but is still within funding limits.`,
        recommendation: 'Review spending patterns and adjust remaining budget allocations.'
      };
    
    case 4:
      return {
        status: 'danger',
        message: `Critical: Spending (${formatCurrency(totalPaid, currency)}) has exceeded available funding (${formatCurrency(totalFunding, currency)}).`,
        recommendation: 'Immediate action required: Secure additional funding or halt non-essential expenses.'
      };
    
    default:
      return {
        status: 'good',
        message: 'Project overview data is available.',
      };
  }
};
