const { log } = require("../utils");

// Placeholder for future code scope implementation
// Code scopes will support JavaScript REPL, Python REPL, etc.

exports.createCodeScope = createCodeScope;
exports.terminateCodeScope = terminateCodeScope;
exports.writeToCode = writeToCode;

/**
 * Creates a new code scope (REPL).
 * Currently not implemented - placeholder for future functionality.
 * 
 * @param {string} name - The scope name
 * @param {string} language - The language (javascript, python, etc.)
 * @param {object} options - Code scope options
 * @param {object} config - Config for logging
 * @returns {Promise<object>} The scope object
 */
async function createCodeScope(name, language, options = {}, config) {
  throw new Error('Code scopes are not yet implemented. Use terminal scopes instead.');
}

/**
 * Terminates a code scope.
 * Currently not implemented - placeholder for future functionality.
 * 
 * @param {string} name - The scope name
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function terminateCodeScope(name, config) {
  throw new Error('Code scopes are not yet implemented.');
}

/**
 * Writes code to a code scope.
 * Currently not implemented - placeholder for future functionality.
 * 
 * @param {string} name - The scope name
 * @param {string} code - The code to execute
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function writeToCode(name, code, config) {
  throw new Error('Code scopes are not yet implemented.');
}
