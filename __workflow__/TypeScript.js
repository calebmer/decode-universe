const path = require('path');
const fs = require('fs-promise');
const chalk = require('chalk');
const ts = require('typescript');
const Universe = require('./Universe');
const Target = require('./Target');
const Workspace = require('./Workspace');

/**
 * Checks a workspace and all of the workspace’s children.
 */
async function check(workspace, _compiling = new Map()) {
  // If we were given an array of workspaces instead of a single workspace then
  // we want to compile all of the workspaces sharing the `_compiling` map.
  if (Array.isArray(workspace)) {
    return new Set(
      (await Promise.all(
        workspace.map(workspace => {
          if (_compiling.has(workspace)) {
            return _compiling.get(workspace);
          } else {
            const compiling = check(workspace, _compiling);
            _compiling.set(workspace, compiling);
            return compiling;
          }
        }),
      )).reduce((a, b) => [...a, ...b], []),
    );
  }
  // Compile all of the workspace’s dependencies making sure that each
  // dependency is not compiled twice.
  const dependencyResults = (await Promise.all(
    workspace.dependencies.map(dependency => {
      // If we have already started compiling this dependency then we want to
      // return that promise. Otherwise we should start compiling and add it to
      // our `_compilingworkspaces` map.
      if (_compiling.has(dependency)) {
        return _compiling.get(dependency);
      } else {
        const compiling = check(dependency, _compiling);
        _compiling.set(dependency, compiling);
        return compiling;
      }
    }),
  )).reduce((a, b) => [...a, ...b], []);
  // Create the compiler options.
  const compilerOptions = await createCompilerOptions(workspace);
  // Get all of the workspace’s source paths.
  const [sourcePaths, ambientSourcePaths] = await Promise.all([
    // Include all of the workspace source paths.
    workspace.getSourcePaths(),
    // Get all of the custom ambient typings for our workspace.
    getCustomAmbientTypings(workspace.target),
  ]);
  // Compile the TypeScript program.
  const diagnostics = checkProgram(
    [...sourcePaths, ...ambientSourcePaths],
    compilerOptions,
  );
  // Report the diagnostics to the user.
  reportDiagnostics(workspace, diagnostics);
  // Return the diagnostics that we got combined with the diagnostics of our
  // dependencies.
  return new Set([...dependencyResults, { diagnostics }]);
}

/**
 * Compiles a TypeScript program. Also accepts a name to include print when
 * logging the results.
 */
function checkProgram(allSourcePaths, compilerOptions) {
  // Create the TypeScript program object.
  const program = ts.createProgram(allSourcePaths, compilerOptions);
  // First get and report any syntactic errors.
  let diagnostics = program.getSyntacticDiagnostics();
  // If we didn't have any syntactic errors, then also try getting the global
  // and semantic errors.
  if (diagnostics.length === 0) {
    diagnostics = [
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics(),
    ];
    if (diagnostics.length === 0) {
      diagnostics = program.getSemanticDiagnostics();
    }
  }
  // Otherwise, emit and report any errors we ran into. We only want to emit
  // `.d.ts` files.
  const emitResult = program.emit(undefined, undefined, undefined, true);
  diagnostics = [...diagnostics, ...emitResult.diagnostics];
  // Deduplicate diagnostics that may have been repeated.
  diagnostics = ts.sortAndDeduplicateDiagnostics(diagnostics);
  // Return the diagnostics.
  return diagnostics;
}

/**
 * Reports TypeScript diagnostics in a stylish format.
 */
function reportDiagnostics(workspace, diagnostics) {
  // Log out the workspace path that we are compiling.
  console.log(
    `Compiling ${chalk.magenta.bold.underline(
      workspace.path,
    )} ${diagnostics.length === 0
      ? chalk.green('✔︎ 0 errors')
      : chalk.red(
          `✘ ${diagnostics.length} error${diagnostics.length === 1 ? '' : 's'}`,
        )}`,
  );
  // Log out the diagnostics.
  const output = ts.formatDiagnostics(diagnostics, {
    getCurrentDirectory: () => Universe.ROOT_PATH,
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => '\n',
  });
  process.stdout.write(output);
}

module.exports = {
  check,
};

/**
 * Creates a TypeScript config based on the universe path by reading the
 * workspace configuration and inferring options from that.
 */
