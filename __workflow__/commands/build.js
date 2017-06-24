// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'build [workspaces...]';

exports.describe =
  'Builds non-library workspaces for production. Builds all workspaces by default.';

exports.handler = ({ workspaces: workspacePaths }) => {
  const chalk = require('chalk');
  const Workspace = require('../Workspace');
  const Webpack = require('../Webpack');

  Workspace.loadFromUserPaths(workspacePaths)
    .then(async workspaces => {
      if (workspacePaths.length === 0) {
        workspaces = workspaces.filter(workspace => !workspace.isLibrary);
      }
      console.log();
      console.log(
        chalk.cyan.italic(
          'Building the following workspaces for production.\nThis may take a while...',
        ),
      );
      console.log();
      console.log(
        workspaces
          .map(
            workspace => `▸ ${chalk.magenta.bold.underline(workspace.path)}\n`,
          )
          .join(''),
      );
      const allStats = await Promise.all(
        workspaces.map(workspace => {
          return new Promise((resolve, reject) => {
            const compiler = Webpack.createCompiler(workspace, false);
            compiler.run((error, stats) => {
              if (error) {
                reject(error);
              } else {
                console.log();
                console.log(
                  `Finished building ${chalk.magenta.bold.underline(
                    workspace.path,
                  )}:`,
                );
                console.log();
                console.log(stats.toString({ colors: true }));
                console.log();
                resolve(stats);
              }
            });
          });
        }),
      );
      process.exit(allStats.find(stats => stats.hasErrors()) ? 1 : 0);
    })
    .catch(error => {
      console.error(error.stack);
      process.exit(1);
    });
};
