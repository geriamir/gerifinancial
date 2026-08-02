/**
 * Stand-in for the BullMQ-backed queue.
 *
 * Queued work is deliberately not run here. A test that wants to check what a
 * job does calls the processor directly; letting the mock run it would make
 * every unrelated test pay for work the real system does out of band, and would
 * hide the fact that it happens asynchronously.
 */
const jobs = [];

module.exports = {
  jobs,

  initialize: jest.fn(async () => {}),
  startProcessing: jest.fn(async () => {}),
  shutdown: jest.fn(async () => {}),
  registerProcessor: jest.fn(() => {}),

  addJob: jest.fn(async (jobType, jobData) => {
    jobs.push({ jobType, jobData });
    return `mock-job-${jobs.length}`;
  }),

  addScrapingJob: jest.fn(async (jobType, bankAccountId, strategyName, jobData) => {
    jobs.push({ jobType, jobData: { bankAccountId, strategyName, ...jobData } });
    return `mock-job-${jobs.length}`;
  }),

  getAllStats: jest.fn(async () => ({})),
  healthCheck: jest.fn(async () => ({ healthy: true })),
  clearQueue: jest.fn(async () => {}),
  pauseQueue: jest.fn(async () => {}),
  resumeQueue: jest.fn(async () => {}),

  __reset: () => { jobs.length = 0; }
};
