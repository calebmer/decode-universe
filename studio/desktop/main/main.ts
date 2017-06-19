import { resolve as resolvePath } from 'path';
import { app, Menu, BrowserWindow } from 'electron';

// Set our global `DEV` environment variable.
(global as any).DEV = process.env.NODE_ENV === 'development';

// Keep a reference to the window so that it is not garbage collected.
let window: Electron.BrowserWindow | null = null;

// This function will be called when Electron has finished initialization and is
// ready to create browser windows.
app.on('ready', () => {
  // Create the window.
  window = new BrowserWindow({
    width: 800,
    height: 600,
  });

  // Load the `index.html` of the page.
  window.loadURL(
    process.env.DECODE_STUDIO_DESKTOP_RENDERER_URL ||
      `file://${resolvePath(__dirname, '../renderer/index.html')}`,
  );

  // Open the DevTools in development.
  if (DEV) {
    window.webContents.openDevTools();
  }

  // Emitted when the window closes.
  window.on('closed', () => {
    // Dereference the window object. We no longer want or need it.
    window = null;
  });

  // Add copy functionality. This needs to go below `window.loadURL()`.
  //
  // TODO: We only have copy functionality for the invite link. We should just
  // make a “click to copy” button instead. Or put it in an input that can be
  // natively copied.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Edit',
        submenu: [{ role: 'copy' }],
      },
    ]),
  );
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});
