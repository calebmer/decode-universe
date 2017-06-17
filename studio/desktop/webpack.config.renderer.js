const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const BabiliPlugin = require('babili-webpack-plugin');
const builtinModules = require('builtin-modules');

const { DefinePlugin, HotModuleReplacementPlugin } = webpack;
const { UglifyJsPlugin } = webpack.optimize;

// Create a boolean which tells us if we are building for development or
// production.
const DEV = process.env.NODE_ENV === 'development';
// If we are building for development and we have an `INITIAL_ROOM` environment
// variable then we want to use that as our initial room.
const INITIAL_ROOM = DEV ? process.env.INITIAL_ROOM || null : null;

const bundledModules = ['debug', 'react-error-overlay'];
const unresolvedUnbundledModules = [...builtinModules, 'electron'];
const sourceRegex = `${escapeRegExp(path.resolve(__dirname, '..'))}/[^/]+/src`;

module.exports = {
  target: 'electron-renderer',
  // We want to bail on error if this is a production build.
  bail: !DEV,
  // Use `eval` as the development tool instead of a source map because we want
  // to see the compiled output in DevTools instead of the source. For
  // production we want the full source maps.
  devtool: DEV ? 'eval' : 'source-map',
  // If we are in development then we will be using a dev server which we want
  // to configure.
  devServer: !DEV
    ? undefined
    : {
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
    DEV && 'react-error-overlay',
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
  externals: [
    // Externalize all of the modules in `node_modules`. We don’t want them
    // bundled! If someone is trying to require a module that does not start
    // with a `.` then we can assume that the dependency is not relative and can
    // be found in `node_modules`.
    (context, request, callback) => {
      if (
        // If the file starts with a letter then it is not a relative import and
        // we should externalize the module instead of bundling it.
        /^[a-zA-Z]/.test(request) &&
        // However, we do want to bundle certain Webpack utilities related to
        // hot reloading.
        !/^webpack\/hot\/dev-server/.test(request) &&
        // We also want to bundle some packages that have special browser builds
        // that won’t activate if we require them as node modules.
        !bundledModules.includes(request)
      ) {
        // If we are in development then we want to use the absolute path of
        // the module because our bundle is hosted from `webpack-dev-server`.
        //
        // Do this for all modules except those modules that are builtin and the
        // `electron` module. They should be required directly instead of
        // required by their absolute path.
        if (DEV && !unresolvedUnbundledModules.includes(request)) {
          callback(null, `commonjs ${require.resolve(request)}`);
        } else {
          // In production our bundle is loaded from the file system and so we
          // require the default module name.
          callback(null, `commonjs ${request}`);
        }
      } else {
        callback();
      }
    },
  ],
  resolve: {
    // Make sure to add `.ts` to module resolution.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Use the browser build for debug and not the Node.js build.
      debug: path.resolve(__dirname, '../../node_modules/debug/src/browser.js'),
    },
  },
  module: {
    rules: [
      // Compile all of our JavaScript and TypeScript files with TypeScript.
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: new RegExp(sourceRegex),
        loader: 'awesome-typescript-loader',
        options: {
          // The default instance name, `at-loader`, is confusing.
          instance: 'ts-loader',
          // Use the tsconfig for the renderer and not our general tsconfig.
          configFileName: 'tsconfig.renderer.json',
          // Only transpile in development. Do a full type check when building
          // for production.
          transpileOnly: DEV,
        },
      },
      // Tells Webpack about the TypeScript source maps so it can use them when
      // Webpack is generating its own source maps. We only want this for
      // production builds because we don’t care about source maps in
      // development.
      !DEV && {
        enforce: 'pre',
        test: /\.js$/,
        include: new RegExp(sourceRegex),
        loader: 'source-map-loader',
      },
    ].filter(Boolean),
  },
  plugins: [
    // Generates an `index.html` file with the <script> injected.
    new HtmlWebpackPlugin({
      inject: true,
      template: path.join(__dirname, './src/renderer/index.html'),
      // Minify the HTML in production, but not in development.
      minify: DEV
        ? undefined
        : {
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
    // Expose some environment variables to our code.
    new DefinePlugin({
      DEV: JSON.stringify(DEV),
      // Many libraries, including React, use `NODE_ENV` so we need to
      // define it.
      'process.env.NODE_ENV': JSON.stringify(
        DEV ? 'development' : 'production',
      ),
      // Define a build constants object.
      WEBPACK_BUILD_CONSTANTS: JSON.stringify({
        INITIAL_ROOM: INITIAL_ROOM,
        SIGNAL_SERVER_URL:
          process.env.DECODE_STUDIO_SIGNAL_SERVER_URL ||
            'http://localhost:2000',
        WEB_URL: process.env.DECODE_STUDIO_WEB_URL || 'http://localhost:1999',
      }),
    }),
    // Used for any hot replacement functionalities we may use in the future.
    // Currently hot reloading for JavaScripts is not set up.
    DEV && new HotModuleReplacementPlugin(),
    // If you require a missing module and then `npm install` it, you still have
    // to restart the development server for Webpack to discover it. This plugin
    // makes the discovery automatic so you don't have to restart.
    DEV && new WatchMissingNodeModulesPlugin(),
    // Minify JavaScript in production with Babili which supports ES2015+ syntax
    // unlike UglifyJS.
    !DEV && new BabiliPlugin(),
  ].filter(Boolean),
};

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}