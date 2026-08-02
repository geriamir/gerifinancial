/**
 * The state behind the "we are categorising your transactions" indicator.
 *
 * Kept as a plain reducer, away from the SSE plumbing, because the interesting
 * behaviour here is not the transport - it is deciding when a batch has started,
 * when the categories on the server have actually changed, and when there is
 * something worth telling the user. All of that is exercised directly in tests
 * without standing up an EventSource.
 */

export interface CategorizationSummary {
  total: number;
  categorized: number;
  uncategorized: number;
  failed: number;
}

export interface CategorizationState extends CategorizationSummary {
  /** A batch is being worked on right now. */
  active: boolean;
  processed: number;
  /** The result of the batch that just finished, or null while idle or running. */
  finished: CategorizationSummary | null;
  /**
   * Bumped whenever transactions on the server have gained a category. Lists
   * pass this straight through as their refresh trigger, so it must only move
   * when a refetch would actually show something new - a scrape of a few
   * hundred transactions reports progress every ten of them, and refetching on
   * each one would put the list through dozens of pointless round trips.
   */
  revision: number;
}

export const initialCategorizationState: CategorizationState = {
  active: false,
  processed: 0,
  total: 0,
  categorized: 0,
  uncategorized: 0,
  failed: 0,
  finished: null,
  revision: 0
};

export type CategorizationEvent =
  | { type: 'categorization:progress'; data: Partial<CategorizationSummary & { processed: number }> }
  | { type: 'categorization:complete'; data: Partial<CategorizationSummary> }
  | { type: 'dismiss' };

/** The events this state is driven by, as the server names them on the stream. */
export const CATEGORIZATION_EVENTS = ['categorization:progress', 'categorization:complete'] as const;

export type CategorizationEventType = (typeof CATEGORIZATION_EVENTS)[number];

const isCategorizationEvent = (type: string): type is CategorizationEventType =>
  (CATEGORIZATION_EVENTS as readonly string[]).includes(type);

export { isCategorizationEvent };

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const reduceCategorization = (
  state: CategorizationState,
  event: CategorizationEvent
): CategorizationState => {
  switch (event.type) {
    case 'categorization:progress': {
      const processed = count(event.data.processed);
      const categorized = count(event.data.categorized);

      // Two batches can run back to back - a checking account and then the
      // credit cards it pays off. Counters that only ever climb would show the
      // second batch continuing the first one's totals.
      const isNewBatch = !state.active || processed < state.processed;
      const previouslyCategorized = isNewBatch ? 0 : state.categorized;

      return {
        active: true,
        processed,
        total: count(event.data.total),
        categorized,
        uncategorized: count(event.data.uncategorized),
        failed: count(event.data.failed),
        finished: null,
        revision: categorized > previouslyCategorized ? state.revision + 1 : state.revision
      };
    }

    case 'categorization:complete': {
      const total = count(event.data.total);
      const categorized = count(event.data.categorized);
      const summary: CategorizationSummary = {
        total,
        categorized,
        uncategorized: count(event.data.uncategorized),
        failed: count(event.data.failed)
      };

      return {
        ...summary,
        active: false,
        processed: total,
        // An empty batch is the queue draining, not news. Saying so would put a
        // notice on screen that the user cannot act on and did not ask for.
        finished: total > 0 ? summary : null,
        // Normally the last progress report has already accounted for these, so
        // only a batch we never saw running - a tab opened mid-job, a dropped
        // connection - still owes the list a refresh.
        revision:
          categorized > 0 && (!state.active || categorized > state.categorized)
            ? state.revision + 1
            : state.revision
      };
    }

    case 'dismiss':
      return { ...state, finished: null };

    default:
      return state;
  }
};
