const path = require('path');

module.exports = function override(config, env) {
  // Add fallback for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
  };

  // Increase memory limit for TypeScript checker to prevent OOM during builds
  const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
  const tsCheckerPlugin = config.plugins.find(
    (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
  );
  if (tsCheckerPlugin && tsCheckerPlugin.options) {
    tsCheckerPlugin.options.typescript = {
      ...tsCheckerPlugin.options.typescript,
      memoryLimit: 2048,
    };
  }

  return config;
};
