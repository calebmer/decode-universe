// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'build [workspaces...]';

exports.describe =
  'Builds non-library workspaces for production. Builds all workspaces by default.';

exports.handler = ({ workspaces: workspacePaths }) => {
  const chalk = require('chalk');
  const Workspace = require('../Workspace');
  const workspaceBuild = require('../workspaceBuild');

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
          .map(workspace => {
            return `▸ ${chalk.magenta.bold.underline(workspace.path)}\n`;
          })
          .join(''),
      );
      await Promise.all(workspaces.map(workspaceBuild));
      process.exit(0);
    })
    .catch(error => {
      console.log();
      console.error(error.stack);
      console.log();
      process.exit(1);
    });
};
