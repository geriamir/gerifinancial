import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { CategorizationProvider, useCategorization } from '../CategorizationContext';
import { useSSE, SSEEvent, SSE_EVENT_TYPES } from '../../hooks/useSSE';

let emit: (event: SSEEvent) => void;

const send = (type: string, data: Record<string, unknown> = {}) => {
  act(() => {
    emit({ type, data, timestamp: new Date().toISOString() });
  });
};

const Nonce: React.FC = () => {
  const { projectSuggestionsNonce } = useCategorization();
  return <span data-testid="nonce">{projectSuggestionsNonce}</span>;
};

const renderNonce = () =>
  render(
    <CategorizationProvider>
      <Nonce />
    </CategorizationProvider>
  );

describe('project suggestion signal', () => {
  beforeEach(() => {
    emit = () => {};
    (useSSE as jest.Mock).mockImplementation((onEvent: (event: SSEEvent) => void) => {
      if (onEvent) emit = onEvent;
      return { connected: true, error: null, lastEvent: null, connect: jest.fn(), disconnect: jest.fn() };
    });
  });

  // EventSource only invokes listeners registered for an exact event name, so a
  // handler for an event missing from this list simply never runs - and nothing
  // anywhere reports that. The name has to be here for the feature to work.
  it('subscribes to the event the server actually sends', () => {
    expect(SSE_EVENT_TYPES).toContain('projects:suggestions');
  });

  it('starts with nothing to report', () => {
    renderNonce();

    expect(screen.getByTestId('nonce')).toHaveTextContent('0');
  });

  it('signals each time the server reports new suggestions', () => {
    renderNonce();

    send('projects:suggestions', { added: 3 });
    expect(screen.getByTestId('nonce')).toHaveTextContent('1');

    send('projects:suggestions', { added: 1 });
    expect(screen.getByTestId('nonce')).toHaveTextContent('2');
  });

  it('is not disturbed by the other events on the stream', () => {
    renderNonce();

    send('categorization:completed', { total: 5, categorized: 5, uncategorized: 0, failed: 0 });
    send('scraping:completed', {});
    send('heartbeat', {});

    expect(screen.getByTestId('nonce')).toHaveTextContent('0');
  });
});
