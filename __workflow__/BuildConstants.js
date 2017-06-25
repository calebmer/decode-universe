const fs = require('fs-promise');
const ts = require('typescript');

const optionalTypeStringRe = /\s*\|\s*null$/;

/**
 * Loads a map of build constants from the environment.
 */
async function load(workspace) {
  const constantsTypePath = `${workspace.absolutePath}/BuildConstants.d.ts`;
  // If there are no constants types then we should return an empty array.
  if (!await fs.exists(constantsTypePath)) {
    return new Map();
  }
  // Initialize our TypeScript program.
  const program = ts.createProgram([constantsTypePath], {
    noLib: true,
    typeRoots: [],
    strictNullChecks: true,
  });
  const checker = program.getTypeChecker();
  // Start our constants map.
  const constants = new Map();
  // Throw an error if we got more source files then we expected.
  if (program.getSourceFiles().length !== 1) {
    throw new Error(
      `Expected 1 source file, but got ${program.getSourceFiles().length}`,
    );
  }
  let buildConstantsInterface;
  // Try and find the build constants interface declaration.
  ts.forEachChild(program.getSourceFiles()[0], node => {
    if (
      node.kind === ts.SyntaxKind.InterfaceDeclaration &&
      node.name.text === 'BuildConstants'
    ) {
      // If we already found an interface then we need to throw an error.
      if (buildConstantsInterface) {
        throw new Error(
          'Found at least 2 `BuildConstants` interface declarations.',
        );
      }
      buildConstantsInterface = node;
    }
  });
  // If we did not find an interface then we need to throw an error.
  if (!buildConstantsInterface) {
    throw new Error(
      'Could not find a `BuildConstants` interface declaration. Make sure ' +
        'there is just one `BuildConstants` directly in the root of the file ' +
        '(not in an interface or module) without any export modifiers.',
    );
  }
  // For ever member try and add a constant from our environment.
  for (const member of buildConstantsInterface.members) {
    // We only allow property signature syntax kinds.
    if (member.kind !== ts.SyntaxKind.PropertySignature) {
      throw new Error(`Unexpected syntax kind '${ts.SyntaxKind[member.kind]}'`);
    }
    // Get the name of the member.
    const memberName = member.name.text;
    // Get the value from the environment using the member name.
    const envValue = process.env[memberName];
    // Get the string for the property type.
    let typeString = checker.typeToString(
      checker.getTypeOfSymbolAtLocation(
        member.symbol,
        member.symbol.valueDeclaration,
      ),
    );
    // We do not allow the question token so throw an error if we see it.
    if (member.questionToken) {
      throw new Error(
        `Optional constants with the question token are not allowed. Use a ` +
          `union with the last member as null instead: \`| null\`. Found the ` +
          `question token on BuildConstants.${memberName} with type: ` +
          `${typeString}`,
      );
    }
    // If the type is a union and null is the last member then we want to mark
    // this member as optional and replace that last member.
    const isOptional = optionalTypeStringRe.test(typeString);
    typeString.replace(optionalTypeStringRe, '');
    // If there is no environment variable then either throw an error or set
    // undefined depending on the values optionality.
    if (!envValue) {
      if (!isOptional) {
        throw new Error(
          `Expected a value for constant BuildConstants.${memberName} with ` +
            `type: ${typeString}`,
        );
      } else {
        constants.set(memberName, null);
        continue;
      }
    }
    // Depending on the type we have different rules for parsing the environment
    // value.
    switch (typeString) {
      case 'string':
        constants.set(memberName, envValue);
        break;
      default:
        throw new Error(
          `Unexpted type for BuildConstants.${memberName} of: ` +
            `${typeString}`,
        );
    }
  }
  return constants;
}

module.exports = {
  load,
};
