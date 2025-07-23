import { useEffect, useRef, useState, useCallback } from 'react';
import { analytics } from '../utils/analytics';
import type { PerformanceTracker, PerformanceMetrics } from '../utils/analytics';

interface UsePerformanceTrackingOptions {
  name: string;
  category?: string;
  tags?: Record<string, string>;
  data?: Record<string, any>;
  onComplete?: (metrics: PerformanceMetrics) => void;
  autoStart?: boolean;
}

export const usePerformanceTracking = ({
  name,
  category,
  tags,
  data,
  onComplete,
  autoStart = true
}: UsePerformanceTrackingOptions) => {
  const trackerRef = useRef<PerformanceTracker | null>(null);
  const [isTracking, setIsTracking] = useState(autoStart);

  const startTracking = useCallback(() => {
    if (trackerRef.current) {
      console.warn('Performance tracking already started');
      return;
    }
    trackerRef.current = analytics.startPerformanceTracking(name, {
      category,
      tags,
      data
    });
    setIsTracking(true);
  }, [name, category, tags, data]);

  useEffect(() => {
    if (autoStart) {
      startTracking();
      
      return () => {
        if (trackerRef.current) {
          trackerRef.current.finish();
          const metrics = trackerRef.current.getMetrics();
          onComplete?.(metrics);
          trackerRef.current = null;
        }
      };
    }
  }, [autoStart, startTracking, onComplete]);

  const stopTracking = () => {
    if (!trackerRef.current) {
      console.warn('No active performance tracking to stop');
      return;
    }
    trackerRef.current.finish();
    const metrics = trackerRef.current.getMetrics();
    onComplete?.(metrics);
    trackerRef.current = null;
    setIsTracking(false);
    return metrics;
  };

  const addData = (newData: Record<string, any>) => {
    if (!trackerRef.current) {
      console.warn('No active performance tracking to add data to');
      return;
    }
    trackerRef.current.addData(newData);
  };

  const addTag = (key: string, value: string) => {
    if (!trackerRef.current) {
      console.warn('No active performance tracking to add tag to');
      return;
    }
    trackerRef.current.addTag(key, value);
  };

  const getMetrics = (): PerformanceMetrics | null => {
    if (!trackerRef.current) {
      return null;
    }
    return trackerRef.current.getMetrics();
  };

  return {
    startTracking,
    stopTracking,
    addData,
    addTag,
    getMetrics,
    isTracking
  };
};
