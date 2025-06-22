const webpackConfig = require('./webpack.config');

module.exports = function override(config, env) {
  return {
    ...config,
    devServer: {
      ...config.devServer,
      ...webpackConfig.devServer
    }
  };
};
