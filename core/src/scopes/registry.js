const { log } = require("../utils");

// Global scope registry
const scopes = new Map();

// Max buffer size (number of lines)
const MAX_BUFFER_SIZE = 1000;

exports.registerScope = registerScope;
exports.getScope = getScope;
exports.hasScope = hasScope;
exports.removeScope = removeScope;
exports.getAllScopes = getAllScopes;
exports.getScopesByTestId = getScopesByTestId;
exports.validateScopeName = validateScopeName;

/**
 * Validates a scope name against the required pattern.
 * 
 * @param {string} name - The scope name to validate
 * @returns {object} {valid: boolean, error: string}
 */
function validateScopeName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Scope name must be a non-empty string' };
  }
  
  const pattern = /^[a-zA-Z0-9_-]{1,64}$/;
  if (!pattern.test(name)) {
    return { 
      valid: false, 
      error: 'Scope name must be 1-64 characters and contain only letters, numbers, hyphens, and underscores'
    };
  }
  
  return { valid: true };
}

/**
 * Registers a new scope in the global registry.
 * 
 * @param {string} name - The scope name
 * @param {object} scopeData - The scope data
 * @param {string} scopeData.type - Type: 'terminal' or 'code'
 * @param {object} scopeData.process - The process handle
 * @param {object} scopeData.pty - PTY instance (terminal only)
 * @param {object} scopeData.stdin - Writable stream
 * @param {object} scopeData.stdout - Readable stream
 * @param {object} scopeData.stderr - Readable stream
 * @param {string} scopeData.workingDir - Working directory
 * @param {string} scopeData.testId - Test identifier
 * @param {object} config - Config for logging
 */
function registerScope(name, scopeData, config) {
  const validation = validateScopeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Initialize buffers
  scopeData.stdoutBuffer = [];
  scopeData.stderrBuffer = [];
  scopeData.createdAt = Date.now();
  
  // Set up buffer management for stdout
  if (scopeData.stdout) {
    scopeData.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      scopeData.stdoutBuffer.push(...lines);
      
      // Trim buffer if needed
      if (scopeData.stdoutBuffer.length > MAX_BUFFER_SIZE) {
        scopeData.stdoutBuffer = scopeData.stdoutBuffer.slice(-MAX_BUFFER_SIZE);
      }
    });
  }
  
  // Set up buffer management for stderr
  if (scopeData.stderr) {
    scopeData.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      scopeData.stderrBuffer.push(...lines);
      
      // Trim buffer if needed
      if (scopeData.stderrBuffer.length > MAX_BUFFER_SIZE) {
        scopeData.stderrBuffer = scopeData.stderrBuffer.slice(-MAX_BUFFER_SIZE);
      }
    });
  }
  
  scopes.set(name, scopeData);
  log(config, "debug", `Registered ${scopeData.type} scope: ${name}`);
}

/**
 * Gets a scope from the registry.
 * 
 * @param {string} name - The scope name
 * @returns {object|undefined} The scope data or undefined
 */
function getScope(name) {
  return scopes.get(name);
}

/**
 * Checks if a scope exists in the registry.
 * 
 * @param {string} name - The scope name
 * @returns {boolean} True if scope exists
 */
function hasScope(name) {
  return scopes.has(name);
}

/**
 * Removes a scope from the registry.
 * 
 * @param {string} name - The scope name
 * @param {object} config - Config for logging
 */
function removeScope(name, config) {
  if (scopes.delete(name)) {
    log(config, "debug", `Removed scope from registry: ${name}`);
  }
}

/**
 * Gets all scopes in the registry.
 * 
 * @returns {Map} The scopes map
 */
function getAllScopes() {
  return scopes;
}

/**
 * Gets all scopes associated with a specific test ID.
 * 
 * @param {string} testId - The test identifier
 * @returns {Array<{name: string, scope: object}>} Array of scope entries
 */
function getScopesByTestId(testId) {
  const result = [];
  for (const [name, scope] of scopes.entries()) {
    if (scope.testId === testId) {
      result.push({ name, scope });
    }
  }
  return result;
}
