import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategorizationStatus from '../CategorizationStatus';
import { CategorizationProvider } from '../../../contexts/CategorizationContext';
import { useSSE, SSEEvent } from '../../../hooks/useSSE';

// The hook is mocked globally in setupTests; here we take hold of the handler
// it is given so a test can push events through the real provider. That way the
// event names in this file have to match the ones the server sends, rather than
// being asserted against a hand-written stub of our own state.
let emit: (event: SSEEvent) => void;

const send = (type: string, data: Record<string, number>) => {
  act(() => {
    emit({ type, data, timestamp: new Date().toISOString() });
  });
};

const renderStatus = () =>
  render(
    <CategorizationProvider>
      <CategorizationStatus />
    </CategorizationProvider>
  );

describe('CategorizationStatus', () => {
  beforeEach(() => {
    emit = () => {};
    (useSSE as jest.Mock).mockImplementation((onEvent: (event: SSEEvent) => void) => {
      if (onEvent) emit = onEvent;
      return { connected: true, error: null, lastEvent: null, connect: jest.fn(), disconnect: jest.fn() };
    });
  });

  it('stays out of the way when nothing is being categorised', () => {
    renderStatus();

    expect(screen.queryByTestId('categorization-status')).not.toBeInTheDocument();
  });

  it('reports how far along a running batch is', () => {
    renderStatus();

    send('categorization:progress', { processed: 10, total: 40, categorized: 7, uncategorized: 3, failed: 0 });

    expect(screen.getByText(/Categorising your transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/10 of 40 looked at, 7 categorised so far/i)).toBeInTheDocument();
    expect(screen.getByTestId('categorization-progress')).toHaveAttribute('aria-valuenow', '25');
  });

  it('summarises the batch once it finishes', () => {
    renderStatus();

    send('categorization:progress', { processed: 40, total: 40, categorized: 30, uncategorized: 10, failed: 0 });
    send('categorization:complete', { total: 40, categorized: 30, uncategorized: 10, failed: 0 });

    expect(screen.getByText(/Categorised 30 of 40 new transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/10 still need a category/i)).toBeInTheDocument();
  });

  it('says so when nothing was left over', () => {
    renderStatus();

    send('categorization:complete', { total: 5, categorized: 5, uncategorized: 0, failed: 0 });

    expect(screen.getByText(/Everything that came in has a category/i)).toBeInTheDocument();
  });

  it('counts transactions that failed as still needing attention', () => {
    renderStatus();

    send('categorization:complete', { total: 5, categorized: 3, uncategorized: 1, failed: 1 });

    expect(screen.getByText(/2 still need a category/i)).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    renderStatus();

    send('categorization:complete', { total: 5, categorized: 5, uncategorized: 0, failed: 0 });
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByText(/Categorised 5 of 5/i)).not.toBeInTheDocument();
  });

  it('pays no attention to the other events on the stream', () => {
    renderStatus();

    send('scraping:completed', { transactionsImported: 40 });
    send('heartbeat', {});

    expect(screen.queryByTestId('categorization-status')).not.toBeInTheDocument();
  });
});
