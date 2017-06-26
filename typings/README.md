# Decode TypeScript Typings

Currently every project is written in TypeScript. In order to use TypeScript we have some custom typings in addition to custom type checking infrastructure.

## Configuration

While no TypeScript configs are defined in the `~/typings` directory here we will take some time to explain the universe TypeScript config infrastructure.

Universe has one TypeScript configuration file (`tsconfig.json`) at the repository root. This configuration file is exclusively used to power the TypeScript language server used by editors. This configuration is not used for either building TypeScript code or performing a formal check of the TypeScript code. We do this to maximize the effectiveness of TypeScript IDE features which work best with a single project configuration while still providing strict type errors depending on the environment.

The TypeScript configuration we use for formal type checking is generated in `./__workflow__/TypeScript.js`. When building code we only transpile TypeScript code. We do not instantiate a type checker or program, but instead only transpile the code. This keeps builds and rebuilds fast while allowing us to do formal program checking elsewhere.

## Typings

All of our custom typings are in `~/typings`. We have some ambient typings (in the `ambient` folder) that are included depending on each workspace’s target and some typings that are specific to modules that we use (in the `modules` folder).

Ambient typings are those types which exist in the environment. This includes extensions to DOM APIs that are not typed, and some Decode specific utility types like the global `__DEV__` boolean or the `mixed` type.

Module typings are structured so that they may be imported from. They may either be typings for modules which do not have a `@types` package, or they may replace the native types provided with the package. For example, we have custom typings `immutable` and used to have custom typings for `rxjs`. The default types for these two packages happened to be unsatisfactory for our purposes so we wrote our own.

We use these typings as a way to quickly add types for JavaScript APIs without going through the long open source contribution cycle of: proposing a change, making the change, bikeshedding with maintainers, merging the change, waiting for the change to be released, and finally updating our code. Periodically we should consider contributing these typings back to open source.
