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
 * Normalizes line endings for cross-platform support.
 * Handles both \r\n (Windows) and \n (Unix) line endings.
 * 
 * @param {string} text - Text to normalize
 * @returns {string[]} Array of lines
 */
function splitLines(text) {
  return text.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
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
 * @throws {Error} If scope name is invalid or scope already exists
 */
function registerScope(name, scopeData, config) {
  const validation = validateScopeName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Prevent silent overwriting of existing scopes
  if (scopes.has(name)) {
    throw new Error(`Scope '${name}' already exists. Use a different name or terminate the existing scope first.`);
  }
  
  // Initialize buffers and listener references for cleanup
  scopeData.stdoutBuffer = [];
  scopeData.stderrBuffer = [];
  scopeData.createdAt = Date.now();
  scopeData._listeners = { stdout: null, stderr: null, stdoutError: null, stderrError: null };
  
  // Set up buffer management for stdout
  if (scopeData.stdout) {
    scopeData._listeners.stdout = (data) => {
      const lines = splitLines(data);
      scopeData.stdoutBuffer.push(...lines);
      
      // Trim buffer if needed
      if (scopeData.stdoutBuffer.length > MAX_BUFFER_SIZE) {
        scopeData.stdoutBuffer = scopeData.stdoutBuffer.slice(-MAX_BUFFER_SIZE);
      }
    };
    scopeData._listeners.stdoutError = (err) => {
      log(config, "warn", `Stdout stream error for scope '${name}': ${err.message}`);
    };
    scopeData.stdout.on('data', scopeData._listeners.stdout);
    scopeData.stdout.on('error', scopeData._listeners.stdoutError);
  }
  
  // Set up buffer management for stderr
  if (scopeData.stderr) {
    scopeData._listeners.stderr = (data) => {
      const lines = splitLines(data);
      scopeData.stderrBuffer.push(...lines);
      
      // Trim buffer if needed
      if (scopeData.stderrBuffer.length > MAX_BUFFER_SIZE) {
        scopeData.stderrBuffer = scopeData.stderrBuffer.slice(-MAX_BUFFER_SIZE);
      }
    };
    scopeData._listeners.stderrError = (err) => {
      log(config, "warn", `Stderr stream error for scope '${name}': ${err.message}`);
    };
    scopeData.stderr.on('data', scopeData._listeners.stderr);
    scopeData.stderr.on('error', scopeData._listeners.stderrError);
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
 * Cleans up stream listeners to prevent memory leaks.
 * 
 * @param {string} name - The scope name
 * @param {object} config - Config for logging
 */
function removeScope(name, config) {
  const scopeData = scopes.get(name);
  if (scopeData) {
    // Clean up listeners to prevent memory leaks
    if (scopeData._listeners) {
      if (scopeData.stdout && scopeData._listeners.stdout) {
        scopeData.stdout.removeListener('data', scopeData._listeners.stdout);
      }
      if (scopeData.stdout && scopeData._listeners.stdoutError) {
        scopeData.stdout.removeListener('error', scopeData._listeners.stdoutError);
      }
      if (scopeData.stderr && scopeData._listeners.stderr) {
        scopeData.stderr.removeListener('data', scopeData._listeners.stderr);
      }
      if (scopeData.stderr && scopeData._listeners.stderrError) {
        scopeData.stderr.removeListener('error', scopeData._listeners.stderrError);
      }
    }
    scopes.delete(name);
    log(config, "debug", `Removed scope from registry: ${name}`);
  }
}

/**
 * Gets all scopes in the registry.
 * Returns a defensive copy to prevent external modification of internal state.
 * 
 * @returns {Map} Copy of the scopes map
 */
function getAllScopes() {
  return new Map(scopes);
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
