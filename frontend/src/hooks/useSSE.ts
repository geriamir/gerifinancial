import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * The named events this client subscribes to.
 *
 * Not a catalogue of everything the server emits - `connection:established` and
 * `account:sync-completed` go out on the stream without appearing here, because
 * nothing in the UI acts on them. What it does mean is that an event outside
 * this list is discarded by the browser without a trace on either end, since
 * EventSource only invokes listeners registered for an exact event name and
 * named events do not fall through to `onmessage`. So a feature that needs to
 * react to a server event has to add its name here as well as write the handler;
 * the handler alone will simply never run.
 */
export const SSE_EVENT_TYPES = [
  'connected',
  'heartbeat',
  'scraping:started',
  'scraping:progress',
  'scraping:completed',
  'scraping:failed',
  'onboarding:credit-card-detection',
  'onboarding:credit-card-matching',
  'categorization:progress',
  'categorization:completed'
] as const;

export interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface UseSSEOptions {
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface UseSSEResult {
  connected: boolean;
  error: Error | null;
  lastEvent: SSEEvent | null;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Generic hook for Server-Sent Events (SSE) connections
 * Provides real-time event streaming from the server
 *
 * Each call opens its own `EventSource`, so two callers mounted at the same time
 * mean two connections per tab and the server fanning every event out twice.
 * That does not happen today - the only two callers are `useOnboarding`, reached
 * solely from the `/onboarding` route, and `CategorizationProvider`, which wraps
 * the `/` route; they are sibling routes, so only one is ever mounted. Anything
 * new that wants events app-wide should subscribe through a provider that
 * already holds a connection rather than calling this a second time, until the
 * hook is reworked into a shared multiplexer.
 *
 * @param onEvent - Callback function called when events are received. It must be
 *   referentially stable (`useCallback` with stable deps), because a new
 *   identity tears the stream down and reopens it.
 * @param options - Configuration options
 * @returns Connection state and control functions
 * 
 * @example
 * ```typescript
 * const { connected } = useSSE((event) => {
 *   console.log('Received event:', event.type, event.data);
 *   
 *   switch (event.type) {
 *     case 'scraping:started':
 *       // Handle scraping started
 *       break;
 *     case 'scraping:completed':
 *       // Handle scraping completed
 *       break;
 *   }
 * });
 * ```
 */
export const useSSE = (
  onEvent?: (event: SSEEvent) => void,
  options: UseSSEOptions = {}
): UseSSEResult => {
  const {
    autoConnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5
  } = options;

  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('[SSE] Already connected');
      return;
    }

    try {
      console.log('[SSE] Connecting to event stream...');
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const url = `${apiUrl}/api/events`;
      
      // The session lives in an httpOnly cookie that JavaScript cannot read, so
      // the token cannot be put in the query string. withCredentials makes the
      // browser attach the cookie to this cross-origin stream instead.
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('[SSE] Connection established');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      // Generic message handler (fallback)
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const event: SSEEvent = {
            type: e.type || 'message',
            data,
            timestamp: new Date().toISOString()
          };
          setLastEvent(event);
          if (onEvent) {
            onEvent(event);
          }
        } catch (err) {
          console.error('[SSE] Error parsing message:', err);
        }
      };

      // Connection error
      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        setConnected(false);
        setError(new Error('SSE connection failed'));
        
        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[SSE] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          console.error('[SSE] Max reconnect attempts reached');
        }
      };

      // Listen for specific event types
      // The EventSource will automatically call these when events with matching names are received
      const eventTypes = SSE_EVENT_TYPES;

      eventTypes.forEach((eventType) => {
        eventSource.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const event: SSEEvent = {
              type: eventType,
              data,
              timestamp: data.timestamp || new Date().toISOString()
            };
            
            // Log ALL events to console for visibility
            console.log(`%c[SSE EVENT] ${eventType}`, 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 3px;', data);
            setLastEvent(event);
            
            if (onEvent) {
              onEvent(event);
            }
          } catch (err) {
            console.error(`[SSE] Error parsing ${eventType} event:`, err);
          }
        });
      });

      // Also add a catch-all listener to log any events we might have missed
      const originalAddEventListener = eventSource.addEventListener.bind(eventSource);
      eventSource.addEventListener = function(type: string, listener: any, options?: any) {
        console.log(`[SSE] Registering listener for event type: ${type}`);
        return originalAddEventListener(type, listener, options);
      };

    } catch (err) {
      console.error('[SSE] Error creating EventSource:', err);
      setError(err as Error);
    }
  }, [onEvent, reconnectDelay, maxReconnectAttempts]);

  /**
   * Disconnect from SSE
   */
  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, connect, disconnect]);

  return {
    connected,
    error,
    lastEvent,
    connect,
    disconnect
  };
};
