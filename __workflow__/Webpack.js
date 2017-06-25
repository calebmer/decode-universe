const path = require('path');
const webpack = require('webpack');
const Universe = require('./Universe');
const Target = require('./Target');
const Workspace = require('./Workspace');

/**
 * Creates a webpack config based on the workspace that can either be in
 * development or production mode.
 */
function createCompiler(workspace, isDev = false) {
  // If the workspace is a library then we want to throw an error since
  // libraries can not be built with Webpack.
  if (workspace.isLibrary) {
    throw new Error('Cannot create a compiler for libraries.');
  }
  // Create a webpack compiler based on the target.
  if (Target.matches(workspace.target, 'electron')) {
    // If we are building for Electron then we want to create a compiler with
    // *two* configs. One for the renderer, and one for the main process.
    return webpack([
      createNodeConfig({
        isDev,
        workspace,
        inputDir: 'main',
      }),
      createWebConfig({
        isDev,
        workspace,
        inputDir: 'renderer',
        outputDir: 'renderer',
      }),
    ]);
  } else if (Target.matches(workspace.target, 'node')) {
    return webpack(createNodeConfig({ isDev, workspace }));
  } else if (Target.matches(workspace.target, 'web')) {
    return webpack(createWebConfig({ isDev, workspace }));
  } else {
    throw new Error(
      `Could not create a webpack compiler for workspace ` +
        `'${workspace.path}' with a target of '${workspace.target}'. Try ` +
        `a target of 'web', 'node', or 'electron' or any that inherits ` +
        `from one of those.`,
    );
  }
}

/**
 * Creates a configuration that will pack a bundle intended to be used in the
 * browser. Enables some hot reloading development features and configures
 * polyfills to appropriately accomplish this goal.
 *
 * This config is meant to be used with `webpack-dev-server` to maximize the
 * developer experience.
 */
function createWebConfig({
  isDev = false,
  workspace,
  inputDir = '',
  outputDir = '',
}) {
  let BabiliPlugin;
  const HtmlWebpackPlugin = require('html-webpack-plugin');
  const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');

  if (!isDev) {
    BabiliPlugin = require('babili-webpack-plugin');
  }

  // Add a leading slash if a nested directory value was provided.
  inputDir = inputDir !== '' ? `/${inputDir}` : inputDir;
  outputDir = outputDir !== '' ? `/${outputDir}` : outputDir;
  return {
    // If there is an error when building for production it’s not worth trying
    // to salvage the build.
    bail: !isDev,
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
    devtool: isDev ? 'cheap-module-source-map' : 'source-map',

    entry: [
      // In development we want to include some extra scripts to assist in hot
      // reloading and other aspects of developer experience.
      ...(isDev
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
      `${workspace.absolutePath}${inputDir}/main`,
    ],
    output: {
      // Put the final output in our workspace’s build directory.
      path: `${workspace.buildPath}/__dist__${outputDir}`,
      // Add /* filename */ comments to generated require()s in the output.
      pathinfo: true,
      // The filename at which our JavaScript code will be output.
      filename: isDev || Target.matches(workspace.target, 'electron')
        ? 'static/js/main.js'
        : 'static/js/main.[chunkhash:8].js',
      // We also want to name our chunks in production, but in development we
      // don’t care about the name.
      chunkFilename: isDev ? undefined : 'static/js/chunk.[chunkhash:8].js',
      // The path that the application will be served under. For now we assume
      // that path is `/` everywhere. Unless we are in Electron where we want
      // relative paths.
      publicPath: Target.matches(workspace.target, 'electron') ? '' : '/',
      // Point sourcemap entries to original disk location.
      devtoolModuleFilenameTemplate: info =>
        path.resolve(info.absoluteResourcePath),
    },
    resolve: {
      // The extensions the module resolution algorithm will use. We need to
      // include TypeScript extensions as they will not be detected by default.
      // Note that JS goes first. This is so that we don’t accidently resolve
      // `.d.ts` files from dependencies.
      extensions: ['.js', '.ts', '.tsx', '.json'],

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
        ? [createExternalizer({ isDev })]
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
            // Don’t log. Since we are just transpiling TypeScript here we don’t
            // need to see any output. It also messes with our progress bar.
            silent: true,
            configFilePath: null,
            // Here is where we get to say that we only want to transpile.
            transpileOnly: true,
            // Provide some minimal compiler options to aid in the transpilation
            // step.
            compilerOptions: {
              // Supposedly this helps when we are only transpiling.
              isolatedModules: true,
              // Create source maps, but only in production.
              sourceMap: !isDev,
              // Transpile JSX into the React syntax.
              jsx: 'react',
              // Import all helpers from `tslib`.
              importHelpers: true,
              // Always use ES2015 modules even in an ES5 environment.
              module: 'es2015',
              // Build for ES5 unless we are in Electron or development. Then we
              // are most likely using the latest version web browser version
              // and have access to all of the nice ES2017 features including
              // native async functions!
              target: isDev || Target.matches(workspace.target, 'electron')
                ? 'es2017'
                : 'es5',
            },
          },
        },
      ],
    },
    plugins: [
      // Generates an `index.html` file with the <script> injected.
      new HtmlWebpackPlugin({
        inject: true,
        template: `${workspace.absolutePath}${inputDir}/main.html`,
        filename: 'main.html',
        // Minify the HTML in production, but not in development.
        minify: isDev
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
        __DEV__: isDev ? 'true' : 'false',
        // Many libraries, including React, use `NODE_ENV` so we need to
        // define it.
        'process.env.NODE_ENV': isDev ? "'development'" : "'production'",
      }),
      ...(isDev
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
      hints: !isDev ? 'warning' : false,
    },
  };
}

