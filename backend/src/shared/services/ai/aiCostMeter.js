const { AsyncLocalStorage } = require('async_hooks');

/**
 * Adds up what one piece of work spent with the model.
 *
 * `aiBudget` answers "has this user spent too much today". This answers the
 * question the budget has to be *chosen* from - "what did one run actually
 * cost" - which nothing could report before: every call logged its own tokens
 * and nothing added them up, so the per-transaction figure the ceiling is sized
 * against was an estimate that no run had ever confirmed.
 *
 * Scoped to the async context rather than read as a before/after delta on the
 * shared per-user counter, because runs overlap. The low-priority queue runs two
 * jobs at once and the request-driven AI paths share the process, so a delta
 * would quietly charge one run for another's tokens - worst of all during a
 * large import, which is exactly when the measurement matters.
 */
const storage = new AsyncLocalStorage();

const describe = (byPurpose) =>
  [...byPurpose.entries()]
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .map(([purpose, { tokens, calls }]) => `${purpose}=${tokens} in ${calls} call${calls === 1 ? '' : 's'}`)
    .join(', ');

const summarise = (meter) => ({
  tokens: meter.tokens,
  calls: meter.calls,
  byPurpose: Object.fromEntries(
    [...meter.byPurpose.entries()].map(([purpose, totals]) => [purpose, { ...totals }])
  ),
  breakdown: describe(meter.byPurpose)
});

class AiCostMeter {
  /**
   * Runs `fn`, returning both its result and what it spent.
   *
   * Everything the model is asked for inside counts, however deep - the point is
   * the total a run costs, and threading an accumulator through the classifier,
   * the categoriser and the batching would only measure the places someone
   * remembered to thread it through.
   */
  async measure(fn) {
    const meter = {
      parent: storage.getStore(),
      tokens: 0,
      calls: 0,
      byPurpose: new Map()
    };

    const result = await storage.run(meter, fn);
    return { result, cost: summarise(meter) };
  }

  /**
   * Notes one completed request. Called from `llmService`, so a caller cannot
   * spend anything without it being counted.
   *
   * Deliberately total: a measurement is worth less than the result it is
   * measuring, so nothing here is allowed to fail the request. Outside any
   * `measure` it is a no-op, which is the normal case for a one-off request.
   */
  record(purpose, tokens) {
    const amount = Number(tokens);
    // 0 still counts as a call - a request that returned nothing useful is a
    // request that was made, and a run full of them is worth seeing.
    if (!Number.isFinite(amount) || amount < 0) return;

    const key = purpose || 'unspecified';

    // Up the whole chain, so measuring an inner step does not hide its cost from
    // an outer measurement of the run that contains it.
    for (let meter = storage.getStore(); meter; meter = meter.parent) {
      meter.tokens += amount;
      meter.calls += 1;
      const totals = meter.byPurpose.get(key) || { tokens: 0, calls: 0 };
      totals.tokens += amount;
      totals.calls += 1;
      meter.byPurpose.set(key, totals);
    }
  }
}

module.exports = new AiCostMeter();
