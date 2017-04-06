const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');

const { DefinePlugin, HotModuleReplacementPlugin } = webpack;
const { UglifyJsPlugin } = webpack.optimize;

const DEV = process.env.NODE_ENV === 'development';

const paths = {
  source: path.join(__dirname, './src'),
  build: path.join(__dirname, './build'),
  mainTS: path.join(__dirname, './src/main.ts'),
  mainHTML: path.join(__dirname, './public/index.html'),
};

module.exports = {
  // We want to bail on error if this is a production build.
  bail: !DEV,
  // Perhaps consider use `cheap-module-source-map` in development if
  // `source-map` is too slow.
  devtool: 'source-map',
  entry: [
    // Include some extra scripts in development for a better DX.
    DEV && 'react-dev-utils/webpackHotDevClient',
    DEV && 'react-dev-utils/crashOverlay',
    // Include the main script for our app.
    paths.mainTS,
  ].filter(Boolean),
  output: {
    path: paths.build,
    pathinfo: true,
    // There will be one main bundle with other smaller bundles when code
    // splitting.
    filename: 'static/js/[name].[chunkhash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',
  },
  resolve: {
    // Make sure to add `.ts` to module resolution.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  module: {
    rules: [
      // Compile all of our JavaScript and TypeScript files with TypeScript.
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'awesome-typescript-loader',
      },
      // Tells Webpack about the TypeScript source maps so it can use them when
      // Webpack is generating its own source maps.
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader',
      },
    ],
  },
  plugins: [
    // Generates an `index.html` file with the <script> injected.
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.mainHTML,
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
      NODE_ENV: JSON.stringify(DEV ? 'development' : 'production'),
    }),
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
