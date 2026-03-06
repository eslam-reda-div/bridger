module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testTimeout: 60000,
  // Run sequentially — workers are shared resources
  maxWorkers: 1,
};
