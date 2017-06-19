/**
 * A map of all the targets as keys and as the value all of the targets which
 * also apply.
 */
const TARGETS = new Map([
  ['universal', new Set()],
  ['node', new Set(['universal'])],
  ['web', new Set(['universal'])],
  ['electron', new Set(['node', 'web'])],
]);

/**
 * Asserts that the target is a valid target.
 */
function assert(target) {
  if (!TARGETS.has(target)) {
    throw new Error(
      `Unexpected target, '${target}'. Expected one of:\n` +
        TARGETS.map(target => `- ${target}\n`),
    );
  }
}

/**
 * Checks to see if a given target matches another target. This will check that
 * the match exists anywhere in the target’s supers.
 */
function matches(target, matchTarget) {
  if (target === matchTarget) {
    return true;
  }
  const superTargets = TARGETS.get(target);
  if (!superTargets) {
    return false;
  }
  for (const superTarget of superTargets) {
    if (matches(superTarget, matchTarget)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves all of the super targets along with the provided target.
 */
function resolveSupers(target) {
  const targets = new Set([target]);
  const queue = Array.from(TARGETS.get(target));
  while (queue.length > 0) {
    const superTarget = queue.pop();
    if (targets.has(superTarget)) {
      continue;
    }
    targets.add(superTarget);
    for (const superSuperTarget of TARGETS.get(superTarget)) {
      queue.push(superSuperTarget);
    }
  }
  return targets;
}

module.exports = {
  assert,
  matches,
  resolveSupers,
};
