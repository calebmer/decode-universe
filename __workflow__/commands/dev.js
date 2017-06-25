// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'dev <workspace>';

exports.describe = 'Runs non-library workspaces in development mode.';

exports.handler = ({ workspace: workspacePath }) => {
  const Workspace = require('../Workspace');
  const workspaceDev = require('../workspaceDev');

  Workspace.loadFromUserPath(workspacePath)
    .then(workspaceDev)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.log();
      console.error(error.stack);
      console.log();
      process.exit(1);
    });
};
