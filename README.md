# Decode Universe

The universe of all digital assets used in building, maintaining, and distributing Decode products.

## Setup

We try to make it very easy to get started working in universe. Just run the following:

```bash
./scripts/setup
```

…and you should be good to go to start working in any of the packages in universe.

## Packages

Instead of using many smaller version controlled repositories we use one big repository called universe. This is so that we can have one unified version control history, easily provide common infrastructure for all packages, and allow for fast context switching between packages.

Universe is split into packages. The following is a list of all the packages in universe along with a short description. Visit their directory to read more about each project.

- **`studio-desktop`:** The Decode Studio desktop application. The desktop application runs using Electron and so there are two “platforms” this project builds for. The Electron main process and the Electron renderer process. Depends on `studio-core` for all of the networking and UI resources that is shared with `studio-web`.
- **`studio-web`:** The Desktop Studio web application that guests will connect to. This application will be deployed and distributed on the web. Depends on `studio-core` for all of the networking and UI resources that is shared with `studio-desktop`.
- **`studio-core`:** The common networking and UI resources for `studio-desktop` and `studio-web`. Must be buildable using the build setups for both `studio-desktop` and `studio-web`. Depends on `studio-signal-client` for the project’s signaling service compatible with `studio-signal-server`.
- **`studio-signal-client`:** A client for `studio-signal-server` and the common message types used in communicating messages between the two packages.
- **`studio-signal-server`:** A server that is used by Decode Studio peers to find each other accross the world and send signals while establishing a peer-to-peer connection. Depends on `studio-signal-client` for the common message types that both packages need to communicate.
- **`js-utils`:** Various general JavaScript utilities that can be used in any JS environment.
- **`react-utils`:** Various general React utilities that can be used in any JS environment with React.
- **`typescript`:** Assorted utilities for TypeScript development in all Decode packages.

## Scripts

- **`setup`:** Sets up all packages by installing dependencies and performing other configuration steps. This script is idempotent. Feel free to run it even after you have already setup universe!
- **`check-ts`:** Checks TypeScript types in all of our packages. Use this script to check if there are any type errors anywhere in the system.

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
      <td>The webpack development server for the Electron renderer process in <code>./packages/studio-desktop</code>.</td>
    </tr>
    <tr>
      <td>1999</td>
      <td>The webpack development server for the web app in <code>./packages/studio-web</code>.</td>
    </tr>
    <tr>
      <td>2000</td>
      <td>The WebRTC signaling server for the studio found in <code>./packages/studio-signal-server</code>.</td>
    </tr>
  </tbody>
</table>
