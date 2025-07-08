// Mock Sentry until it's properly installed
// TODO: Run npm install --save @sentry/react @sentry/tracing
const mockSentry = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
  setUser: () => {},
  setTag: () => {},
  addBreadcrumb: () => {},
  startTransaction: () => undefined,
  withProfiler: (component: any) => component,
  configureScope: (cb: (scope: any) => void) => {},
};

// Use real Sentry in production, mock in development
const Sentry = process.env.NODE_ENV === 'production' 
  ? require('@sentry/react')
  : mockSentry;

export interface Analytics {
  track: (eventName: string, eventData?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  page: (pageName: string, properties?: Record<string, any>) => void;
  group: (groupId: string, traits?: Record<string, any>) => void;
  reset: () => void;
  logEvent: (category: string, action: string, label?: string, value?: number) => void;
  logError: (error: Error, context?: Record<string, any>) => string;
  logException: (error: unknown, context?: Record<string, any>) => Promise<string>;
  startPerformanceTracking: (name: string, options?: PerformanceOptions) => PerformanceTracker;
}

// Test-only interface extending Analytics
export interface TestAnalytics extends Analytics {
  getEventQueue: () => Array<{
    category: string;
    action: string;
    label?: string;
    value?: number;
    timestamp: string;
  }>;
  getErrorQueue: () => Array<ErrorEvent>;
}


interface ErrorEvent {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
  timestamp: string;
  errorId: string;
}

export interface PerformanceOptions {
  category?: string;
  tags?: Record<string, string>;
  data?: Record<string, any>;
}

export interface PerformanceTracker {
  finish: () => void;
  addData: (data: Record<string, any>) => void;
  addTag: (key: string, value: string) => void;
  getMetrics: () => PerformanceMetrics;
}

export interface PerformanceMetrics {
  duration: number;
  startTime: number;
  endTime: number;
  tags: Record<string, string>;
  data: Record<string, any>;
}

class PerformanceTrackerImpl implements PerformanceTracker {
  private startTime: number;
  private endTime?: number;
  private name: string;
  private tags: Record<string, string>;
  private data: Record<string, any>;
  private category?: string;
  private transaction?: any; // Sentry.Transaction

  constructor(name: string, options?: PerformanceOptions) {
    this.startTime = performance.now();
    this.name = name;
    this.tags = options?.tags || {};
    this.data = options?.data || {};
    this.category = options?.category;

    // Start Sentry transaction if available
    if (process.env.NODE_ENV === 'production') {
      this.transaction = Sentry.startTransaction({
        name: this.name,
        op: this.category || 'performance',
        tags: this.tags,
        data: this.data,
      });
    }
  }

  finish() {
    this.endTime = performance.now();
    if (this.transaction) {
      this.transaction.finish();
    }
  }

  addData(data: Record<string, any>) {
    this.data = { ...this.data, ...data };
    if (this.transaction) {
      Object.entries(data).forEach(([key, value]) => {
        this.transaction.setData(key, value);
      });
    }
  }

  addTag(key: string, value: string) {
    this.tags[key] = value;
    if (this.transaction) {
      this.transaction.setTag(key, value);
    }
  }

  getMetrics(): PerformanceMetrics {
    return {
      duration: this.endTime ? this.endTime - this.startTime : 0,
      startTime: this.startTime,
      endTime: this.endTime || 0,
      tags: { ...this.tags },
      data: { ...this.data }
    };
  }
}

export class AnalyticsService implements TestAnalytics {
  private debugMode: boolean;
  private eventQueue: Array<{
    category: string;
    action: string;
    label?: string;
    value?: number;
    timestamp: string;
  }> = [];
  private errorQueue: ErrorEvent[] = [];
  private initialized = false;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
    this.initializeSentry();
  }

