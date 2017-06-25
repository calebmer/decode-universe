const path = require('path');
const cp = require('child_process');
const chalk = require('chalk');
const errorOverlayMiddleware = require('react-error-overlay/middleware');
const WebpackDevServer = require('webpack-dev-server');
const Universe = require('./Universe');
const Target = require('./Target');
const BuildConstants = require('./BuildConstants');
const Webpack = require('./Webpack');

/**
 * The Node.js binary. We extract it from our process arguments, but we could
 * also specify the string `node` since most likely Node.js is on the path.
 */
const NODE_BIN = process.argv[0];

/**
 * The binary we will run when developing Electron.
 */
const ELECTRON_BIN = path.resolve(__dirname, '../node_modules/.bin/electron');

/**
 * The default `BuildConstants` values for development. We provide defaults for
 * common, required, build constants. We don’t want users to think about
 * defining these things in development.
 */
const DEFAULT_CONSTANTS = new Map([
  [
    'STUDIO_SIGNAL_SERVER_URL',
    `http://localhost:${getPort({ path: '~/studio/signal/server' })}`,
  ],
  ['STUDIO_WEB_URL', `http://localhost:${getPort({ path: '~/studio/web' })}`],
]);

/**
 * The configuration for Webpack stats in development.
 */
const WEBPACK_STATS = {
  colors: true,
  hash: false,
  version: false,
  modules: false,
};

/**
 * Starts the long-living watch mode development process for the provided
 * workspace. Returns a promise that will never resolve. It will only reject if
 * there was a fatal error.
 */
async function workspaceDevelop(workspace) {
  if (workspace.isLibrary) {
    throw new Error(
      `Cannot enter dev mode for workspace '${workspace.path}' because it ` +
        `is a library.`,
    );
  } else if (Target.matches(workspace.target, 'electron')) {
    await developElectron(workspace);
  } else if (Target.matches(workspace.target, 'web')) {
    await developWeb(workspace);
  } else if (Target.matches(workspace.target, 'node')) {
    await developNode(workspace);
  } else {
    throw new Error(
      `Cannot enter dev mode for workspace '${workspace.path}' as it has a ` +
        `target of ${workspace.target}`,
    );
  }
}

module.exports = workspaceDevelop;

/**
 * Launches a development server for a web workspace.
 */
async function developWeb(workspace, onServerReady) {
  // Load our build constants.
  const constants = await BuildConstants.load(workspace, DEFAULT_CONSTANTS);
  // Create the webpack compiler.
  let compiler = Webpack.createCompiler({
    isDev: true,
    workspace,
    constants,
  });
  // If our workspace is Electron then the compiler will be a multi-compiler. In
  // that case we want to extract the renderer compiler and set that as our
  // compiler.
  if (Target.matches(workspace.target, 'electron')) {
    const rendererCompiler = compiler.compilers.find(({ outputPath }) =>
      outputPath.endsWith('renderer'),
    );
    compiler = rendererCompiler;
  }
  // Create a webpack development server instance.
  const server = new WebpackDevServer(compiler, {
    // Enable gzip compression of generated files.
    compress: true,
    // Silence the dev server logs. It will still show warnings and errors with
    // this setting, however.
    clientLogLevel: 'none',
    // Enable a hot reloading server. It will provide a websocket endpoint for
    // the dev server client. Instead of using the standard webpack dev server
    // client we use a client from `react-dev-utils` which has a nicer
    // development experience.
    hot: true,
    // Serve the `index.html` file everywhere.
    historyApiFallback: true,
    // Reportedly, this avoids CPU overload on some systems.
    // https://github.com/facebookincubator/create-react-app/issues/293
    watchOptions: {
      ignored: /node_modules/,
    },
    // Configure the stats that will be logged.
    stats: WEBPACK_STATS,
    // Add some middleware to the Express app.
    setup(app) {
      // This lets us open files from the runtime error overlay.
      app.use(errorOverlayMiddleware());
    },
  });
  // Get the port for our workspace.
  const port = getPort(workspace);
  // Await on a promise that will never resolve, but it may reject.
  await new Promise((_, reject) => {
    // Listen on our unique port.
    server.listen(port, error => {
      if (error) {
        reject(error);
        return;
      }
      // If we were provided a callback then we should call it now that we are
      // ready.
      if (onServerReady) {
        onServerReady();
      }
      // Don’t report that our server is launched if we are developing in
      // Electron. In that case the developer does not to point their browser to
      // the url.
      if (Target.matches(workspace.target, 'electron')) {
        return;
      }
      console.log(
        `Workspace ${chalk.magenta.bold.underline(workspace.path)} ` +
          `launched in development mode at ` +
          `${chalk.blue(`http://localhost:${port}`)}`,
      );
      console.log();
    });
  });
}

