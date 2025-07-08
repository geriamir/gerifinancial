import * as Sentry from '@sentry/react';

export const initSentry = () => {
  if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      beforeSend(event) {
        // Don't send errors in development
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        return event;
      },
    });
  }
};

export const setUserContext = (userId: string, email?: string) => {
  Sentry.setUser({
    id: userId,
    email,
  });
};

export const captureException = (
  error: Error | unknown,
  context?: Record<string, any>
) => {
  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    Sentry.captureMessage(String(error), {
      level: 'error',
      extra: context,
    });
  }
};

export const setTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

export const addBreadcrumb = (
  message: string,
  category?: string,
  level: Sentry.SeverityLevel = 'info'
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
  });
};

/**
 * Higher-order component that wraps component with Sentry profiler
 */
export const withProfiler = Sentry.withProfiler;
