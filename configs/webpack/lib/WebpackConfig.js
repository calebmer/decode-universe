const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CheckerPlugin, TsConfigPathsPlugin } = require('awesome-typescript-loader');
const BabiliPlugin = require('babili-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');

const { DefinePlugin, HotModuleReplacementPlugin } = webpack;

const create = ({
  dev = process.env.NODE_ENV === 'development',
  target,
  node = false,
  react = false,
  entry,
  tsconfig = path.resolve(path.dirname(entry[entry.length - 1]), '../tsconfig.json'),
  entryHTML = react ? path.resolve(path.dirname(entry[entry.length - 1]), 'app.html') : null,
}) => ({
  target,
  // We want to bail on error if this is a production build.
  bail: !dev,
  // Perhaps consider use `cheap-module-source-map` in development if
  // `source-map` is too slow.
  devtool: 'source-map',
  // Define the files that start our bundle. Filter out any falsey entries.
  entry: [
    // // Include some extra scripts when developing for React to get a better DX.
    // react && dev && 'react-dev-utils/webpackHotDevClient',
    // TODO: react && dev && 'react-dev-utils/crashOverlay',
    // The actual entry file.
    ...entry,
  ].filter(Boolean),
  // Where should we output the bundle?
  output: {
    // Always put it in the build directory.
    path: path.resolve(path.dirname(entry[entry.length - 1]), 'build'),
    // Provide some path info with all the modules for debugging.
    pathinfo: true,
    // There will be one main bundle with other smaller bundles when code
    // splitting.
    filename: dev ? './bundle.js' : './bundle.[hash:8].js',
    chunkFilename: './chunk.[chunkhash:8].js',
  },
  externals: [
    // If this is a Node.js bundle then we want to externalize all of the
    // dependencies so that they are required with commonjs.
    (context, request, callback) => {
      if (node && /^[a-zA-Z]/.test(request)) {
        callback(null, `commonjs ${request}`);
      } else {
        callback();
      }
    },
  ],
  // How should we resolve files?
  resolve: {
    // Make sure to add `.ts` to module resolution.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  module: {
    rules: [
      // Compile all of our JavaScript and TypeScript files with TypeScript.
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: path.resolve(__dirname, '../../../src'),
        exclude: /node_modules/,
        loader: 'awesome-typescript-loader',
        options: {
          // Use the configured tsconfig instead of a default one.
          configFileName: tsconfig,
        },
      },
      // Tells Webpack about the TypeScript source maps so it can use them when
      // Webpack is generating its own source maps.
      {
        enforce: 'pre',
        test: /\.js$/,
        include: path.resolve(__dirname, '../../../src'),
        exclude: /node_modules/,
        loader: 'source-map-loader',
      },
    ],
  },
  plugins: [
    // Add the appropriate TypeScript plugins.
    new CheckerPlugin(),
    new TsConfigPathsPlugin(),
    // Generates an html file with the <script> injected if the user provided
    // some `entryHTML` path.
    entryHTML && new HtmlWebpackPlugin({
      inject: true,
      template: entryHTML,
      filename: 'app.html',
      // Minify the HTML in production, but not in development.
      minify: dev ? undefined : {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    // Define our environment variables statically so that they may be minifed
    // out in some cases.
    new DefinePlugin({
      DEV: JSON.stringify(dev),
      // Many libraries, including React, use `NODE_ENV` so we need to
      // define it.
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    }),
    // Used for any hot replacement functionalities we may use in the future.
    // Currently hot reloading for JavaScripts is not set up.
    react && dev && new HotModuleReplacementPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    dev && new WatchMissingNodeModulesPlugin(),
    // Minify JavaScript in production. We use Babili to get support for
    // ES2015+ syntax.
    !dev && new BabiliPlugin(),
  ].filter(Boolean),
  // Do not add polyfills for `__filename` and `__dirname`.
  node: !node ? undefined : {
    __filename: false,
    __dirname: false,
  },
  // Configure the webpack watch mode.
  watchOptions: {
    // Do not watch the build folder for changes.
    ignored: /\/build\//,
  },
});

const WebpackConfig = {
  create,
};

module.exports = WebpackConfig;
