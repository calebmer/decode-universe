const path = require('path');
const WebpackConfig = require('./lib/WebpackConfig');

module.exports = WebpackConfig.create({
  target: 'electron-main',
  node: true,
  entry: [path.resolve(__dirname, '../../src/node/desktop/entry')],
});
