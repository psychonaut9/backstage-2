const path = require('path');
const WebpackPluginFailBuildOnWarning = require('./webpack-plugin-fail-build-on-warning');

module.exports = ({ args }) => {
  // Calling storybook with no args causes our default list of stories to be used.
  // This set of stories are the ones that we publish to backstage.io
  //
  // If it's called with args, each arg should be the path to a package that we will
  // show the stories from, for example `yarn storybook plugins/catalog`.
  let stories;
  if (args.length === 0) {
    stories = [
      '../../core-components/src/**/*.stories.tsx',
      '../../../plugins/org/src/**/*.stories.tsx',
      '../../../plugins/search/src/**/*.stories.tsx',
    ];
  } else {
    const rootDir = path.resolve(__dirname, '../../..');
    stories = args.map(arg => path.join(rootDir, arg, 'src/**/*.stories.tsx'));
  }

  return {
    stories,
    addons: [
      '@storybook/addon-a11y',
      '@storybook/addon-actions',
      '@storybook/addon-links',
      '@storybook/addon-storysource',
      'storybook-dark-mode/register',
    ],
    webpackFinal: async config => {
      // Mirror config in packages/cli/src/lib/bundler
      config.resolve.mainFields = ['browser', 'module', 'main'];

      // Remove the default babel-loader for js files, we're using sucrase instead
      const [jsLoader] = config.module.rules.splice(0, 1);
      if (!jsLoader.use[0].loader.includes('babel-loader')) {
        throw new Error(
          `Unexpected loader removed from storybook config, ${jsLoader.use[0].loader}`,
        );
      }

      config.resolve.extensions.push('.ts', '.tsx');

      config.module.rules.push(
        {
          test: /\.(tsx?)$/,
          exclude: /node_modules/,
          loader: require.resolve('@sucrase/webpack-loader'),
          options: {
            transforms: ['typescript', 'jsx', 'react-hot-loader'],
          },
        },
        {
          test: /\.(jsx?|mjs)$/,
          exclude: /node_modules/,
          loader: require.resolve('@sucrase/webpack-loader'),
          options: {
            transforms: ['jsx', 'react-hot-loader'],
          },
        },
      );

      // Disable ProgressPlugin which logs verbose webpack build progress. Warnings and Errors are still logged.
      config.plugins = config.plugins.filter(
        ({ constructor }) => constructor.name !== 'ProgressPlugin',
      );

      // Fail storybook build on CI if there are webpack warnings.
      if (process.env.CI) {
        config.plugins.push(new WebpackPluginFailBuildOnWarning());
      }

      return config;
    },
  };
};
