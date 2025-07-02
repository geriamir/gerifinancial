import { useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { logPerformanceReport, detectPerformanceIssues } from '../utils/performanceAnalyzer';

interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * A hook for monitoring and analyzing component performance.
 * Automatically cleans up metrics on unmount to prevent memory leaks.
 * 
 * @param componentName - The name of the component to monitor
 * @returns Performance monitoring utilities
 */
export const usePerformanceMonitor = (componentName: string) => {
  const metricsRef = useRef<PerformanceMetrics[]>([]);
  const activeOperations = useRef<Map<string, number>>(new Map());

  const startOperation = useCallback((operationName: string) => {
    const startTime = performance.now();
    // Get reference to current Map instance to ensure consistency
    const operations = activeOperations.current;
    operations.set(operationName, startTime);
  }, []);

  // Ensure metrics are cleared on unmount if not done manually
  useLayoutEffect(() => {
    // Capture ref values at setup time
    const metricsRefValue = metricsRef.current;
    const operationsRefValue = activeOperations.current;

    return () => {
      // Use captured ref values
      const currentOperations = new Map(operationsRefValue);
      const currentMetrics = [...metricsRefValue];

      // End any active operations with a warning
      if (currentOperations.size > 0) {
        console.warn(
          `[Performance] Component "${componentName}" unmounted with ${currentOperations.size} active operations`
        );
        currentOperations.forEach((startTime, opName) => {
          const endTime = performance.now();
          // Still need to update the ref here as we want to capture the final state
          metricsRefValue.push({
            operationName: `${opName} (interrupted)`,
            startTime,
            endTime,
            duration: endTime - startTime,
          });
        });
      }

      // Log final metrics and clean up
      if (currentMetrics.length > 0) {
        logPerformanceReport(currentMetrics, `${componentName} (Final)`);
        console.info(`[Performance] Auto-cleaning metrics for ${componentName}`);
        metricsRefValue.length = 0; // Clear the array in place
      }

      operationsRefValue.clear();
    };
  }, [componentName]);

  const endOperation = useCallback((operationName: string) => {
    // Get reference to current collections to ensure consistency
    const metrics = metricsRef.current;
    const operations = activeOperations.current;
    
    const startTime = operations.get(operationName);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationName}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetrics = {
      operationName,
      startTime,
      endTime,
      duration,
    };

    metrics.push(metric);
    operations.delete(operationName);

    // Log performance metric
    console.info(
      `[Performance] ${componentName} - ${operationName}: ${duration.toFixed(2)}ms`
    );

    // You could send this to your analytics service here
    if (duration > 100) {
      console.warn(
        `[Performance Warning] ${componentName} - ${operationName} took longer than 100ms`
      );
    }
    // Log warnings for potential performance issues
    const issues = detectPerformanceIssues([metric]);
    issues.forEach(issue => {
      console.warn(`[${componentName}] ${issue}`);
    });
  }, [componentName]);

  // Log periodic performance reports in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Capture ref objects at setup time to avoid stale values in cleanup
      const metricsRefValue = metricsRef.current;
      const operationsRefValue = activeOperations.current;

      const interval = setInterval(() => {
        const currentMetrics = [...metricsRefValue];
        if (currentMetrics.length > 0) {
          logPerformanceReport(currentMetrics, componentName);
        }
      }, 5000);

      return () => {
        clearInterval(interval);

        // Use captured ref values in cleanup
        const currentMetrics = [...metricsRefValue];
        const currentOperations = new Map(operationsRefValue);

        // Log final metrics if any
        if (currentMetrics.length > 0) {
          logPerformanceReport(currentMetrics, `${componentName} (Final)`);
        }

        // Handle any active operations
        if (currentOperations.size > 0) {
          console.warn(
            `[Performance] Found ${currentOperations.size} active operations during cleanup`
          );
        }
      };
    }
  }, [componentName]);

  const getMetrics = useCallback(() => {
    // Get reference to current metrics array to ensure consistency
    const metrics = metricsRef.current;
    return {
      metrics,
      averageDuration: metrics.reduce((acc, curr) => acc + curr.duration, 0) / metrics.length,
      operationCount: metrics.length,
      slowOperations: metrics.filter(m => m.duration > 100),
    };
  }, []);

  const clearMetrics = useCallback(() => {
    const metrics = metricsRef.current;
    metrics.length = 0; // Clear array in place rather than reassigning
  }, []);

  const measureOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    startOperation(operationName);
    try {
      const result = await operation();
      return result;
    } finally {
      endOperation(operationName);
    }
  }, [startOperation, endOperation]);

  return {
    startOperation,
    endOperation,
    getMetrics,
    clearMetrics,
    measureOperation,
  };
};
