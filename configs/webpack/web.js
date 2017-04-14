const path = require('path');
const WebpackConfig = require('./lib/WebpackConfig');

module.exports = WebpackConfig.create({
  target: 'web',
  react: true,
  entry: [
    'webrtc-adapter',
    path.resolve(__dirname, '../../src/dom/web/entry'),
  ],
});
