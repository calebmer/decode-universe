# Decode Studio Web

The web application which guests will connect to in order to participate in a Decode Studio recording. Deploys to the web and so is concerned with browser compatibility unlike `studio-desktop` which uses a consistent version of Chrome.

## Development

To develop the web application first make sure that you have a development instance of `studio-signal-server` running. See that project’s `README` for information on how to start that. Next run:

```bash
./scripts/dev
```

This will start a Webpack development server. Navigate your browser to `http://localhost:1999` to see the code built by that Webpack server.

## Environment Variables

- **`DECODE_STUDIO_SIGNAL_SERVER_URL`:** The `socket.io` signal server that the mesh client will connect to for signaling. Defaults to `http://localhost:2000`.