/**
 * Creates a config that will make a webpack bundle to be deployed to Node.js or
 * the Electron main process.
 */
function createNodeConfig({
  isDev = false,
  workspace,
  inputDir = '',
  outputDir = '',
}) {
  // Add a leading slash if a nested directory value was provided.
  inputDir = inputDir !== '' ? `/${inputDir}` : inputDir;
  outputDir = outputDir !== '' ? `/${outputDir}` : outputDir;
  return {
    // If there is an error when building for production it’s not worth trying
    // to salvage the build.
    bail: !isDev,
    // We are targeting Node.js in all cases, but the electron case. In which we
    // are targeting the Electron main process which has some slight
    // differences from the Node.js target.
    target: Target.matches(workspace.target, 'electron')
      ? 'electron-main'
      : 'node',
    // We only care about line numbers for the Node.js source tool, so pick the
    // fastest devtool that will retain line numbers. In production we want
    // complete source maps of course.
    devtool: isDev ? 'cheap-eval-source-map' : 'source-map',

    entry: [
      // Use the root main file unless we are building for Electron. Then we
      // will want to get the file nested in one level.
      `${workspace.absolutePath}${inputDir}/main.ts`,
    ],
    output: {
      // Put the final output in our workspace’s build directory.
      path: `${workspace.buildPath}/__dist__${outputDir}`,
      // Add /* filename */ comments to generated require()s in the output.
      pathinfo: true,
      // The filename at which our JavaScript code will be output.
      filename: 'main.js',
      // We also want to name our chunks in production, but in development we
      // don’t care about the name.
      chunkFilename: isDev ? undefined : 'static/js/chunk.[chunkhash:8].js',
      // Point sourcemap entries to original disk location.
      devtoolModuleFilenameTemplate: info =>
        path.resolve(info.absoluteResourcePath),
    },
    resolve: {
      // The extensions the module resolution algorithm will use. We need to
      // include TypeScript extensions as they will not be detected by default.
      // Note that JS goes first. This is so that we don’t accidently resolve
      // `.d.ts` files from dependencies.
      extensions: ['.js', '.ts', '.tsx', '.json'],

      alias: {
        // Alias the tilda as the universe root path as this is the style we
        // want to use for importing a sibling when deep in the file tree.
        '~': Universe.ROOT_PATH,
      },
    },
    externals: [
      // For Node.js based workspaces we want to externalize our dependencies in
      // `node_modules` instead of bundling them.
      createExternalizer({ isDev }),
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
            // Don’t log. Since we are just transpiling TypeScript here we don’t
            // need to see any output. It also messes with our progress bar.
            silent: true,
            configFilePath: null,
            // Here is where we get to say that we only want to transpile.
            transpileOnly: true,
            // Provide some minimal compiler options to aid in the transpilation
            // step.
            compilerOptions: {
              // Supposedly this helps when we are only transpiling.
              isolatedModules: true,
              // Create source maps, but only in production.
              sourceMap: !isDev,
              // Don’t transpile any JSX.
              jsx: 'react',
              // Import all helpers from `tslib`.
              importHelpers: true,
              // Always build for ES2017. Node.js 8 supports async functions!
              target: 'es2017',
            },
          },
        },
      ],
    },
    plugins: [
      // Add module names to factory functions so they appear in browser
      // profiler.
      new webpack.NamedModulesPlugin(),
      // Define our environment so that React will be built appropriately.
      new webpack.DefinePlugin(
        Object.assign(
          {
            // Throughout our repo we expect a global `__DEV__` boolean to
            // enable/disable features in development.
            __DEV__: isDev ? 'true' : 'false',
            // Many libraries, including React, use `NODE_ENV` so we need to
            // define it.
            //
            // Even though we are in Node.js we still define this. It is used enough
            // that its worth putting here. This also means we will never forget to
            // set it.
            'process.env.NODE_ENV': isDev ? "'development'" : "'production'",
          },
          // If the target is Electron then we want to provide information about
          // renderer files.
          Target.matches(workspace.target, 'electron')
            ? {
                // Compute an absolute path in the Electron runtime by requiring
                // 'path' inline.
                'BuildConstants.ELECTRON_RENDERER_HTML_PATH': `require('path').resolve(__dirname, './renderer/main.html')`,
              }
            : {},
        ),
      ),
      ...(isDev
        ? // Enable some extra plugins in development.
          []
        : // Enable some extra plugins in production.
          [
            // Make our distributable a Node.js package by creating a
            // `package.json` file.
            new NodePackagePlugin(workspace),
            // Scope hoist all of the modules that we can in production. Make
            // sure this runs before the minification plugin as a scope hoisted
            // module is more easily minified.
            new webpack.optimize.ModuleConcatenationPlugin(),
            // We don’t minify our code in Node.js. Size is not a constraint and
            // having readable errors is way more valuable than any size or
            // speed gains from minification.
          ]),
    ],
    // We are in Node.js. We don’t care about bundle size!
    performance: false,
  };
}

