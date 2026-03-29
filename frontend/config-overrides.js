const path = require('path');

module.exports = function override(config, env) {
  // Add fallback for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
  };

  // Tune ForkTsCheckerWebpackPlugin to prevent OOM.
  // In CI, remove it entirely (type checking handled by dedicated tsc step).
  // In dev, increase its memory limit.
  try {
    const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
    if (process.env.CI) {
      config.plugins = config.plugins.filter(
        (plugin) => !(plugin instanceof ForkTsCheckerWebpackPlugin)
      );
    } else {
      config.plugins.forEach((plugin) => {
        if (plugin instanceof ForkTsCheckerWebpackPlugin) {
          plugin.options = plugin.options || {};
          plugin.options.typescript = plugin.options.typescript || {};
          plugin.options.typescript.memoryLimit = 4096;
        }
      });
    }
  } catch (e) {
    // Plugin not found — nothing to configure
  }

  return config;
};
