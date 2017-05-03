# Decode Universe

The monorepo for all the digital assets used building, maintaining, and distributing Decode products.

## Setup

We try to make it very easy to get started working in universe. Just run the following:

```bash
./scripts/setup
```

…and you should be good to go to start working in any of the projects in universe.

## Projects

All projects are currently stored in the root level `./repos` folder. This folder structure may be reconsidered.

- `studio-desktop`: The Decode Studio desktop application. The desktop application runs using Electron and so there are two “platforms” this project builds for. The Electron main process and the Electron renderer process. Depends on `studio-ui` for all of the networking and UI resources that is shared with `studio-web`.
- `studio-web`: The Desktop Studio web application that guests will connect to. This application will be deployed and distributed on the web. Depends on `studio-ui` for all of the networking and UI resources that is shared with `studio-desktop`.
- `studio-ui`: The common networking and UI resources for `studio-desktop` and `studio-web`. Must be buildable using the build setups for both `studio-desktop` and `studio-web`. Depends on `studio-signal-client` for the project’s signaling service compatible with `studio-signal-server`.
- `studio-signal-client`: A client for `studio-signal-server` and the common message types used in communicating messages between the two projects.
- `studio-signal-server`: A server that is used by Decode Studio peers to find each other accross the world and send signals while establishing a peer-to-peer connection. Depends on `studio-signal-client` for the common message types that both projects need to communicate.
- `typescript`: Assorted utilities for TypeScript development in all Decode projects.

## Scripts

- `setup`: Sets up all projects by installing dependencies and performing other configuration steps. This script is idempotent. Feel free to run it even after you have already setup universe!
- `check-ts`: Checks TypeScript types in all of our projects. Use this script to check if there are any type errors anywhere in the system.

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
      <td>The webpack development server for the Electron renderer process in <code>./repos/studio-desktop</code>.</td>
    </tr>
    <tr>
      <td>1999</td>
      <td>The webpack development server for the web app in <code>./repos/studio-web</code>.</td>
    </tr>
    <tr>
      <td>2000</td>
      <td>The WebRTC signaling server for the studio found in <code>./repos/studio-signal-server</code>.</td>
    </tr>
  </tbody>
</table>

## Architecture

Instead of using many smaller version controlled repositories we use one repository. This is so that we can have one unified version control history, easily provide common infrastructure for all projects, and allow for fast context switching between projects.

### TypeScript

Currently every project is written in TypeScript (including backend projects), however this is not a hard and fast rule. If a different language is more suitable for a project then we should use that. The advantage of TypeScript is that we can easily share code between platforms (i.e. Electron, Node.js, and Web) in addition to getting high quality productivity tools like VS Code.

#### Configuration

Each project has its own TypeScript “project” marked by a `tsconfig.json` file. Some projects need to build for multiple platforms like `studio-desktop` (Electron main process and Electron renderer process). For these projects there will be multiple `tsconfig.{platform}.json` files which will extend from the common `tsconfig.json` file which exists for tools like VS Code.

All TypeScript configs extend from the base config in `./repos/typescript/config/base.json`. This config enables all of the strict TypeScript options to give the best possible typing experience.

When projects share code then the `tsconfig.json` of the consuming code will be used to transform code which has a different `tsconfig.json`. For example, `studio-web` depends on `studio-ui`. Therefore `studio-web`’s `tsconfig.json` must be able to build the code in `studio-web`. This helps tooling when we type check.

#### Typings

All of our custom typings are in `./repos/typescript/typings`. We have some ambient typings (in the `ambient` folder) and some typings that are specific to modules that we use (in the `modules` folder).

Ambient typings are those types which exist in the environment. This includes extensions to DOM APIs that are not typed, and some Decode specific utility types like the global `DEV` boolean or the `mixed` type.

Module typings are structured so that they may be imported from. They may either be typings for modules which do not have a `@types` package, or they may replace the native types provided with the package. For example, we have custom typings for `rxjs` and `immutable`. The default types for these two packages happened to be unsatisfactory for our purposes so we wrote our own.

We use these typings as a way to quickly add types for JavaScript APIs without going through the long contribution process of: proposing a change, making the change, bikeshedding with maintainers, merging the change, waiting for the change to be released, and finally updating our code. Periodically we should consider contributing these typings back to open source.
