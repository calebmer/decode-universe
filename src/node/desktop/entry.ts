import { resolve as resolvePath } from 'path';
import { app, BrowserWindow } from 'electron';
import { DevToolsExtensions } from './DevToolsExtensions';

// Keep a reference to the window so that it is not garbage collected.
let window: Electron.BrowserWindow | null = null;

// This function will be called when Electron has finished initialization and is
// ready to create browser windows.
app.on('ready', () => {
  // If we are in development then we want to install our devtools.
  if (DEV) {
    DevToolsExtensions.install();
  }

  // Create the window.
  window = new BrowserWindow({
    width: 800,
    height: 600,
  });

  const appHTML = resolvePath(
    // Start at the directory that holds the bundle.
    __dirname,
    // Move from there to the build directory for the desktop application’s HTML
    // file.
    '../../../dom/desktop/build/app.html',
  );

  // Load the `app.html` for the page.
  window.loadURL(`file://${appHTML}`);

  // Open the DevTools.
  window.webContents.openDevTools();

  // Emitted when the window closes.
  window.on('closed', () => {
    // Dereference the window object. We no longer want or need it.
    window = null;
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});
