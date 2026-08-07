// BullMQ is the thing under test here - what matters is the options the queues
// and workers are constructed with, not that a real Redis answers.
jest.mock('bullmq');

// setup.js swaps this module out for a stub everywhere else, since no test
// should reach Redis. This suite is the one place that has to see the real one.
describe('scrapingQueue wiring', () => {
  const REMOTE = {
    REDIS_HOST: 'redis.internal.test',
    REDIS_PORT: '6380',
    REDIS_PASSWORD: 'a-password-that-must-be-carried-through',
    REDIS_DB: '3'
  };
  const originalEnv = {};

  let scrapingQueue;
  let config;
  let Queue;
  let Worker;

  beforeEach(() => {
    // A host that is deliberately not localhost, and credentials that are
    // deliberately not empty: the failure this guards against is a silent
    // fallback to BullMQ's own 127.0.0.1 default, which looks correct in
    // development and only breaks once Redis lives somewhere else.
    for (const [key, value] of Object.entries(REMOTE)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }

    jest.resetModules();
    ({ Queue, Worker } = require('bullmq'));
    // Required after the reset so this is the same instance the service reads.
    // config derives its values from the environment at require time, so a copy
    // loaded earlier would still describe the old one.
    config = require('../../config');
    scrapingQueue = jest.requireActual('../scrapingQueue');
  });

  afterEach(async () => {
    // Not wrapped in a catch: a shutdown that starts throwing is something
    // these tests should report rather than hide.
    await scrapingQueue.shutdown();

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('points its queues at the configured Redis rather than localhost', async () => {
    await scrapingQueue.initialize();

    expect(Queue).toHaveBeenCalled();
    for (const [, options] of Queue.mock.calls) {
      expect(options.connection).toEqual(
        expect.objectContaining({
          host: REMOTE.REDIS_HOST,
          port: Number(REMOTE.REDIS_PORT)
        })
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
    expect(options.connection.password).toBe(REMOTE.REDIS_PASSWORD);
    expect(options.connection.db).toBe(Number(REMOTE.REDIS_DB));
    // Pinned to config as well as to the raw values, so this still holds if
    // the way credentials reach the queue changes.
    expect(options.connection.password).toBe(config.redis.password);
    expect(options.connection.db).toBe(config.redis.db);
  });
});
