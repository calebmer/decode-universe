/**
 * This module contains utilities for traversing and interacting with the
 * universe repository in a structured and orderly manner.
 */

const path = require('path');
const fs = require('fs-promise');

/**
 * The path to the root of universe represented by `~/` in most cases.
 */
const ROOT_PATH = path.resolve(__dirname, '..');

/**
 * Resolves a universe absolute directory path (a path that starts with '~/') to
 * an absolute file system path.
 */
function resolveUniversePath(universePath) {
  if (!(typeof universePath === 'string' && universePath.startsWith('~/'))) {
    throw new Error(
      `Universe absolute paths must start with '~/', but the path ` +
        `'${universePath}' does not.`,
    );
  }
  return `${ROOT_PATH}/${universePath.slice('~/'.length)}`;
}

/**
 * Resolves a universe absolute directory path (a path that starts with `~/`) to
 * an absolute path to the build directory for that path.
 */
function resolveUniverseBuildPath(universePath) {
  if (!(typeof universePath === 'string' && universePath.startsWith('~/'))) {
    throw new Error(
      `Universe absolute paths must start with '~/', but the path ` +
        `'${universePath}' does not.`,
    );
  }
  return `${ROOT_PATH}/__build__/${universePath.slice('~/'.length)}`;
}

/**
 * Turns an absolute path into a universe path starting with `~`.
 */
function intoUniversePath(absolutePath) {
  return absolutePath.replace(ROOT_PATH, '~');
}

/**
 * Get an array of external dependencies as defined in the root `package.json`
 * file.
 */
async function getExternalDependencyNames() {
  const packagePath = `${ROOT_PATH}/package.json`;
  const packageContents = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  return Object.keys(packageContents.dependencies || {});
}

module.exports = {
  ROOT_PATH,
  resolveUniversePath,
  resolveUniverseBuildPath,
  intoUniversePath,
  getExternalDependencyNames,
};
