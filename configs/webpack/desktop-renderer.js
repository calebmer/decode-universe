const path = require('path');
const WebpackConfig = require('./lib/WebpackConfig');

module.exports = WebpackConfig.create({
  target: 'electron-renderer',
  node: true,
  react: true,
  entry: [path.resolve(__dirname, '../../src/dom/desktop/entry')],
});