/**
 * Launches a webpack compiler in watch mode that runs the generated Node.js
 * script whenever it changes.
 */
// TODO: Use Webpack dev server and try to run Node.js in a way that can easily
// be inspected with Chrome devtools. In that case we may need to split up the
// code for the Electron main process and specialized general Node.js
// development.
async function developNode(workspace) {
  // Load our build constants.
  const constants = await BuildConstants.load(workspace, DEFAULT_CONSTANTS);
  // If we are developing Electron then we want to set Electron specific build
  // constants.
  if (Target.matches(workspace.target, 'electron')) {
    constants.set(
      'ELECTRON_RENDERER_HTML_PATH',
      `http://localhost:${getPort(workspace)}/index.html`,
    );
  }
  // Create the webpack compiler.
  let compiler = Webpack.createCompiler({
    isDev: true,
    workspace,
    constants,
  });
  // If our workspace is Electron then the compiler will be a multi-compiler. In
  // that case we want to extract the compiler that is not the renderer compiler
  // and set that as our compiler.
  if (Target.matches(workspace.target, 'electron')) {
    const mainCompiler = compiler.compilers.find(
      ({ outputPath }) => !outputPath.endsWith('renderer'),
    );
    compiler = mainCompiler;
  }
  // Create the environment object we will pass into our spawn command. We want
  // it to inherit from our current environment variables including `PATH`.
  const env = Object.assign(
    {},
    process.env,
    // If we are not developing Electron then we want to provide the `PORT` in
    // the environment.
    !Target.matches(workspace.target, 'electron')
      ? {
          PORT: getPort(workspace).toString(),
        }
      : {},
  );
  // Await on a promise that will never resolve, but it may reject.
  await new Promise((_, reject) => {
    // The child that is currently running. We will kill this when we get a new
    // process.
    let child = null;
    // Watch the files built by the compiler and reload the process as
    // necessary.
    compiler.watch({}, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }
      // Log the diagnostics from the compiler build.
      if (child !== null) {
        console.log();
        console.log(
          chalk.cyan.italic('Changes detected, last process killed...'),
        );
        console.log();
      }
      console.log(stats.toString(WEBPACK_STATS));
      console.log();
      console.log(
        chalk.cyan.italic('Starting process and watching for changes...'),
      );
      console.log();
      // Find the main asset from our compilation assets.
      const mainAsset = Object.values(stats.compilation.assets).find(asset =>
        asset.existsAt.endsWith('.js'),
      );
      // If we could not find a main asset then we should reject our development
      // process.
      if (!mainAsset) {
        reject(new Error('No main JavaScript asset could be found.'));
        return;
      }
      // Kill the old child.
      if (child) {
        child.kill();
      }
      // Spawn a new child.
      child = cp.spawn(
        !Target.matches(workspace.target, 'electron') ? NODE_BIN : ELECTRON_BIN,
        [
          !Target.matches(workspace.target, 'electron')
            ? mainAsset.existsAt
            : // If we are developing Electron we want to open the full package
              // and not just the renderer script. (Although it should still
              // work if we do.)
              path.dirname(mainAsset.existsAt),
        ],
        {
          cwd: Universe.ROOT_PATH,
          stdio: 'inherit',
          env,
        },
      );
    });
  });
}

async function developElectron(workspace) {
  // The web process will never resolve (but it may reject). We want to await on
  // another promise which resolves when the server is ready, but still maintain
  // the promise which never resolves.
  let webProcessPromise;
  // Await a promise that resolves when the server is ready.
  await new Promise((resolve, reject) => {
    let resolved = false;
    // Start the web development server and resolve the promise we are in when
    // that server is ready.
    webProcessPromise = developWeb(workspace, () => {
      resolved = true;
      resolve();
    });
    // If there is an error before we resolve then we need to reject our
    // promise.
    webProcessPromise.catch(error => {
      if (!resolved) {
        reject(error);
      }
    });
  });
  // Await the development processes for both web and Node.js. (The latter will
  // actually run the Electron binary.) These promises will never resolve, but
  // may reject.
  await Promise.all([webProcessPromise, developNode(workspace)]);
}

/**
 * Generate a port in the range of 1000–9999. This port will be consistent as
 * long as the path to the workspace does not change within universe. It should
 * also be consistent no matter where universe has been cloned because we are
 * using the relative path.
 */
function getPort(workspace) {
  return 1000 + Math.abs(hashCode(workspace.path)) % 10000;
}

/**
 * JavaScript implementation of Java’s `.hashCode()` function on a string. See
 * the [source][1].
 *
 * [1]: https://github.com/m3talstorm/hashcode/blob/e0df50ec587d0994352e2f072d15b89ade94ebd6/lib/hashcode.js#L6-L19
 */
function hashCode(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = ((hash << 5) - hash + string.charCodeAt(i)) & 0xffffffff;
  }
  return hash;
}
