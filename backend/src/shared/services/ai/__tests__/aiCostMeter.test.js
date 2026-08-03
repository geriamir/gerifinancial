const aiCostMeter = require('../aiCostMeter');

// The number this produces is what the daily token budget gets sized against,
// so the ways it could be quietly wrong - counting another run's tokens,
// losing a nested step's - are pinned here rather than discovered by setting a
// ceiling from a figure nobody checked.
describe('aiCostMeter', () => {
  it('adds up what was spent inside the work it measures', async () => {
    const { result, cost } = await aiCostMeter.measure(async () => {
      aiCostMeter.record('categorisation-query', 12);
      aiCostMeter.record('categorisation-fallback-batch', 300);
      return 'done';
    });

    expect(result).toBe('done');
    expect(cost.tokens).toBe(312);
    expect(cost.calls).toBe(2);
  });

  it('keeps the purposes apart, so a run shows what the money went on', async () => {
    const { cost } = await aiCostMeter.measure(async () => {
      aiCostMeter.record('categorisation-query', 10);
      aiCostMeter.record('categorisation-query', 14);
      aiCostMeter.record('categorisation-fallback-batch', 300);
    });

    expect(cost.byPurpose).toEqual({
      'categorisation-query': { tokens: 24, calls: 2 },
      'categorisation-fallback-batch': { tokens: 300, calls: 1 }
    });
    // Dearest first: the point of reading this line is to find what to cut.
    expect(cost.breakdown).toBe(
      'categorisation-fallback-batch=300 in 1 call, categorisation-query=24 in 2 calls'
    );
  });

  // The low-priority queue runs two jobs at once and the request-driven AI paths
  // share the process. Measuring as a delta on the shared per-user counter would
  // charge each of these for the other's tokens.
  it('does not let overlapping runs charge each other', async () => {
    const started = [];
    const spend = async (purpose, tokens, delay) => aiCostMeter.measure(async () => {
      started.push(purpose);
      await new Promise((resolve) => setTimeout(resolve, delay));
      aiCostMeter.record(purpose, tokens);
    });

    const [first, second] = await Promise.all([
      spend('slow', 500, 20),
      spend('fast', 7, 1)
    ]);

    // Interleaved, not one after the other - otherwise this proves nothing.
    expect(started).toEqual(['slow', 'fast']);
    expect(first.cost.tokens).toBe(500);
    expect(second.cost.tokens).toBe(7);
  });

  it('counts a nested step against the run that contains it', async () => {
    const { cost, result } = await aiCostMeter.measure(async () => {
      aiCostMeter.record('outer', 5);
      const inner = await aiCostMeter.measure(async () => {
        aiCostMeter.record('inner', 100);
      });
      return inner.cost;
    });

    expect(result.tokens).toBe(100);
    expect(cost.tokens).toBe(105);
  });

  it('counts a request that returned nothing, because it was still a request', async () => {
    const { cost } = await aiCostMeter.measure(async () => {
      aiCostMeter.record('categorisation-query', 0);
    });

    expect(cost).toMatchObject({ tokens: 0, calls: 1 });
  });

  it('ignores a total that is not a number rather than poisoning the run', async () => {
    const { cost } = await aiCostMeter.measure(async () => {
      aiCostMeter.record('categorisation-query', undefined);
      aiCostMeter.record('categorisation-query', -5);
      aiCostMeter.record('categorisation-query', 8);
    });

    expect(cost).toMatchObject({ tokens: 8, calls: 1 });
  });

  // Most calls are one-off - a chat turn, an onboarding question - and nobody is
  // measuring those. Recording has to be safe outside a run.
  it('is a no-op outside any measurement', () => {
    expect(() => aiCostMeter.record('categorisation-query', 10)).not.toThrow();
  });

  it('gives back what the measured work returned, and lets it throw', async () => {
    await expect(
      aiCostMeter.measure(async () => { throw new Error('categorisation blew up'); })
    ).rejects.toThrow('categorisation blew up');
  });
});
