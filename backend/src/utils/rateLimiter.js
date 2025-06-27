/**
 * Simple token bucket rate limiter implementation
 */
class RateLimiter {
  constructor(options) {
    this.maxRequests = options.maxRequests;
    this.perSeconds = options.perSeconds;
    this.tokensPerInterval = this.maxRequests / this.perSeconds;
    this.buckets = new Map();
  }

  async acquire(key) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: this.maxRequests,
        lastRefill: Date.now()
      });
    }

    const bucket = this.buckets.get(key);
    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.tokensPerInterval;

    bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const waitTime = (1 - bucket.tokens) / this.tokensPerInterval * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire(key);
    }

    bucket.tokens -= 1;
    return true;
  }

  release(key) {
    // Optional: Clean up buckets that haven't been used for a while
    const bucket = this.buckets.get(key);
    if (bucket) {
      const now = Date.now();
      if (now - bucket.lastRefill > this.perSeconds * 1000 * 2) {
        this.buckets.delete(key);
      }
    }
  }
}

module.exports = {
  createLimiter: (options) => new RateLimiter(options)
};
