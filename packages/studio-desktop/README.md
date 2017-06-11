# Decode Studio Desktop

The desktop studio application. Built with Electron to allow for code sharing across web and desktop.

## Development

To develop the desktop application first make sure that you have a development instance of `studio-signal-server` running. See that project’s `README` for information on how to start that. Next run:

```bash
./scripts/dev
```

This will open an Electron window with a Webpack development server running in the background. Whenever you edit your code then Webpack should automatically reload the page for you.

### Opening a Specific Room

If you want to open Decode Studio and immeadiately join a specific room instead of the recordings directory then set the `INITIAL_ROOM` environment variable to any string. This useful when hacking on the studio room, or when you want to connect your browser to a consistent room in development. The `INITIAL_ROOM` option is only respected if you are building for development. Following is an example that uses `INITIAL_ROOM` with the popular development room `dev`:

```bash
INITIAL_ROOM=dev ./scripts/dev
```

### React Devtools

After you run the project for the first time with `./scripts/dev` you will need to make sure that you force reload the app after a few seconds as the React Devtools are installed in the background after your first run.

## Architecture

Because we are using Electron there are two environments that we write code for.

- **`./src/main`:** The Electron main process. This is simple to build. We just use `tsc` to directly compile all of the files.
- **`./src/renderer`:** The Electron renderer process. We use Webpack to bundle all of our files for the renderer process. All of our external `node_modules`, however, are not bundled using Webpack and required falling back to Node.js.

## Environment Variables

- **`DECODE_STUDIO_SIGNAL_SERVER_URL`:** The `socket.io` signal server that the mesh client will connect to for signaling. Defaults to `http://localhost:2000`.
- **`DECODE_STUDIO_WEB_URL`:** The URL to the web client for recording a podcast. The host will see this url in addition to their room name. With the url they can invite guests to record. Defaults to `http://localhost:1999`.