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

workspaces.then(TypeScript.check).catch(error => console.error(error.stack));
