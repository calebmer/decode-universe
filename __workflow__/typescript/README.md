# Decode TypeScript Assets

Currently every project is written in TypeScript (including backend projects), however this is not a hard and fast rule. If a different language is more suitable for a project then we should use that. The advantage of TypeScript is that we can easily share code between platforms (i.e. Electron, Node.js, and Web) in addition to getting high quality productivity tools like VS Code.

## Configuration

Each project has its own TypeScript “project” marked by a `tsconfig.json` file. Some projects need to build for multiple platforms like `studio-desktop` (Electron main process and Electron renderer process). For these projects there will be multiple `tsconfig.{platform}.json` files which will extend from the common `tsconfig.json` file which exists for tools like VS Code.

All TypeScript configs extend from the base config in `./config/base.json`. This config enables all of the strict TypeScript options to give the best possible typing experience.

When projects share code then the `tsconfig.json` of the consuming code will be used to transform code which has a different `tsconfig.json`. For example, `studio-web` depends on `studio-core`. Therefore `studio-web`’s `tsconfig.json` must be able to build the code in `studio-web`. This helps tooling when we type check.

## Typings

All of our custom typings are in `./typings`. We have some ambient typings (in the `ambient` folder) and some typings that are specific to modules that we use (in the `modules` folder).

Ambient typings are those types which exist in the environment. This includes extensions to DOM APIs that are not typed, and some Decode specific utility types like the global `DEV` boolean or the `mixed` type.

Module typings are structured so that they may be imported from. They may either be typings for modules which do not have a `@types` package, or they may replace the native types provided with the package. For example, we have custom typings `immutable` and used to have custom typings for `rxjs`. The default types for these two packages happened to be unsatisfactory for our purposes so we wrote our own.

We use these typings as a way to quickly add types for JavaScript APIs without going through the long contribution process of: proposing a change, making the change, bikeshedding with maintainers, merging the change, waiting for the change to be released, and finally updating our code. Periodically we should consider contributing these typings back to open source.
