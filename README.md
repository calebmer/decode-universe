# Decode Universe

## TODO

- Think about all of the WebRTC and signaling edge cases.
- STUN and TURN? There are free Mozilla and Google STUN servers. Use those?
- Auto-update desktop app.
- Search for `error` and find ways to report errors.
- Search for `TODO` and try to resolve those notes.

## Port Map

To pick port numbers we start at 1998 and then count up by one. Whenever you need a new port number refer to this chart and pick the next available port number, next update the chart with your port number.

<table>
  <thead>
    <tr>
      <th>Port</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1998</td>
      <td>The webpack development server for the Electron renderer process in `./repos/studio-desktop`.</td>
    </tr>
    <tr>
      <td>1999</td>
      <td>The webpack development server for the web app in `./repos/studio-web`.</td>
    </tr>
    <tr>
      <td>2000</td>
      <td>The WebRTC signaling server for the studio found in `./repos/studio-signal-exchange`.</td>
    </tr>
  </tbody>
</table>
