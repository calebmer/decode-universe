const chalk = require('chalk');
const errorOverlayMiddleware = require('react-error-overlay/middleware');
const WebpackDevServer = require('webpack-dev-server');
const Target = require('./Target');
const BuildConstants = require('./BuildConstants');
const Webpack = require('./Webpack');

/**
 * The default `BuildConstants` values for development. We provide defaults for
 * common, required, build constants. We don’t want users to think about
 * defining these things in development.
 */
const defaultConstants = new Map([
  [
    'STUDIO_SIGNAL_SERVER_URL',
    `http://localhost:${getPort({ path: '~/studio/signal/server' })}`,
  ],
  ['STUDIO_WEB_URL', `http://localhost:${getPort({ path: '~/studio/web' })}`],
]);

/**
 * Starts the long-living watch mode development process for the provided
 * workspace. Returns a promise that will never resolve. It will only reject if
 * there was a fatal error.
 */
async function workspaceDev(workspace) {
  if (Target.matches(workspace.target, 'web')) {
    await devWeb(workspace);
  }
}

module.exports = workspaceDev;

/**
 * Launches a development server for a web workspace.
 */
async function devWeb(workspace) {
  // Load our build constants.
  const constants = await BuildConstants.load(workspace, defaultConstants);
  // Create the webpack compiler.
  const compiler = Webpack.createCompiler({
    isDev: true,
    workspace,
    constants,
  });
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
    // Enable colors in the stats.
    stats: { colors: true },
    // Add some middleware to the Express app.
    setup(app) {
      // This lets us open files from the runtime error overlay.
      app.use(errorOverlayMiddleware());
    },
  });
  // Get the port for our workspace.
  const port = getPort(workspace);
  // Await on a promise that will never resolve, but it may reject.
  await new Promise((resolve, reject) => {
    // Listen on our unique port.
    server.listen(port, error => {
      if (error) {
        reject(error);
        return;
      }
      // Log that we have started running.
      console.log();
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
