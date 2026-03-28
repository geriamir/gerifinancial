const path = require('path');

module.exports = function override(config, env) {
  // Add fallback for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
  };

  // In CI, remove the forked TS checker to prevent OOM.
  // Type checking is handled by a dedicated tsc step in CI.
  if (process.env.CI) {
    try {
      const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
      config.plugins = config.plugins.filter(
        (plugin) => !(plugin instanceof ForkTsCheckerWebpackPlugin)
      );
    } catch (e) {
      // Plugin not found — nothing to remove
    }
  }

  return config;
};
