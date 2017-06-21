#!/usr/bin/env node

const Workspace = require('../Workspace');
const Webpack = require('../Webpack');

const universePaths = process.argv.slice(2);

let workspaces;
if (universePaths.length > 0) {
  workspaces = Promise.all(universePaths.map(Workspace.load));
} else {
  workspaces = Workspace.loadAll();
}

workspaces
  .then(workspaces => {
    return Promise.all(
      workspaces.map(workspace => {
        return new Promise((resolve, reject) => {
          const compiler = Webpack.createCompiler(workspace, false);
          compiler.run((error, stats) => {
            if (error) {
              reject(error);
            } else {
              console.log(stats.toString({ colors: true }));
              resolve();
            }
          });
        });
      }),
    );
  })
  .catch(error => console.error(error.stack));