  private initializeSentry() {
    if (this.initialized) return;

    if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.REACT_APP_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
        beforeSend(event: any) {
          if (process.env.NODE_ENV === 'development') {
            return null;
          }
          return event;
        },
      });
      this.initialized = true;
    }
  }

  startPerformanceTracking(name: string, options?: PerformanceOptions): PerformanceTracker {
    const tracker = new PerformanceTrackerImpl(name, options);
    
    if (this.debugMode) {
      console.log('Performance tracking started:', name, options);
    }
    
    return tracker;
  }

  track(eventName: string, eventData: Record<string, any> = {}) {
    const timestamp = new Date().toISOString();
    const event = {
      category: 'track',
      action: eventName,
      label: JSON.stringify(eventData),
      timestamp
    };
    
    this.eventQueue.push(event);
    
    if (this.debugMode) {
      console.log('Analytics Event:', eventName, { ...eventData, timestamp });
    }

    // Add analytics breadcrumb to Sentry
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: eventName,
      data: eventData,
      timestamp: Date.now() / 1000,
    });
  }

  identify(userId: string, traits: Record<string, any> = {}) {
    if (this.debugMode) {
      console.log('Analytics Identify:', userId, traits);
    }

    // Set user context in Sentry
    Sentry.setUser({
      id: userId,
      ...traits,
    });
  }

  page(pageName: string, properties: Record<string, any> = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.debugMode) {
      console.log('Analytics Page:', pageName, { ...properties, timestamp });
    }

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `Page View: ${pageName}`,
      data: properties,
      timestamp: Date.now() / 1000,
    });
  }

  group(groupId: string, traits: Record<string, any> = {}) {
    if (this.debugMode) {
      console.log('Analytics Group:', groupId, traits);
    }

    Sentry.setTag('groupId', groupId);
    Object.entries(traits).forEach(([key, value]) => {
      if (typeof value === 'string') {
        Sentry.setTag(`group_${key}`, value);
      }
    });
  }

  reset() {
    if (this.debugMode) {
      console.log('Analytics Reset');
    }
    this.eventQueue = [];
    this.errorQueue = [];
    Sentry.configureScope((scope: { clear: () => void }) => scope.clear());
  }

  logEvent(category: string, action: string, label?: string, value?: number) {
    const event = {
      category,
      action,
      label,
      value,
      timestamp: new Date().toISOString()
    };

    this.eventQueue.push(event);

    if (this.debugMode) {
      console.log('Analytics Log Event:', event);
    }

    Sentry.addBreadcrumb({
      category,
      message: action,
      data: { label, value },
      timestamp: Date.now() / 1000,
    });
  }

  logError(error: Error, context: Record<string, any> = {}): string {
    const errorEvent: ErrorEvent = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString(),
      errorId: this.generateErrorId()
    };

    this.errorQueue.push(errorEvent);

    if (this.debugMode) {
      console.error('Analytics Error:', errorEvent);
    }

    Sentry.captureException(error, {
      extra: { ...context, errorId: errorEvent.errorId }
    });

    return errorEvent.errorId;
  }

  async logException(error: unknown, context: Record<string, any> = {}): Promise<string> {
    try {
      const errorId = this.generateErrorId();
      let errorEvent: ErrorEvent;

      try {
        if (error instanceof Error) {
          errorEvent = {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            },
            context,
            timestamp: new Date().toISOString(),
            errorId
          };

          Sentry.captureException(error, {
            extra: { ...context, errorId }
          });
        } else {
          let errorString: string;
          try {
            errorString = String(error);
          } catch (stringifyError) {
            // If toString() fails, create a fallback error event
            errorEvent = {
              error: {
                name: 'ErrorTrackingFailure',
                message: 'Failed to track error'
              },
              context: {
                originalError: error,
                trackingError: stringifyError instanceof Error ? stringifyError.message : String(stringifyError)
              },
              timestamp: new Date().toISOString(),
              errorId
            };
            throw new Error('Error in toString');
          }

          errorEvent = {
            error: {
              name: 'ErrorTrackingFailure',
              message: errorString
            },
            context,
            timestamp: new Date().toISOString(),
            errorId
          };

          Sentry.captureMessage(errorString, {
            level: 'error',
            extra: { ...context, errorId }
          });
        }

        this.errorQueue.push(errorEvent);

        if (this.debugMode) {
          console.error('Analytics Exception:', errorEvent);
        }

        return errorId;
      } catch (trackingError) {
        // If error tracking itself fails, create a special error event
        const trackingErrorMsg = trackingError instanceof Error ? trackingError.message : String(trackingError);
        errorEvent = {
          error: {
            name: 'ErrorTrackingFailure',
            message: 'Failed to track error',
          },
          context: { 
            originalError: String(error),
            trackingError: trackingErrorMsg
          },
          timestamp: new Date().toISOString(),
          errorId
        };

        this.errorQueue.push(errorEvent);

        if (this.debugMode) {
          console.error('Analytics Exception Tracking Failed:', errorEvent);
        }

        return errorId;
      }
    } catch (e) {
      const fallbackErrorId = this.generateErrorId();
      const fallbackError: ErrorEvent = {
        error: {
          name: 'ErrorTrackingFailure',
          message: 'Failed to track error'
        },
        context: { 
          originalError: String(error), 
          trackingError: e instanceof Error ? e.message : String(e)
        },
        timestamp: new Date().toISOString(),
        errorId: fallbackErrorId
      };

      this.errorQueue.push(fallbackError);

      if (this.debugMode) {
        console.error('Analytics Exception Tracking Failed:', fallbackError);
      }

      Sentry.captureMessage('Error Tracking Failure', {
        level: 'error',
        extra: fallbackError
      });

      return fallbackErrorId;
    }
  }

  // Helper method to get event queue (useful for testing)
  getEventQueue() {
    return [...this.eventQueue];
  }

  // Helper method to get error queue (useful for testing)
  getErrorQueue() {
    return [...this.errorQueue];
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export a singleton instance
export const analytics = new AnalyticsService(
  process.env.NODE_ENV === 'development'
);

// Helper functions for common analytics operations
export const track = (eventName: string | { toString: () => string }, eventData?: Record<string, any>) => {
  analytics.track(eventName.toString(), eventData);
};
