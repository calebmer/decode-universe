const path = require('path');
const ts = require('typescript');
const BabiliPlugin = require('babili-webpack-plugin');
const builtinModules = require('builtin-modules');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const webpack = require('webpack');
const Universe = require('./Universe');
const Target = require('./Target');
const Workspace = require('./Workspace');

/**
 * Creates a configuration that will pack a bundle intended to be used in the
 * browser. Enables some hot reloading development features and configures
 * polyfills to appropriately accomplish this goal.
 *
 * This config is meant to be used with `webpack-dev-server` to maximize the
 * developer experience.
 */
function createWebConfig(workspace, development = false) {
  return {
    // If there is an error when building for production it’s not worth trying
    // to salvage the build.
    bail: !development,
    // In most cases we are targeting the web, but if our target is Electron
    // then we are actually targeting an Electron renderer.
    target: Target.matches(workspace.target, 'electron')
      ? 'electron-renderer'
      : 'web',
    // In development we want a fast devtool that won’t slow down the build, but
    // in production we prefer a robust devtool.
    //
    // `create-react-app` chose to use `cheap-module-source-map` as the
    // development default, but we may also consider `eval` which will show the
    // compiled source.
    devtool: development ? 'cheap-module-source-map' : 'source-map',

    entry: [
      // In development we want to include some extra scripts to assist in hot
      // reloading and other aspects of developer experience.
      ...(development
        ? [
            // We use this as an alternative client to the one provided by
            // `webpack-dev-server` as it is optimized for the single-page-app
            // React developer experience. Syntax errors will render a custom
            // overlay to provide high signal to the changes that need to be
            // made.
            require.resolve('react-dev-utils/webpackHotDevClient'),
            // Errors should be considered fatal in development so that they get
            // fixed instead of ignored.
            require.resolve('react-error-overlay'),
          ]
        : []),
      // App code must always go last so that if there is an error it doesn’t
      // break the development tools we have configured.
      //
      // Electron apps will have two entry points so we look in the `renderer`
      // directory for the main file.
      Target.matches(workspace.target, 'electron')
        ? `${workspace.absolutePath}/renderer/main.ts`
        : `${workspace.absolutePath}/main.ts`,
    ],
    output: {
      // Put the final output in our workspace’s build directory. If this is
      // Electron then we need to nest it one level deeper.
      path: Target.matches(workspace.target, 'electron')
        ? `${workspace.buildPath}/__dist__/renderer`
        : `${workspace.buildPath}/__dist__`,
      // Add /* filename */ comments to generated require()s in the output.
      pathinfo: true,
      // This does not produce a real file. It's just the virtual path that is
      // served by WebpackDevServer in development. This is the JS bundle
      // containing code from all our entry points, and the Webpack runtime.
      filename: development
        ? 'static/js/bundle.js'
        : 'static/js/bundle.[chunkhash:8].js',
      // We also want to name our chunks in production, but in development we
      // don’t care about the name.
      chunkFilename: development
        ? undefined
        : 'static/js/chunk.[chunkhash:8].js',
      // The path that the application will be served under. For now we assume
      // that path is `/` everywhere.
      publicPath: '/',
      // Point sourcemap entries to original disk location.
      devtoolModuleFilenameTemplate: info =>
        path.resolve(info.absoluteResourcePath),
    },
    resolve: {
      // The extensions the module resolution algorithm will use. We need to
      // include TypeScript extensions as they will not be detected by default.
      extensions: ['.ts', '.tsx', '.js', '.json'],

      alias: {
        // Alias the tilda as the universe root path as this is the style we
        // want to use for importing a sibling when deep in the file tree.
        '~': Universe.ROOT_PATH,
        // Always use the browser build for `debug`. When we are building for
        // Electron Webpack will want to use the Node.js version of `debug`. In
        // this case the browser version of `debug` is what we want so that we
        // may configure what is debugged with `localStorage`.
        debug: path.resolve(__dirname, '../node_modules/debug/src/browser.js'),
      },
    },
    externals: [
      // For Node.js based workspaces we want to externalize our dependencies in
      // `node_modules` instead of bundling them.
      ...(Target.matches(workspace.target, 'node')
        ? [createExternalizer(workspace, development)]
        : []),
    ],
    module: {
      rules: [
        // Include a rule for transpiling our TypeScript files. We only ever
        // want to transpile. Type checking is done in other, more rigorous,
        // scripts. Only transpiling makes our build super fast.
        {
          test: /\.(ts|tsx)$/,
          loader: require.resolve('ts-loader'),
          options: {
            // We do not want to load a config file. We only want to transpile
            // in this loader. Type checking is done elsewhere.
            configFileName: null,
            // Here is where we get to say that we only want to transpile.
            transpileOnly: true,
            // Provide some minimal compiler options to aid in the transpilation
            // step.
            compilerOptions: {
              // Supposedly this helps when we are only transpiling.
              isolatedModules: true,
              // Create source maps, but only in production.
              sourceMap: !development,
              // Transpile JSX into the React syntax.
              jsx: ts.JsxEmit.React,
              // Import all helpers from `tslib`.
              importHelpers: true,
              // Build for ES5 unless we are in Electron or development. Then we
              // are most likely using the latest version web browser version
              // and have access to all of the nice ES2015 features.
              target: development ||
                Target.matches(workspace.target, 'electron')
                ? ts.ScriptTarget.ES2015
                : ts.ScriptTarget.ES5,
            },
          },
        },
      ],
    },
    plugins: [
      // Generates an `index.html` file with the <script> injected.
      new HtmlWebpackPlugin({
        inject: true,
        template: Target.matches(workspace.target, 'electron')
          ? `${workspace.absolutePath}/renderer/main.html`
          : `${workspace.absolutePath}/main.html`,
        // Minify the HTML in production, but not in development.
        minify: development
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
      // Add module names to factory functions so they appear in browser
      // profiler.
      new webpack.NamedModulesPlugin(),
      // Define our environment so that React will be built appropriately.
      new webpack.DefinePlugin({
        // Throughout our repo we expect a global `__DEV__` boolean to
        // enable/disable features in development.
        __DEV__: development ? 'true' : 'false',
        // Many libraries, including React, use `NODE_ENV` so we need to
        // define it.
        'process.env.NODE_ENV': development ? "'development'" : "'production'",
      }),
      ...(development
        ? // Enable some extra plugins in development.
          [
            // This is necessary to emit hot updates (currently CSS only).
            new webpack.HotModuleReplacementPlugin(),
            // If you require a missing module and then `npm install` it, you
            // still have to restart the development server for Webpack to
            // discover it. This plugin makes the discovery automatic so you
            // don’t have to restart.
            new WatchMissingNodeModulesPlugin(
              `${Universe.ROOT_PATH}/node_modules`,
            ),
          ]
        : // Enable some extra plugins in production.
          [
            // Scope hoist all of the modules that we can in production. Make
            // sure this runs before the minification plugin as a scope hoisted
            // module is more easily minified.
            new webpack.optimize.ModuleConcatenationPlugin(),
            // Minify the code with Babili which understands ES2015+ syntax
            // unlike UglifyJS.
            new BabiliPlugin(),
          ]),
    ],
    // Turn off performance hints during development because we don't do any
    // splitting or minification in interest of speed. These warnings become
    // cumbersome.
    performance: {
      hints: !development,
    },
  };
}

/**
 * Creates a function which may be used as a Webpack externals function that
 * makes sure all `node_modules` are required using CommonJS instead of bundled.
 */
function createExternalizer(_workspace, development = false) {
  return (context, request, callback) => {
    if (
      // If the file starts with a letter then it is not a relative import and
      // we should externalize the module instead of bundling it.
      /^[a-zA-Z]/.test(request) &&
      // However, we do want to bundle certain Webpack utilities related to
      // hot reloading.
      !/^webpack\/hot\/dev-server/.test(request) &&
      // There are some modules that we want to bundle no matter what. These
      // modules are enumerated here.
      !['debug', 'react-error-overlay'].includes(request)
    ) {
      // If we are in development then we want to use the absolute path of
      // the module because our bundle is hosted from `webpack-dev-server`.
      //
      // Do this for all modules except those modules that are builtin and the
      // `electron` module. Electron special cases these so we do not need to
      // require their absolute path.
      if (development && ![...builtinModules, 'electron'].includes(request)) {
        callback(null, `commonjs ${require.resolve(request)}`);
      } else {
        // In production our bundle is loaded from the file system and so we
        // require the default module name with Electron will lookup in
        // `node_modules`.
        callback(null, `commonjs ${request}`);
      }
    } else {
      callback();
    }
  };
}

Workspace.load('~/studio/web')
  .then(createWebConfig)
  .then(console.log)
  .catch(error => console.error(error.stack));
