// NOTE: `require()` all modules in the handler. All `require()`s in the script
// root slows down the time it takes to initialize the CLI and therefore our
// entire workflow.

exports.command = 'format';

exports.describe = 'Formats all JavaScript and TypeScript code with Prettier.';

exports.handler = () => {
  const path = require('path');
  const { spawn } = require('child_process');
  const Universe = require('../Universe');

  // Get the path to the Prettier binary.
  const prettierBin = path.resolve(
    __dirname,
    '../../node_modules/.bin/prettier',
  );

  // We are using the binary for now because it is easier.
  const prettier = spawn(
    prettierBin,
    // prettier-ignore
    [
      '!(node_modules|__build__)/**/*.{ts,tsx,js}',
      '--write',
      '--parser', 'typescript',
      '--single-quote',
      '--trailing-comma', 'all',
    ],
    {
      cwd: Universe.ROOT_PATH,
      stdio: 'inherit',
    },
  );

  prettier.on('close', code => process.exit(code));
};
