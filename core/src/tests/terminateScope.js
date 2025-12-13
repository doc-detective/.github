const { validate } = require("doc-detective-common");
const { log } = require("../utils");
const { 
  getScope, 
  hasScope, 
  removeScope 
} = require("../scopes/registry");
const { terminateTerminalScope } = require("../scopes/terminal");

exports.terminateScope = terminateScope;

/**
 * Terminates a named scope.
 * Sends SIGTERM, waits 5 seconds, then sends SIGKILL if needed.
 * 
 * @param {object} options - Options object
 * @param {object} options.config - Configuration object
 * @param {object} options.step - Step object containing terminateScope property
 * @returns {Promise<object>} Result object with status and description
 */
async function terminateScope({ config, step }) {
  const result = {
    status: "PASS",
    description: "Terminated scope.",
  };

  // Validate step object
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }
  
  // Accept coerced and defaulted values
  step = isValidStep.object;
  
  // Get scope name (step.terminateScope is a string)
  const scopeName = step.terminateScope;
  
  if (!scopeName || typeof scopeName !== 'string') {
    result.status = "FAIL";
    result.description = "Scope name must be a non-empty string";
    return result;
  }
  
  // Check if scope exists
  if (!hasScope(scopeName)) {
    log(config, "warn", `Cannot terminate scope '${scopeName}': scope not found`);
    result.description = `Scope '${scopeName}' not found. Continuing without error.`;
    return result;
  }
  
  // Get scope to determine type
  const scope = getScope(scopeName);
  
  try {
    // Terminate based on scope type
    if (scope.type === 'terminal') {
      await terminateTerminalScope(scopeName, config);
    } else if (scope.type === 'code') {
      // Future: implement code scope termination
      throw new Error('Code scopes are not yet implemented');
    } else {
      throw new Error(`Unknown scope type: ${scope.type}`);
    }
    
    // Remove from registry
    removeScope(scopeName, config);
    
    log(config, "info", `Successfully terminated scope: ${scopeName}`);
    result.description = `Terminated scope: ${scopeName}`;
    
  } catch (error) {
    result.status = "FAIL";
    result.description = `Failed to terminate scope '${scopeName}': ${error.message}`;
  }
  
  return result;
}
