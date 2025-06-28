const path = require('path');

module.exports = function override(config, env) {
  // Configure module resolution for ESM
  config.resolve.mainFields = ['module', 'main'];

  // Add rules to handle ESM imports
  config.module.rules.push({
    test: /\.m?js$/,
    include: [
      /node_modules\/date-fns/,
      /node_modules\/@mui/
    ],
    resolve: {
      fullySpecified: false
    },
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env'],
        plugins: [
          ['@babel/plugin-transform-modules-commonjs', { loose: true }]
        ]
      }
    }
  });

  // Add fallback for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
  };

  return config;
};
