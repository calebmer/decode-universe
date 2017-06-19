const fs = require('fs-promise');
const glob = require('glob');
const Universe = require('./Universe');
const Target = require('./Target');

const ALL_WORKSPACES = new Map();

class Workspace {
  /**
   * Loads all of the workspaces in universe.
   */
  static loadAll() {
    return loadAllWorkspaces(Universe.ROOT_PATH);
  }

  /**
   * Loads a new `Workspace` instance.
   */
  static load(path) {
    // If we have already started (or completed) loading this workspace then
    // return the cached promise.
    if (ALL_WORKSPACES.has(path)) {
      return ALL_WORKSPACES.get(path);
    }
    // Otherwise start loading the workspace and add it to our workspaces cache.
    const workspace = Workspace._load(path);
    ALL_WORKSPACES.set(path, workspace);
    return workspace;
  }

  static async _load(path) {
    // Get the absolute path from the workspace universe path.
    const absolutePath = Universe.resolveUniversePath(path);
    // Get the absolute path to the config file.
    const configPath = `${absolutePath}/workspace.json`;
    // If the no config file exists then we want to throw an error.
    if (!await fs.exists(configPath)) {
      throw new Error(
        `Directory '${path}' is an invalid workspace. Add ` +
          `a workspace.json file to make it a valid workspace.`,
      );
    }
    // Read and parse our config file.
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    // Make sure that our config is a valid object.
    if (config === null || typeof config !== 'object') {
      throw new Error(
        `Expected an object for the workspace config, but got: ` +
          `'${typeof config}'`,
      );
    }
    // Make sure that our target is valid.
    Target.assert(config.target);
    // Make sure that the library flag is set as a boolean.
    if (typeof config.library !== 'boolean') {
      throw new Error(
        `Expected a boolean value for the 'library' property, got: ` +
          `'${config.library}'`,
      );
    }
    // We want to resolve all our dependencies and seperate them into different
    // arrays by kind.
    const dependencies = [];
    const externalDependencyNames = [];
    const allExternalDependencyNames = await Universe.getExternalDependencyNames();
    // For all of our dependencies we want to validate them and add them to the
    // appropriate array.
    await Promise.all(
      config.dependencies.map(async dependency => {
        if (dependency.startsWith('~/')) {
          // Load the workspace.
          const workspace = await Workspace.load(dependency);
          // Check to make sure that our target is a super target of the
          // dependency workspace.
          if (!Target.matches(config.target, workspace.target)) {
            throw new Error(
              `Expected target '${workspace.target}' to be a super target of ` +
                `'${config.target}'`,
            );
          }
          // Add the workspace to our dependencies.
          dependencies.push(workspace);
        } else {
          // If we do not have a given external dependency then we need to throw
          // an error to let the user know.
          if (!allExternalDependencyNames.includes(dependency)) {
            throw new Error(
              `Expected dependency '${dependency}' to be an external ` +
                `dependency, but it does not appear in the root package.json ` +
                `dependencies field.`,
            );
          }
          externalDependencyNames.push(dependency);
        }
      }),
    );
    // Construct the workspace.
    const workspace = new Workspace(
      path,
      config.target,
      config.library,
      dependencies,
      externalDependencyNames,
    );
    // For all of the dependencies we want to add the new workspace as a
    // dependant.
    for (const dependency of dependencies) {
      dependency._dependants.push(workspace);
    }
    // Return the workspace.
    return workspace;
  }

  /**
   * This constructor is private and should not be used outside of `load()`.
   */
  constructor(path, target, isLibrary, dependencies, externalDependencyNames) {
    this.path = path;
    this.absolutePath = Universe.resolveUniversePath(path);
    this.buildPath = Universe.resolveUniverseBuildPath(path);
    this.target = target;
    this.isLibrary = isLibrary;
    this.dependencies = dependencies;
    this.externalDependencyNames = externalDependencyNames;
    this._dependants = [];
    this._sourcePathsGlob = `${this.absolutePath}/**/*.{ts,tsx}`;
  }

  /**
   * Gets the dependants we currently know about.
   */
  getKnownDependants() {
    return this._dependants;
  }

  /**
   * Gets all of the source files in the workspace.
   */
  getSourcePaths() {
    return new Promise((resolve, reject) => {
      glob(this._sourcePathsGlob, (error, sourcePaths) => {
        if (error) {
          reject(error);
        } else {
          resolve(sourcePaths);
        }
      });
    });
  }
}

module.exports = Workspace;

/**
 * Recursively loads all of the workspaces in a directory.
 */
async function loadAllWorkspaces(directory) {
  // Get all of the names in the directory.
  const names = await fs.readdir(directory);
  // If there is a `workspace.json` file then this is a workspace and we should
  // stop recursion.
  if (names.includes('workspace.json')) {
    return [await Workspace.load(Universe.intoUniversePath(directory))];
  }
  // Gets a nested array of workspaces.
  const nestedWorkspaces = await Promise.all(
    names.map(async name => {
      // If this is a node modules directory or any hidden directory of some
      // kind then we want to skip it.
      if (
        name === 'node_modules' ||
        name.startsWith('.') ||
        name.startsWith('_')
      ) {
        return [];
      }
      // Assemble the path using the name and get the stats for the path.
      const path = `${directory}/${name}`;
      const stats = await fs.stat(path);
      // If the path is a directory then we want to recursively load all the
      // workspaces in that directory.
      if (stats.isDirectory()) {
        return await loadAllWorkspaces(path);
      } else {
        return [];
      }
    }),
  );
  // Concatenate our nested workspaces and return it.
  return nestedWorkspaces.reduce((a, b) => a.concat(b), []);
}
