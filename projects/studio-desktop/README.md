# Decode Studio Desktop

The desktop studio application. Built with Electron to allow for code sharing across web and desktop.

## Development

To develop the desktop application first make sure that you have a development instance of `studio-signal-server` running. See that project’s `README` for information on how to start that. Next run:

```bash
./scripts/dev
```

This will open an Electron window with a Webpack development server running in the background. Whenever you edit your code then Webpack should automatically reload the page for you.

### React Devtools

After you run the project for the first time with `./scripts/dev` you will need to make sure that you force reload the app after a few seconds as the React Devtools are installed in the background after your first run.

## Architecture

Because we are using Electron there are two environments that we write code for.

- **`./src/main`:** The Electron main process. This is simple to build. We just use `tsc` to directly compile all of the files.
- **`./src/renderer`:** The Electron renderer process. We use Webpack to bundle all of our files for the renderer process. All of our external `node_modules`, however, are not bundled using Webpack and required falling back to Node.js.
