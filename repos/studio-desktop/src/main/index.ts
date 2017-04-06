import { app, BrowserWindow } from 'electron';

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
  window.loadURL('http://localhost:1998/index.html');

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
