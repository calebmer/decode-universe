const path = require('path');
const fs = require('fs-promise');
const FileCraft = require('filecraft');

// The root directory for universe.
const UNIVERSE_ROOT = path.resolve(`${__dirname}/../../..`);

// The targets we support building for.
const TARGETS = ['node', 'web'];

// An array of all the modules we provide custom TypeScript typings for.
const TYPED_MODULES_DIR = `${__dirname}/../../typescript/typings/modules`;
const TYPED_MODULES = fs.readdirSync(TYPED_MODULES_DIR);

/**
 * Adds assorted FileCraft targets for building TypeScript related files.
 */
function addTargets(directoryPath) {
  // Throw an error if we are not in universe.
  if (!directoryPath.startsWith(`${UNIVERSE_ROOT}/`)) {
    throw new Error(
      `The directory '${directoryPath}' is not a sub-directory of universe ` +
        `at '${UNIVERSE_ROOT}'.`
    );
  }

  // Get the directory path starting at the universe root.
  const directoryUniversePath = directoryPath.slice(`${UNIVERSE_ROOT}/`.length);

  // Add the make target for the TypeScript config.
  FileCraft.task(
    `${directoryPath}/tsconfig.json`,
    [`${directoryPath}/package.json`],
    async () => {
      // Read and parse the `package.json` for this directory.
      const package = await fs
        .readFile(`${directoryPath}/package.json`, 'utf8')
        .then(JSON.parse);

      // We have some decode specific logic in the `package.json`. Bind some of
      // those options here.
      const { target, universeDependencies = [] } = package.decode || {};

      // Throw an error if we have an invalid target.
      if (!TARGETS.includes(target)) {
        throw new Error(
          `The target '${target}' is not a valid target. Must be one of:\n` +
          TARGETS.map(t => `- ${t}\n`).join('')
        );
      }

      const tsConfig = {
        // Extend our base TypeScript config which sets many of the rules around
        // strictness.
        extends: path.relative(
          directoryPath,
          `${__dirname}/../../typescript/config/base.json`,
        ),

        compilerOptions: {
          // All of our code is bundled by Webpack. TypeScript should not be
          // doing any emits.
          noEmit: true,

          lib: [
            // In all our projects we provide polyfills for all of the latest
            // ECMAScript standardized features no matter the platform. Here we
            // enable their types.
            'es2015',
            'es2016',
            'es2017',
            'esnext',
            // If we are targeting the web we also want to include types for the
            // DOM.
            ...(target === 'web' ? ['dom'] : []),
          ],

          types: [
            // We only want TypeScript to use the types that were explicitly
            // installed in the `package.json` `devDependencies` section. Since
            // we use a workspace strategy that hoists most of our dependencies
            // we need to strengthen our config against hoisted types that we
            // don’t want to be used.
            ...Object.keys(package.devDependencies)
              .filter(name => name.startsWith('@types/'))
              .map(name => name.slice('@types/'.length)),
            // If we are in Node.js then we also want to include the types
            // defined in `@types/node`. These types are installed at our root
            // `package.json`.
            ...(target === 'node' ? ['node'] : []),
          ],

          // All of our paths will be relative to the directory.
          baseUrl: directoryPath,

          paths: {
            // We want to let the developer import from inside their directory
            // using the absolute import universe syntax.
            '~/${directoryUniversePath}/*': ['./*'],

            // Allow the developer to import from any universe dependency using
            // the absolute import universe syntax.
            ...(universeDependencies.reduce((paths, dependency) => {
              // Make sure all dependencies start with the root import tilda
              // slash pattern.
              if (!dependency.startsWith('~/')) {
                throw new Error(
                  `All universe dependencies must start with '~/' as they ` +
                    `are to be imported absolutely from the universe root. ` +
                    `However, '${dependency}' does not start that way.`
                );
              }
              // Actually add the path to our object which will be expanded.
              paths[`${dependency}/*`] = [
                `${path.relative(directoryPath, path.resolve(
                  UNIVERSE_ROOT,
                  dependency.slice('~'.length),
                ))}/*`,
              ];

              return paths;
            }, {})),

            // For all of the specified dependencies where we have a custom set
            // of typings we want to include an alias for that in our `paths`
            // object.
            ...(Object.keys(package.dependencies)
              .filter(name => TYPED_MODULES.includes(name))
              .reduce((paths, name) => {
                paths[name] = [
                  path.relative(directoryPath, `${TYPED_MODULES_DIR}/${name}`),
                ];
                return paths;
              }, {})),
          },
        },

        include: [
          // Include the source directory.
          path.resolve(`${directoryPath}/src`),
          // Include some ambient typings that we use universally.
          path.resolve(`${__dirname}/../../typescript/typings/ambient/universal`),
          // Include the extra ambient DOM typings if we are targeting web.
          ...(target === 'web' ? [
            path.resolve(`${__dirname}/../../typescript/typings/ambient/dom`),
          ] : []),
        ],
      };
    },
  );
}

module.exports = {
  addTargets,
};
