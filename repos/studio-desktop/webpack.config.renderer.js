const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CheckerPlugin, TsConfigPathsPlugin } = require('awesome-typescript-loader');
const BabiliPlugin = require('babili-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');

const { DefinePlugin } = webpack;
const { UglifyJsPlugin } = webpack.optimize;

const DEV = process.env.NODE_ENV === 'development';

module.exports = {
  target: 'electron-renderer',
  // We want to bail on error if this is a production build.
  bail: !DEV,
  // Perhaps consider use `cheap-module-source-map` in development if
  // `source-map` is too slow.
  devtool: 'source-map',
  // Define the files that start our bundle.
  entry: [
    // TODO: DEV && 'react-dev-utils/crashOverlay',
    // Include the main script for our app.
    path.join(__dirname, './src/renderer/index.tsx'),
  ].filter(Boolean),
  output: {
    path: path.join(__dirname, './build/renderer'),
    pathinfo: true,
    // There will be one main bundle with other smaller bundles when code
    // splitting.
    filename: DEV ? 'static/js/bundle.js' : 'static/js/[name].[hash:8].js',
    chunkFilename: DEV ? undefined : 'static/js/[name].[chunkhash:8].chunk.js',
  },
  // Externalize all of the modules in `node_modules`. We don’t want them
  // bundled!
  externals: [nodeExternals()],
  resolve: {
    // Make sure to add `.ts` to module resolution.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Allow our code to import from other Decode repos.
      '@decode': path.resolve(__dirname, '..'),
      // Make sure we only have one copy of a few common dependencies.
      immutable: path.join(__dirname, './node_modules/immutable'),
      rxjs: path.join(__dirname, './node_modules/rxjs'),
    },
  },
  module: {
    rules: [
      // Compile all of our JavaScript and TypeScript files with TypeScript.
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: [
          path.join(__dirname, './src/renderer'),
          path.join(__dirname, '../studio-ui/src'),
          path.join(__dirname, '../studio-signal-exchange/src'),
        ],
        loader: 'awesome-typescript-loader',
        options: {
          // Use the tsconfig for the renderer and not our general tsconfig.
          configFileName: 'tsconfig.renderer.json',
        },
      },
      // Tells Webpack about the TypeScript source maps so it can use them when
      // Webpack is generating its own source maps.
      {
        enforce: 'pre',
        test: /\.js$/,
        include: [
          path.join(__dirname, './src/renderer'),
          path.join(__dirname, '../studio-ui/src'),
          path.join(__dirname, '../studio-signal-exchange/src'),
        ],
        loader: 'source-map-loader',
      },
    ],
  },
  plugins: [
    // Add the appropriate TypeScript plugins.
    new CheckerPlugin(),
    new TsConfigPathsPlugin(),
    // Generates an `index.html` file with the <script> injected.
    new HtmlWebpackPlugin({
      inject: true,
      template: path.join(__dirname, './src/renderer/index.html'),
      // Minify the HTML in production, but not in development.
      minify: DEV ? undefined : {
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
    // Define our environment so that React will be built appropriately.
    new DefinePlugin({
      DEV: JSON.stringify(DEV),
      // Many libraries, including React, use `NODE_ENV` so we need to
      // define it.
      'process.env.NODE_ENV': JSON.stringify(DEV ? 'development' : 'production'),
    }),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    DEV && new WatchMissingNodeModulesPlugin(),
    // Minify JavaScript in production with Babili which supports ES2015+ syntax
    // unlike UglifyJS.
    !DEV && new BabiliPlugin(),
  ].filter(Boolean),
};