async function createCompilerOptions(workspace) {
  const [customModuleTypings, externalDependencyNames] = await Promise.all([
    getCustomModuleTypings(),
    Universe.getExternalDependencyNames(),
  ]);
  return {
    // Configure how the code will be emit.
    rootDir: workspace.absolutePath,
    outDir: `${workspace.buildPath}/__typings__`,
    declaration: true,
    // Some options that affect code transformation.
    newLine: ts.NewLineKind.LineFeed,
    // Enable JSX.
    jsx: ts.JsxEmit.Preserve,
    // When we are not using the absolute import syntax (`~/...`), we want to
    // use the Node.js relative import style.
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    forceConsistentCasingInFileNames: true,
    // Make TypeScript as strict as possible.
    strictNullChecks: true,
    noImplicitAny: true,
    noImplicitThis: true,
    alwaysStrict: true,
    // Additional lint-like checks.
    noUnusedLocals: true,
    noUnusedParameters: false,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    // Configure the features we want to use.
    experimentalDecorators: true,
    // Set the TypeScript depending on the workspace target.
    target: Target.matches(workspace.target, 'web') &&
      !Target.matches(workspace.target, 'electron')
      ? ts.ScriptTarget.ES5
      : ts.ScriptTarget.ES2015,

    lib: [
      // In all our projects we provide polyfills for all of the latest
      // ECMAScript standardized features no matter the platform.
      'lib.esnext.d.ts',
      // If we are targeting the web we also want to include types for the
      // DOM.
      ...(Target.matches(workspace.target, 'web') ? ['lib.dom.d.ts'] : []),
    ],
    types: [
      // We expect there to be an `@types/*` package for all of our external
      // dependencies that do not have custom module typings. Include all these
      // dependencies in this types field to protect including types that we do
      // not actually use.
      ...workspace.externalDependencyNames.filter(dependency =>
        externalDependencyNames.includes(`@types/${dependency}`),
      ),
      // If we are in Node.js then we also want to include the types
      // defined in `@types/node`. These types are installed at our root
      // `package.json`.
      ...(Target.matches(workspace.target, 'node') ? ['node'] : []),
    ],
    // All of our paths will be relative to the directory.
    baseUrl: workspace.absolutePath,
    paths: Object.assign(
      {
        // We want to let the developer import from inside their directory
        // using the absolute import universe syntax.
        [`${workspace.path}/*`]: ['./*'],
      },
      // Allow the developer to import from any universe dependency using
      // the absolute import universe syntax.
      workspace.dependencies.reduce((paths, dependency) => {
        // Actually add the path to our object which will be expanded.
        paths[`${dependency.path}`] = [
          `${path.relative(
            workspace.absolutePath,
            dependency.buildPath,
          )}/__typings__/index.d.ts`,
        ];
        paths[`${dependency.path}/*`] = [
          `${path.relative(
            workspace.absolutePath,
            dependency.buildPath,
          )}/__typings__/*`,
        ];
        return paths;
      }, {}),
      // For all of the specified dependencies where we have a custom set
      // of typings we want to include an alias for that in our `paths`
      // object.
      workspace.externalDependencyNames
        .filter(moduleName => customModuleTypings.has(moduleName))
        .reduce((paths, moduleName) => {
          paths[moduleName] = [
            path.relative(
              workspace.absolutePath,
              customModuleTypings.get(moduleName),
            ),
          ];
          return paths;
        }, {}),
    ),
  };
}

/**
 * A path to the directory that contains custom module typings.
 */
const TYPED_MODULES_PATH = path.resolve(__dirname, '../typings/modules');

/**
 * A path to the directory that contains custom ambient typings.
 */
const TYPINGS_AMBIENT_PATH = path.resolve(__dirname, '../typings/ambient');

/**
 * Returns a map of module names to paths for all of the custom module typings
 * we support.
 */
async function getCustomModuleTypings() {
  const customModuleTypings = new Map();
  const moduleNames = await fs.readdir(TYPED_MODULES_PATH);
  for (const moduleName of moduleNames) {
    customModuleTypings.set(moduleName, `${TYPED_MODULES_PATH}/${moduleName}`);
  }
  return customModuleTypings;
}

/**
 * Returns an array of custom ambient typing files for a given source path.
 */
async function getCustomAmbientTypings(target) {
  const targets = Array.from(Target.resolveSupers(target));
  const nestedPaths = await Promise.all(
    targets.map(async target => {
      const ambientTypingsPath = `${TYPINGS_AMBIENT_PATH}/${target}`;
      if (!await fs.exists(ambientTypingsPath)) {
        return [];
      }
      const names = await fs.readdir(ambientTypingsPath);
      return names.map(name => `${ambientTypingsPath}/${name}`);
    }),
  );
  return nestedPaths.reduce((a, b) => a.concat(b), []);
}
