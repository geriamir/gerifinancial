import {
  CategorizationEvent,
  CategorizationState,
  CATEGORIZATION_EVENTS,
  initialCategorizationState,
  reduceCategorization
} from '../categorizationState';

// setupTests replaces the whole useSSE module with a stub of the hook, so the
// real registry has to be reached past it.
const { SSE_EVENT_TYPES } = jest.requireActual<typeof import('../../hooks/useSSE')>('../../hooks/useSSE');

const run = (events: CategorizationEvent[], from: CategorizationState = initialCategorizationState) =>
  events.reduce(reduceCategorization, from);

const progress = (data: Record<string, number>): CategorizationEvent => ({
  type: 'categorization:progress',
  data
});

const complete = (data: Record<string, number>): CategorizationEvent => ({
  type: 'categorization:complete',
  data
});

describe('reduceCategorization', () => {
  it('starts out with nothing to say', () => {
    expect(initialCategorizationState.active).toBe(false);
    expect(initialCategorizationState.finished).toBeNull();
    expect(initialCategorizationState.revision).toBe(0);
  });

  it('marks a batch as running while progress arrives', () => {
    const state = run([progress({ processed: 10, total: 40, categorized: 7, uncategorized: 3, failed: 0 })]);

    expect(state.active).toBe(true);
    expect(state).toMatchObject({ processed: 10, total: 40, categorized: 7, uncategorized: 3 });
    expect(state.finished).toBeNull();
  });

  it('stops being active once the batch completes', () => {
    const state = run([
      progress({ processed: 40, total: 40, categorized: 30, uncategorized: 10, failed: 0 }),
      complete({ total: 40, categorized: 30, uncategorized: 10, failed: 0 })
    ]);

    expect(state.active).toBe(false);
    expect(state.finished).toEqual({ total: 40, categorized: 30, uncategorized: 10, failed: 0 });
  });

  describe('revision', () => {
    // The revision is a list refresh in disguise, so every assertion here is
    // really about how many times the transactions list refetches.
    it('advances when transactions have gained a category', () => {
      const state = run([progress({ processed: 10, total: 40, categorized: 7 })]);
      expect(state.revision).toBe(1);
    });

    it('stays put when a report brings no new categories', () => {
      const after = run([
        progress({ processed: 10, total: 40, categorized: 7 }),
        progress({ processed: 20, total: 40, categorized: 7 })
      ]);

      expect(after.revision).toBe(1);
    });

    it('does not advance again on completion when the last report already covered it', () => {
      const state = run([
        progress({ processed: 40, total: 40, categorized: 30 }),
        complete({ total: 40, categorized: 30 })
      ]);

      expect(state.revision).toBe(1);
    });

    // A tab opened while the queue was already running, or one whose stream
    // dropped and reconnected, sees only the completion. It still has a stale
    // list on screen.
    it('advances on a completion for a batch it never saw running', () => {
      const state = run([complete({ total: 40, categorized: 30 })]);
      expect(state.revision).toBe(1);
    });

    it('ignores a batch that categorised nothing', () => {
      const state = run([
        progress({ processed: 5, total: 5, categorized: 0, uncategorized: 5 }),
        complete({ total: 5, categorized: 0, uncategorized: 5 })
      ]);

      expect(state.revision).toBe(0);
    });
  });

  // A checking account and the credit cards that pay it off are scraped as
  // separate jobs, so a second batch follows the first within seconds.
  describe('a second batch', () => {
    const firstBatch = run([
      progress({ processed: 40, total: 40, categorized: 30, uncategorized: 10 }),
      complete({ total: 40, categorized: 30, uncategorized: 10 })
    ]);

    it('reports its own totals rather than continuing the previous ones', () => {
      const state = reduceCategorization(
        firstBatch,
        progress({ processed: 2, total: 12, categorized: 1, uncategorized: 1 })
      );

      expect(state).toMatchObject({ processed: 2, total: 12, categorized: 1, uncategorized: 1 });
    });

    it('still refreshes the list even though it has categorised fewer than the last', () => {
      const state = reduceCategorization(firstBatch, progress({ processed: 2, total: 12, categorized: 1 }));

      expect(state.revision).toBe(firstBatch.revision + 1);
    });

    it('clears the previous batch\'s summary while it runs', () => {
      const state = reduceCategorization(firstBatch, progress({ processed: 2, total: 12, categorized: 1 }));

      expect(firstBatch.finished).not.toBeNull();
      expect(state.finished).toBeNull();
    });
  });

  it('says nothing about an empty batch', () => {
    const state = run([complete({ total: 0, categorized: 0, uncategorized: 0, failed: 0 })]);

    expect(state.finished).toBeNull();
    expect(state.revision).toBe(0);
  });

  it('survives a report with fields missing', () => {
    const state = run([progress({}), complete({})]);

    expect(state).toMatchObject({ processed: 0, total: 0, categorized: 0 });
    expect(state.finished).toBeNull();
  });

  it('drops the summary when dismissed', () => {
    const state = run([
      progress({ processed: 1, total: 1, categorized: 1 }),
      complete({ total: 1, categorized: 1 }),
      { type: 'dismiss' }
    ]);

    expect(state.finished).toBeNull();
    expect(state.revision).toBe(1);
  });

  // An event the stream does not subscribe to is dropped by EventSource before
  // any of this runs, and nothing anywhere reports that it happened.
  it('is driven by events the stream actually subscribes to', () => {
    CATEGORIZATION_EVENTS.forEach((eventType) => {
      expect(SSE_EVENT_TYPES).toContain(eventType);
    });
  });
});