module.exports = {
  createCompiler,
};

/**
 * Creates a function which may be used as a Webpack externals function that
 * makes sure all `node_modules` are required using CommonJS instead of bundled.
 */
function createExternalizer({ isDevelopment = false }) {
  return (context, request, callback) => {
    const builtinModules = require('builtin-modules');

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
      if (isDevelopment && ![...builtinModules, 'electron'].includes(request)) {
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

/**
 * A plugin that generates a `package.json` from a workspace.
 */
class NodePackagePlugin {
  constructor(workspace) {
    this._workspace = workspace;
  }

  /**
   * Applies the plugin to the compiler.
   */
  apply(compiler) {
    // Add a plugin that will run when the compiler emits files.
    compiler.plugin('emit', (compilation, callback) => {
      this._emit(compilation)
        .then(() => callback())
        .catch(error => callback(error));
    });
  }

  /**
   * When the compiler emits files we want to add a `package.json`.
   */
  async _emit(compilation) {
    const fs = require('fs-promise');

    const { _workspace: workspace } = this;
    // Find the main JavaScript asset.
    const mainAsset = Object.keys(compilation.assets).find(name =>
      name.endsWith('.js'),
    );
    // Throw an error if there was no such asset.
    if (!mainAsset) {
      throw new Error('Could not find a main JavaScript asset.');
    }
    // Read the root `package.json` from the file system.
    const rootPackageString = await fs.readFile(
      `${Universe.ROOT_PATH}/package.json`,
      'utf8',
    );
    // Parse out the `package.json` file.
    const rootPackageManifest = JSON.parse(rootPackageString);
    // Get the output directory for the workspace where will put the
    // `package.json` and where we expect the main asset files to be.
    const packageDirectory = `${workspace.buildPath}/__dist__`;
    // Create a new package name from the workspace path.
    const packageManifest = {
      private: true,
      name: '@decode/' + workspace.path.slice('~/'.length).replace(/\//g, '-'),
      version: rootPackageManifest.version,
      main: mainAsset,
      dependencies: workspace
        .getAllExternalDependencyNames()
        .sort()
        .reduce((dependencies, externalDependencyName) => {
          // If 'electron' is an external dependency we want to skip adding it.
          // The electron dependency will be handled by the runtime. Not our
          // package installation process.
          if (externalDependencyName === 'electron') {
            return dependencies;
          }
          // Add the dependency with its version specified in the root package
          // manifest to dependencies.
          dependencies[externalDependencyName] =
            rootPackageManifest.dependencies[externalDependencyName];
          // Return the dependencies object we are building.
          return dependencies;
        }, {}),
    };
    // Stringify our package manifest.
    const packageString = JSON.stringify(packageManifest, null, 2) + '\n';
    // Add the package manifest as an output to our compilation.
    compilation.assets['package.json'] = {
      source: () => packageString,
      size: () => Buffer.byteLength(packageString),
    };
  }
}
