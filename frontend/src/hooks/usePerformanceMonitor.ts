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
    activeOperations.current.set(operationName, startTime);
  }, []);

  // Ensure metrics are cleared on unmount if not done manually
  useLayoutEffect(() => {
    return () => {
      // Copy ref values to local variables
      const currentOperations = new Map(activeOperations.current);
      const currentMetrics = [...metricsRef.current];

      // End any active operations with a warning
      if (currentOperations.size > 0) {
        console.warn(
          `[Performance] Component "${componentName}" unmounted with ${currentOperations.size} active operations`
        );
        currentOperations.forEach((startTime, opName) => {
          const endTime = performance.now();
          metricsRef.current.push({
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
        metricsRef.current = [];
      }

      activeOperations.current.clear();
    };
  }, [componentName]);

  const endOperation = useCallback((operationName: string) => {
    const startTime = activeOperations.current.get(operationName);
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

    metricsRef.current.push(metric);
    activeOperations.current.delete(operationName);

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
      const interval = setInterval(() => {
        const currentMetrics = metricsRef.current;
        if (currentMetrics.length > 0) {
          logPerformanceReport(currentMetrics, componentName);
        }
      }, 5000); // Log every 5 seconds if there are metrics

      return () => {
        clearInterval(interval);
        // Log final report on unmount
        const finalMetrics = metricsRef.current;
        if (finalMetrics.length > 0) {
          logPerformanceReport(finalMetrics, `${componentName} (Final)`);
        }
      };
    }
  }, [componentName]);

  const getMetrics = useCallback(() => {
    return {
      metrics: metricsRef.current,
      averageDuration: metricsRef.current.reduce((acc, curr) => acc + curr.duration, 0) / metricsRef.current.length,
      operationCount: metricsRef.current.length,
      slowOperations: metricsRef.current.filter(m => m.duration > 100),
    };
  }, []);

  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
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
