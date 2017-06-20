#!/usr/bin/env node

const webpack = require('webpack');
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
  .then(
    workspaces =>
      new Promise((resolve, reject) => {
        webpack(
          workspaces.map(workspace =>
            Webpack.createWebConfig(workspace, false),
          ),
          (error, stats) => {
            if (error) {
              reject(error);
            } else {
              resolve(stats);
            }
          },
        );
      }),
  )
  .then(stats => {
    console.log(stats.toString({ colors: true }));
  })
  .catch(error => console.error(error.stack));
