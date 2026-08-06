const config = require('../../config');

// BullMQ is the thing under test here - what matters is the options the queues
// and workers are constructed with, not that a real Redis answers.
jest.mock('bullmq');

// setup.js swaps this module out for a stub everywhere else, since no test
// should reach Redis. This suite is the one place that has to see the real one.
describe('scrapingQueue wiring', () => {
  const REMOTE_HOST = 'redis.internal.test';
  const REMOTE_PORT = '6380';
  const originalHost = process.env.REDIS_HOST;
  const originalPort = process.env.REDIS_PORT;

  let scrapingQueue;
  let Queue;
  let Worker;

  beforeEach(() => {
    // A host that is deliberately not localhost: the failure this guards
    // against is a silent fallback to BullMQ's own 127.0.0.1 default, which
    // looks correct in development and only breaks once Redis lives elsewhere.
    process.env.REDIS_HOST = REMOTE_HOST;
    process.env.REDIS_PORT = REMOTE_PORT;
    jest.resetModules();
    ({ Queue, Worker } = require('bullmq'));
    scrapingQueue = jest.requireActual('../scrapingQueue');
  });

  afterEach(async () => {
    await scrapingQueue.shutdown().catch(() => {});
    if (originalHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = originalHost;
    if (originalPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = originalPort;
  });

  it('points its queues at the configured Redis rather than localhost', async () => {
    await scrapingQueue.initialize();

    expect(Queue).toHaveBeenCalled();
    for (const [, options] of Queue.mock.calls) {
      expect(options.connection).toEqual(
        expect.objectContaining({ host: REMOTE_HOST, port: Number(REMOTE_PORT) })
      );
    }
  });

  it('does not pass the connection under Bull v3\'s name, which BullMQ ignores', async () => {
    await scrapingQueue.initialize();

    // `redis` was Bull v3's option. BullMQ neither reads nor rejects it, so a
    // queue configured that way connects to 127.0.0.1:6379 and every job sits
    // unqueued behind a connection that is refused - with no error to say so.
    for (const [, options] of Queue.mock.calls) {
      expect(options).not.toHaveProperty('redis');
    }
  });

  it('gives the workers the same Redis the queues were given', async () => {
    await scrapingQueue.startProcessing();

    expect(Worker).toHaveBeenCalled();
    const queueConnections = Queue.mock.calls.map(([, options]) => options.connection);
    // Producers and consumers disagreeing is the quiet version of this bug:
    // jobs land in one Redis and are waited for in another, and nothing errors.
    // Worker takes the processor as its second argument, so options are third.
    for (const [, , options] of Worker.mock.calls) {
      expect(queueConnections).toContainEqual(options.connection);
    }
  });

  it('builds every configured priority queue', async () => {
    await scrapingQueue.initialize();

    const names = Queue.mock.calls.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining(['scraping-high', 'scraping-normal', 'scraping-low'])
    );
  });

  it('carries the credentials from config through to the connection', async () => {
    await scrapingQueue.initialize();

    const [, options] = Queue.mock.calls[0];
    expect(options.connection.password).toBe(config.redis.password);
    expect(options.connection.db).toBe(config.redis.db);
  });
});
