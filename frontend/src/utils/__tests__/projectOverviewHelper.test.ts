import {
  calculateProjectOverviewData,
  getScenarioInsights,
  getSegmentDescription,
  PROJECT_OVERVIEW_COLORS,
} from '../projectOverviewHelper';

/** Helper: extract segment names from result */
const segmentNames = (result: ReturnType<typeof calculateProjectOverviewData>) =>
  result.segments.map((s) => s.name);

/** Helper: sum of segment values */
const segmentSum = (result: ReturnType<typeof calculateProjectOverviewData>) =>
  result.segments.reduce((sum, s) => sum + s.value, 0);

/** Helper: sum of segment percentages */
const percentageSum = (result: ReturnType<typeof calculateProjectOverviewData>) =>
  result.segments.reduce((sum, s) => sum + s.percentage, 0);

describe('calculateProjectOverviewData', () => {
  // ── Scenario 1: Good Situation (budget ≤ funding, paid ≤ budget) ──

  describe('Scenario 1 – Good', () => {
    it('shows budget remaining, unutilized planned, and planned paid', () => {
      const result = calculateProjectOverviewData(100000, 60000, 30000, 'ILS');
      expect(result.scenario).toBe(1);
      expect(result.title).toBe('Budget Overview');
      expect(result.totalValue).toBe(100000);
      expect(segmentNames(result)).toEqual(['Budget Remaining', 'Unutilized Planned', 'Planned Paid']);
      expect(result.segments[0].value).toBe(40000);  // 100k - 60k
      expect(result.segments[1].value).toBe(30000);  // 60k - 30k
      expect(result.segments[2].value).toBe(30000);  // paid
    });

    it('segments sum to totalValue', () => {
      const result = calculateProjectOverviewData(100000, 60000, 30000, 'ILS');
      expect(segmentSum(result)).toBe(result.totalValue);
    });

    it('includes unplanned expenses when present', () => {
      const result = calculateProjectOverviewData(100000, 60000, 30000, 'ILS', 5000);
      expect(segmentNames(result)).toContain('Unplanned Expenses');
    });
  });

  // ── Scenario 2: Over-Planned (budget > funding, paid ≤ funding) ──

  describe('Scenario 2 – Over-Planned', () => {
    it('shows overbudget plan and budgeted plan', () => {
      const result = calculateProjectOverviewData(50000, 80000, 20000, 'ILS');
      expect(result.scenario).toBe(2);
      expect(result.title).toBe('Over-Planned Budget');
      expect(result.totalValue).toBe(80000);
      expect(segmentNames(result)).toContain('Overbudget Plan');
      expect(segmentNames(result)).toContain('Budgeted Plan');
      expect(result.segments.find(s => s.name === 'Overbudget Plan')!.value).toBe(30000);
      expect(result.segments.find(s => s.name === 'Budgeted Plan')!.value).toBe(50000);
    });

    it('totalValue equals totalBudget', () => {
      const result = calculateProjectOverviewData(50000, 80000, 20000, 'ILS');
      expect(result.totalValue).toBe(80000);
    });
  });

  // ── Scenario 3: Over-Paid but within funding ──

  describe('Scenario 3 – Over-Paid within funding', () => {
    it('shows funding remaining, over-plan, and as-planned', () => {
      const result = calculateProjectOverviewData(100000, 40000, 60000, 'ILS');
      expect(result.scenario).toBe(3);
      expect(result.title).toBe('Over-Plan Spending');
      expect(result.totalValue).toBe(100000);
      expect(segmentNames(result)).toContain('Funding Remaining');
      expect(segmentNames(result)).toContain('Paid (Over Plan)');
      expect(segmentNames(result)).toContain('Paid (As Planned)');
    });

    it('segments sum to totalValue', () => {
      const result = calculateProjectOverviewData(100000, 40000, 60000, 'ILS');
      expect(segmentSum(result)).toBe(result.totalValue);
    });
  });

  // ── Scenario 4: Over-Budget (paid > funding, funding > 0) ──

  describe('Scenario 4 – Over-Budget', () => {
    it('shows over paid when budget also exceeds funding', () => {
      const result = calculateProjectOverviewData(50000, 80000, 90000, 'ILS');
      expect(result.scenario).toBe(4);
      expect(result.title).toBe('Over-Budget Spending');
      expect(result.totalValue).toBe(90000);
      expect(segmentNames(result)).toContain('Over Paid');
      expect(segmentNames(result)).toContain('Overbudget Plan');
      expect(segmentNames(result)).toContain('Budgeted Plan');
    });

    it('shows over paid when budget fits funding', () => {
      const result = calculateProjectOverviewData(50000, 40000, 60000, 'ILS');
      expect(result.scenario).toBe(4);
      expect(segmentNames(result)).toContain('Over Paid');
      expect(segmentNames(result)).toContain('Unplanned Budget');
      expect(segmentNames(result)).toContain('Planned Expenses');
    });

    it('includes unplanned expenses', () => {
      const result = calculateProjectOverviewData(50000, 80000, 90000, 'ILS', 5000);
      expect(segmentNames(result)).toContain('Unplanned Expenses');
    });
  });

  // ── Scenario 5: No Funding ──

  describe('Scenario 5 – No Funding', () => {
    it('returns no budget data when both budget and paid are zero', () => {
      const result = calculateProjectOverviewData(0, 0, 0, 'ILS');
      expect(result.scenario).toBe(5);
      expect(result.title).toBe('No Budget Data');
      expect(result.totalValue).toBe(0);
      expect(result.segments).toHaveLength(0);
    });

    it('within plan: shows remaining budget and planned paid', () => {
      // User's reported case: funding=0, budget=43100, paid=41603.72
      const result = calculateProjectOverviewData(0, 43100, 41603.72, 'ILS');
      expect(result.scenario).toBe(5);
      expect(result.title).toBe('Budget Tracking');
      expect(result.totalValue).toBe(43100);
      expect(segmentNames(result)).toEqual(['Remaining Budget', 'Planned Paid']);
      expect(result.segments[0].value).toBeCloseTo(1496.28, 1);
      expect(result.segments[1].value).toBeCloseTo(41603.72, 1);
    });

    it('within plan: segments sum to totalBudget', () => {
      const result = calculateProjectOverviewData(0, 43100, 41603.72, 'ILS');
      expect(segmentSum(result)).toBeCloseTo(result.totalValue, 1);
    });

    it('within plan: includes unplanned expenses', () => {
      const result = calculateProjectOverviewData(0, 43100, 30000, 'ILS', 5000);
      expect(segmentNames(result)).toEqual(['Remaining Budget', 'Unplanned Expenses', 'Planned Paid']);
      expect(segmentSum(result)).toBeCloseTo(43100, 1);
    });

    it('overspent: shows overspent and planned paid when planned exceeds budget', () => {
      // paid=50000 > budget=43100, all planned (no unplanned)
      const result = calculateProjectOverviewData(0, 43100, 50000, 'ILS');
      expect(result.scenario).toBe(5);
      expect(result.title).toBe('Over-Spent (No Funding)');
      expect(result.totalValue).toBe(50000);
      expect(segmentNames(result)).toEqual(['Overspent', 'Planned Paid']);
      expect(result.segments[0].value).toBe(6900);   // 50000 - 43100
      expect(result.segments[1].value).toBe(43100);
    });

    it('overspent: segments sum to totalPaid', () => {
      const result = calculateProjectOverviewData(0, 43100, 50000, 'ILS');
      expect(segmentSum(result)).toBe(result.totalValue);
    });

    it('overspent with unplanned: shows unplanned, overspent, and planned', () => {
      // paid=50000, budget=43100, unplanned=5000, plannedSpent=45000
      const result = calculateProjectOverviewData(0, 43100, 50000, 'ILS', 5000);
      expect(segmentNames(result)).toEqual(['Unplanned Expenses', 'Overspent', 'Planned Paid']);
      expect(result.segments[0].value).toBe(5000);
      expect(result.segments[1].value).toBe(1900);   // 45000 - 43100
      expect(result.segments[2].value).toBe(43100);
      expect(segmentSum(result)).toBe(50000);
    });

    it('overspent entirely by unplanned: no Overspent segment', () => {
      // paid=50000, budget=43100, unplanned=10000, plannedSpent=40000 < budget
      const result = calculateProjectOverviewData(0, 43100, 50000, 'ILS', 10000);
      expect(segmentNames(result)).toEqual(['Unplanned Expenses', 'Planned Paid']);
      expect(result.segments[0].value).toBe(10000);
      expect(result.segments[1].value).toBe(40000);
      expect(segmentSum(result)).toBe(50000);
    });

    it('percentages sum to ~100%', () => {
      const result = calculateProjectOverviewData(0, 43100, 41603.72, 'ILS');
      expect(percentageSum(result)).toBeGreaterThanOrEqual(99);
      expect(percentageSum(result)).toBeLessThanOrEqual(101);
    });

    it('overspent percentages do not exceed 100% per segment', () => {
      const result = calculateProjectOverviewData(0, 43100, 50000, 'ILS', 5000);
      for (const seg of result.segments) {
        expect(seg.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── Cross-cutting: percentage calculation ──

  describe('Percentages', () => {
    it('calculates percentages based on totalValue', () => {
      const result = calculateProjectOverviewData(100000, 60000, 30000, 'ILS');
      const budgetRemaining = result.segments.find(s => s.name === 'Budget Remaining')!;
      expect(budgetRemaining.percentage).toBe(40); // 40000 / 100000
    });

    it('filters out zero-value segments', () => {
      // No unplanned, no unutilized (paid == budget)
      const result = calculateProjectOverviewData(100000, 50000, 50000, 'ILS');
      expect(result.segments.every(s => s.value > 0)).toBe(true);
    });
  });
});

describe('getSegmentDescription', () => {
  it('returns description for Overspent segment', () => {
    const desc = getSegmentDescription('Overspent', 0, 43100, 50000, 'ILS');
    expect(desc).toContain('beyond planned budget');
  });

  it('returns description for Remaining Budget', () => {
    const desc = getSegmentDescription('Remaining Budget', 0, 43100, 30000, 'ILS');
    expect(desc).toContain('budget');
  });

  it('returns segment name as fallback for unknown segments', () => {
    expect(getSegmentDescription('Unknown', 0, 0, 0, 'ILS')).toBe('Unknown');
  });
});

describe('getScenarioInsights', () => {
  it('returns good status for scenario 1', () => {
    const insights = getScenarioInsights(1, 100000, 60000, 30000, 'ILS');
    expect(insights.status).toBe('good');
  });

  it('returns warning for scenario 2', () => {
    const insights = getScenarioInsights(2, 50000, 80000, 20000, 'ILS');
    expect(insights.status).toBe('warning');
  });

  it('returns warning for scenario 3', () => {
    const insights = getScenarioInsights(3, 100000, 40000, 60000, 'ILS');
    expect(insights.status).toBe('warning');
  });

  it('returns danger for scenario 4', () => {
    const insights = getScenarioInsights(4, 50000, 80000, 90000, 'ILS');
    expect(insights.status).toBe('danger');
  });

  it('returns warning for scenario 5 within plan', () => {
    const insights = getScenarioInsights(5, 0, 43100, 30000, 'ILS');
    expect(insights.status).toBe('warning');
    expect(insights.message).toContain('No funding allocated');
  });

  it('returns danger for scenario 5 overspent', () => {
    const insights = getScenarioInsights(5, 0, 43100, 50000, 'ILS');
    expect(insights.status).toBe('danger');
    expect(insights.message).toContain('exceeded');
  });
});
