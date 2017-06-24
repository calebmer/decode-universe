// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'check [workspaces...]';

exports.describe =
  'Type checks workspaces with TypeScript. Checks all workspaces by default.';

exports.handler = ({ workspaces: workspacePaths }) => {
  const Universe = require('../Universe');
  const Workspace = require('../Workspace');
  const TypeScript = require('../TypeScript');

  Workspace.loadFromUserPaths(workspacePaths)
    .then(async workspaces => {
      const results = Array.from(await TypeScript.check(workspaces));
      const n = results.reduce(
        (n, { diagnostics }) => n + diagnostics.length,
        0,
      );
      process.exit(n);
    })
    .catch(error => {
      console.error(error.stack);
      process.exit(1);
    });
};
