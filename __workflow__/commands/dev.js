// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'dev <workspace>';

exports.describe = 'Runs non-library workspaces in development mode.';

exports.handler = ({ workspace: workspacePath }) => {
  const Workspace = require('../Workspace');
  const workspaceDevelop = require('../workspaceDevelop');

  Workspace.loadFromUserPath(workspacePath)
    .then(workspaceDevelop)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(error.stack);
      process.exit(1);
    });
};
