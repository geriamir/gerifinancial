interface PerformanceData {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface AnalysisResult {
  operationCounts: Record<string, number>;
  averageDurations: Record<string, number>;
  slowOperations: PerformanceData[];
  totalTime: number;
  operationsOverThreshold: PerformanceData[];
}

export const analyzePerformance = (
  metrics: PerformanceData[],
  threshold: number = 100
): AnalysisResult => {
  const operationCounts: Record<string, number> = {};
  const totalDurations: Record<string, number> = {};
  const slowOperations: PerformanceData[] = [];
  let totalTime = 0;

  metrics.forEach(metric => {
    // Count operations
    operationCounts[metric.operationName] = (operationCounts[metric.operationName] || 0) + 1;

    // Sum durations
    totalDurations[metric.operationName] = (totalDurations[metric.operationName] || 0) + metric.duration;

    // Track total time
    totalTime += metric.duration;

    // Track slow operations
    if (metric.duration > threshold) {
      slowOperations.push(metric);
    }
  });

  // Calculate averages
  const averageDurations: Record<string, number> = {};
  Object.keys(operationCounts).forEach(op => {
    averageDurations[op] = totalDurations[op] / operationCounts[op];
  });

  return {
    operationCounts,
    averageDurations,
    slowOperations,
    totalTime,
// Removed the redundant assignment of `operationsOverThreshold`.
  };
};

export const logPerformanceReport = (metrics: PerformanceData[], componentName: string) => {
  if (process.env.NODE_ENV !== 'development') return;

  const analysis = analyzePerformance(metrics);
  
  console.group(`🔍 Performance Report: ${componentName}`);
  console.log('Total time:', analysis.totalTime.toFixed(2), 'ms');
  
  console.group('Operation Counts:');
  Object.entries(analysis.operationCounts).forEach(([op, count]) => {
    console.log(`${op}: ${count} times`);
  });
  console.groupEnd();

  console.group('Average Durations:');
  Object.entries(analysis.averageDurations).forEach(([op, avg]) => {
    console.log(`${op}: ${avg.toFixed(2)} ms`);
  });
  console.groupEnd();

  if (analysis.slowOperations.length > 0) {
    console.group('⚠️ Slow Operations:');
    analysis.slowOperations.forEach(op => {
      console.warn(
        `${op.operationName}: ${op.duration.toFixed(2)} ms`,
        `(${new Date(op.startTime).toISOString()})`
      );
    });
    console.groupEnd();
  }

  console.groupEnd();
};

export const detectPerformanceIssues = (metrics: PerformanceData[]): string[] => {
  const issues: string[] = [];
  const analysis = analyzePerformance(metrics);

  // Check for slow operations
  if (analysis.slowOperations.length > 0) {
    issues.push(
      `Found ${analysis.slowOperations.length} operations exceeding 100ms threshold`
    );
  }

  // Check for frequent operations
  Object.entries(analysis.operationCounts).forEach(([op, count]) => {
    if (count > 50) {
      issues.push(`Operation "${op}" called ${count} times - consider optimizing`);
    }
  });

  // Check average durations
  Object.entries(analysis.averageDurations).forEach(([op, avg]) => {
    if (avg > 50) {
      issues.push(
        `Operation "${op}" has high average duration (${avg.toFixed(2)}ms)`
      );
    }
  });

  return issues;
};
