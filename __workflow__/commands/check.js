const Universe = require('../Universe');
const Workspace = require('../Workspace');
const TypeScript = require('../TypeScript');

exports.command = 'check [workspaces...]';

exports.describe =
  'Type checks workspaces with TypeScript. Checks all workspaces by default.';

exports.handler = ({ workspaces: workspacePaths }) => {
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
