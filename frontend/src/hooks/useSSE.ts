import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
 * @param onEvent - Callback function called when events are received
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
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('[SSE] No auth token, skipping connection');
      return;
    }

    if (eventSourceRef.current) {
      console.log('[SSE] Already connected');
      return;
    }

    try {
      console.log('[SSE] Connecting to event stream...');
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const url = `${apiUrl}/api/events?token=${token}`;
      
      const eventSource = new EventSource(url);
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
      const eventTypes = [
        'connected',
        'heartbeat',
        'scraping:started',
        'scraping:progress',
        'scraping:completed',
        'scraping:failed',
        'onboarding:credit-card-detection',
        'onboarding:credit-card-matching'
      ];

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
