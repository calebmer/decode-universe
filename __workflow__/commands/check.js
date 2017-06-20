#!/usr/bin/env node

const Workspace = require('../Workspace');
const TypeScript = require('../TypeScript');

const universePaths = process.argv.slice(2);

let workspaces;
if (universePaths.length > 0) {
  workspaces = Promise.all(universePaths.map(Workspace.load));
} else {
  workspaces = Workspace.loadAll();
}

workspaces
  .then(async workspaces => {
    const results = Array.from(await TypeScript.check(workspaces));
    const n = results.reduce((n, { diagnostics }) => n + diagnostics.length, 0);
    process.exit(n);
  })
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
