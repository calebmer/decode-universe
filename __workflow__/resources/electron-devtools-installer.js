/**
 * Installs various developer tools in Electron. This file will be used as an
 * entry file in development.
 *
 * It should be included in the main process and not the renderer process.
 */

import { app } from 'electron';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

app.on('ready', () => {
  installExtension(REACT_DEVELOPER_TOOLS);
});
