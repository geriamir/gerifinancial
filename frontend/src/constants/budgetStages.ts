// Budget workflow stage constants
export const BUDGET_STAGES = {
  INITIAL: 'initial',
  PATTERNS_DETECTED: 'patterns-detected',
  BUDGET_CREATED: 'budget-created'
} as const;

export type BudgetStage = typeof BUDGET_STAGES[keyof typeof BUDGET_STAGES];

// Stage descriptions for better UX
export const BUDGET_STAGE_DESCRIPTIONS = {
  [BUDGET_STAGES.INITIAL]: 'Ready to create your first budget',
  [BUDGET_STAGES.PATTERNS_DETECTED]: 'Transaction patterns detected - review and approve',
  [BUDGET_STAGES.BUDGET_CREATED]: 'Budget created and active'
} as const;

// Stage actions
export const BUDGET_STAGE_ACTIONS = {
  [BUDGET_STAGES.INITIAL]: 'Auto-Calculate Budget',
  [BUDGET_STAGES.PATTERNS_DETECTED]: 'Create Smart Budget',
  [BUDGET_STAGES.BUDGET_CREATED]: 'Auto-Calculate Budget'
} as const;
