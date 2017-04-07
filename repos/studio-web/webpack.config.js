const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CheckerPlugin, TsConfigPathsPlugin } = require('awesome-typescript-loader');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');

const { DefinePlugin, HotModuleReplacementPlugin } = webpack;
const { UglifyJsPlugin } = webpack.optimize;

const DEV = process.env.NODE_ENV === 'development';

module.exports = {
  target: 'web',
  // We want to bail on error if this is a production build.
  bail: !DEV,
  // Perhaps consider use `cheap-module-source-map` in development if
  // `source-map` is too slow.
  devtool: 'source-map',
  // If we are in development then we will be using a dev server which we want
  // to configure.
  devServer: !DEV ? undefined : {
    // Enable gzip compression.
    compress: true,
    // Silence the dev server logs. It will still show warnings and errors with
    // this setting, however.
    clientLogLevel: 'none',
    // By default changes in our public folder will not trigger a page reload.
    watchContentBase: true,
    // Enable a hot reloading server. It will provide a websocket endpoint for
    // the dev server client. Instead of using the standard webpack dev server
    // client we use a client from `react-dev-utils` which has a nicer
    // development experience.
    hot: true,
  },
  // Define the files that start our bundle.
  entry: [
    // Include some extra scripts in development for a better DX.
    DEV && 'react-dev-utils/webpackHotDevClient',
    // TODO: DEV && 'react-dev-utils/crashOverlay',
    // Include the WebRTC adapter because WebRTC implementations vary so wildly
    // that we really need this compatibility layer for consistency.
    'webrtc-adapter',
    // Include the main script for our app.
    path.join(__dirname, './src/index.tsx'),
  ].filter(Boolean),
  output: {
    path: path.join(__dirname, './build'),
    pathinfo: true,
    // There will be one main bundle with other smaller bundles when code
    // splitting.
    filename: 'static/js/[name].[hash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',
  },
  resolve: {
    // Make sure to add `.ts` to module resolution.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Allow our code to import from other Decode repos.
      '@decode/studio-ui': path.join(__dirname, '../studio-ui/src'),
    },
  },
  module: {
    rules: [
      // Compile all of our JavaScript and TypeScript files with TypeScript.
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: [
          path.join(__dirname, './src'),
          path.join(__dirname, '../studio-ui/src'),
          path.join(__dirname, '../studio-signal-exchange/src'),
        ],
        loader: 'awesome-typescript-loader',
      },
      // Tells Webpack about the TypeScript source maps so it can use them when
      // Webpack is generating its own source maps.
      {
        enforce: 'pre',
        test: /\.js$/,
        include: [
          path.join(__dirname, './src'),
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
      template: path.join(__dirname, './src/index.html'),
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
    // Used for any hot replacement functionalities we may use in the future.
    // Currently hot reloading for JavaScripts is not set up.
    DEV && new HotModuleReplacementPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    DEV && new WatchMissingNodeModulesPlugin(),
    // Minify JavaScript in production.
    !DEV && new UglifyJsPlugin({
      compress: {
        screw_ie8: true, // React doesn't support IE8
        warnings: false,
      },
      mangle: {
        screw_ie8: true,
      },
      output: {
        comments: false,
        screw_ie8: true,
      },
      sourceMap: true,
    }),
  ].filter(Boolean),
};
