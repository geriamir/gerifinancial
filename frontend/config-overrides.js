const path = require('path');

module.exports = function override(config, env) {
  // Add fallback for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
  };

  // In CI, remove the forked TS checker to prevent OOM.
  // Type checking is already handled by the unit test workflow.
  if (process.env.CI) {
    const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
    config.plugins = config.plugins.filter(
      (plugin) => !(plugin instanceof ForkTsCheckerWebpackPlugin)
    );
  }

  return config;
};
