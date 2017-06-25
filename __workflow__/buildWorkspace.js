const path = require('path');
const fs = require('fs-promise');
const cp = require('child_process');
const chalk = require('chalk');
const rimraf = require('rimraf');
const Universe = require('./Universe');
const Target = require('./Target');
const Workspace = require('./Workspace');
const BuildConstants = require('./BuildConstants');
const Webpack = require('./Webpack');

/**
 * Builds a non-library workspace for production.
 */
async function buildWorkspace(workspace) {
  // If the workspace is a library then we cannot build it.
  if (workspace.isLibrary) {
    throw new Error(`Cannot build library workspace '${workspace.path}'`);
  }
  // Create the build directory we will be outputting all of our files to.
  const buildDir = `${workspace.buildPath}/__dist__`;
  const styledPath = chalk.magenta.bold.underline(workspace.path);
  // Recursively clean up all the files in our build directroy so we can be
  // guaranteed to get a fresh build even if it is a little slower.
  console.log(`Cleaning last build for ${styledPath}`);
  await new Promise((resolve, reject) =>
    rimraf(buildDir, error => (error ? reject(error) : resolve())),
  );
  // Load our constants from the process’s environment.
  const constants = await BuildConstants.load(workspace);
  // Create a webpack compiler instance for the workspace.
  const compiler = Webpack.createCompiler({
    workspace,
    constants,
    isDev: false,
  });
  // Run the compiler and log the results.
  console.log(`Running webpack compiler for ${styledPath}`);
  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, stats) => (error ? reject(error) : resolve(stats)));
  });
  // If we are building for Node.js then we want to install `node_modules` using
  // Yarn and the Yarn lockfile from universe root.
  if (!stats.hasErrors() && Target.matches(workspace.target, 'node')) {
    console.log(`Installing dependencies for ${styledPath}`);
    // If a Yarn lock file already exists let us remove it.
    if (await fs.exists(`${buildDir}/yarn.lock`)) {
      await fs.unlink(`${buildDir}/yarn.lock`);
    }
    // Link our universe lock file to the build directory. We will use this Yarn
    // lock file to install our dependencies.
    await fs.link(`${Universe.ROOT_PATH}/yarn.lock`, `${buildDir}/yarn.lock`);
    // Execute Yarn in the build directory with the `yarn.lock` file we created.
    await new Promise((resolve, reject) => {
      cp.exec(
        'yarn',
        { cwd: buildDir },
        error => (error ? reject(new Error(error)) : resolve()),
      );
    });
    // Remove the Yarn lock file. Now that dependencies have been installed we
    // no longer need it.
    await fs.unlink(`${buildDir}/yarn.lock`);
  }
  // Output that we finished building
  console.log();
  console.log(
    `Finished building ${styledPath} in ${chalk.blue(
      path.relative(process.cwd(), `${workspace.buildPath}/__dist__`),
    )}`,
  );
  console.log();
  console.log(stats.toString({ colors: true }));
  console.log();
  // Throw an actual error if out Webpack build had any errors.
  if (stats.hasErrors()) {
    throw new Error('There were errors in the webpack build.');
  }
}

module.exports = buildWorkspace;
