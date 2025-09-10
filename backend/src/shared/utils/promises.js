/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMsg - Error message if timeout occurs
 * @returns {Promise} - Promise that will reject if timeout occurs
 */
function promiseWithTimeout(promise, timeoutMs, errorMsg = 'Operation timed out') {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutHandle));
}

module.exports = {
  promiseWithTimeout
};
