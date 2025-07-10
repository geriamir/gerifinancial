import { AnalyticsService } from '../analytics';

interface QueueEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: string;
}

interface ErrorQueueEvent {
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
  timestamp: string;
  errorId: string;
}

describe('AnalyticsService', () => {
  const originalConsole = { ...console };
  let analytics: AnalyticsService;
  
  beforeEach(() => {
    // Create a new instance with debug mode explicitly enabled
    analytics = new AnalyticsService(true);
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore original console
    console = { ...originalConsole };
  });

  describe('event tracking', () => {
    it('tracks events with proper data', () => {
      analytics.track('test_event', { foo: 'bar' });
      const queue = analytics.getEventQueue();
      expect(console.log).toHaveBeenCalledWith(
        'Analytics Event:',
        'test_event',
        expect.objectContaining({ foo: 'bar' })
      );
    });

    it('logs events with category and action', () => {
      analytics.logEvent('category', 'action', 'label', 123);
      const queue = analytics.getEventQueue();
      
      expect(queue).toHaveLength(1);
      expect(queue[0]).toEqual({
        category: 'category',
        action: 'action',
        label: 'label',
        value: 123,
        timestamp: expect.any(String)
      });
    });
  });

  describe('error tracking', () => {
    it('logs Error objects with stack trace', () => {
      const error = new Error('Test error');
      const context = { extra: 'info' };
      
      const errorId = analytics.logError(error, context);
      const errorQueue = analytics.getErrorQueue();

      expect(errorQueue).toHaveLength(1);
      expect(errorQueue[0]).toEqual({
        error: {
          name: 'Error',
          message: 'Test error',
          stack: error.stack
        },
        context,
        timestamp: expect.any(String),
        errorId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
      });
    });

    it('handles custom errors', () => {
      class CustomError extends Error {
        constructor() {
          super('Custom error');
          this.name = 'CustomError';
        }
      }

      const error = new CustomError();
      const errorId = analytics.logError(error);
      const errorQueue = analytics.getErrorQueue();

      expect(errorQueue[0].error.name).toBe('CustomError');
    });

    it('generates unique error IDs', () => {
      const error = new Error('Test error');
      const errorId1 = analytics.logError(error);
      const errorId2 = analytics.logError(error);

      expect(errorId1).not.toBe(errorId2);
      expect(errorId1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(errorId2).toMatch(/^err_\d+_[a-z0-9]+$/);
    });
  });

  describe('exception handling', () => {
    describe('non-Error values', () => {
      it('wraps primitive values as errors while preserving context', async () => {
        const errorId = await analytics.logException('string error', { context: 'test' });
        const errorQueue = analytics.getErrorQueue();

        expect(errorQueue).toHaveLength(1);
        expect(errorQueue[0]).toMatchObject({
          error: {
            name: 'ErrorTrackingFailure',
            message: 'string error'
          },
          context: { context: 'test' },
          timestamp: expect.any(String),
          errorId: expect.stringMatching(/^err_\d+_[a-z0-9]+$/)
        });
      });

      it('handles null/undefined exceptions', async () => {
        const errorId = await analytics.logException(null);
        const errorQueue = analytics.getErrorQueue();

        expect(errorQueue).toHaveLength(1);
        expect(errorQueue[0].error.message).toBe('null');
      });
    });
  });

  describe('reset functionality', () => {
    it('clears event and error queues', () => {
      analytics.track('test_event');
      analytics.logError(new Error('test error'));

      expect(analytics.getEventQueue()).toHaveLength(1);
      expect(analytics.getErrorQueue()).toHaveLength(1);

      analytics.reset();

      expect(analytics.getEventQueue()).toHaveLength(0);
      expect(analytics.getErrorQueue()).toHaveLength(0);
    });
  });

  describe('debug mode', () => {
    it('logs to console in debug mode', () => {
      analytics.track('test_event');
      expect(console.log).toHaveBeenCalled();

      analytics.logError(new Error('test error'));
      expect(console.error).toHaveBeenCalled();
    });

    it('includes timestamps in all events', () => {
      analytics.track('test_event');
      analytics.logError(new Error('test error'));

      const events = analytics.getEventQueue() as QueueEvent[];
      const errors = analytics.getErrorQueue() as ErrorQueueEvent[];

      events.forEach((event: QueueEvent) => {
        expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      errors.forEach((error: ErrorQueueEvent) => {
        expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });
  });
});
