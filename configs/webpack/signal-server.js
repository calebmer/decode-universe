const path = require('path');
const WebpackConfig = require('./lib/WebpackConfig');

module.exports = WebpackConfig.create({
  target: 'node',
  node: true,
  entry: [path.resolve(__dirname, '../../src/node/signal/entry')],
});
