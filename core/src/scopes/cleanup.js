const { log } = require("../utils");
const { getAllScopes, getScopesByTestId, removeScope } = require("./registry");
const { terminateTerminalScope } = require("./terminal");

exports.cleanupTestScopes = cleanupTestScopes;
exports.cleanupAllScopes = cleanupAllScopes;
exports.setupCleanupHandlers = setupCleanupHandlers;

let cleanupHandlersInstalled = false;

/**
 * Cleans up all scopes associated with a specific test.
 * Terminates in LIFO order (reverse creation order).
 * 
 * @param {string} testId - The test identifier
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function cleanupTestScopes(testId, config) {
  const testScopes = getScopesByTestId(testId);
  
  if (testScopes.length === 0) {
    log(config, "debug", `No scopes to clean up for test: ${testId}`);
    return;
  }
  
  log(config, "info", `Cleaning up ${testScopes.length} scope(s) for test: ${testId}`);
  
  // Sort by creation time (descending) for LIFO order
  testScopes.sort((a, b) => b.scope.createdAt - a.scope.createdAt);
  
  for (const { name, scope } of testScopes) {
    try {
      if (scope.type === 'terminal') {
        await terminateTerminalScope(name, config);
      }
      // Add other scope types here in the future
      
      // Remove from registry
      removeScope(name, config);
    } catch (error) {
      // Log but don't fail - cleanup errors shouldn't affect test results
      log(config, "warn", `Error cleaning up scope '${name}': ${error.message}`);
    }
  }
}

/**
 * Cleans up all scopes in the registry.
 * Used for process-level cleanup.
 * 
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function cleanupAllScopes(config = { logLevel: 'info' }) {
  const allScopes = getAllScopes();
  
  if (allScopes.size === 0) {
    return;
  }
  
  log(config, "info", `Cleaning up ${allScopes.size} scope(s)`);
  
  // Convert to array and sort by creation time (descending) for LIFO
  const scopeEntries = Array.from(allScopes.entries())
    .map(([name, scope]) => ({ name, scope }))
    .sort((a, b) => b.scope.createdAt - a.scope.createdAt);
  
  for (const { name, scope } of scopeEntries) {
    try {
      if (scope.type === 'terminal') {
        await terminateTerminalScope(name, config);
      }
      // Add other scope types here in the future
      
      removeScope(name, config);
    } catch (error) {
      // Best-effort cleanup, don't fail
      log(config, "debug", `Error cleaning up scope '${name}': ${error.message}`);
    }
  }
}

/**
 * Sets up process-level cleanup handlers.
 * Handles SIGINT, SIGTERM, uncaughtException, unhandledRejection, and normal exit.
 * 
 * @param {object} config - Config for logging
 */
function setupCleanupHandlers(config = { logLevel: 'info' }) {
  // Only install handlers once
  if (cleanupHandlersInstalled) {
    return;
  }
  
  cleanupHandlersInstalled = true;
  
  // Handler function
  const handleExit = async (signal) => {
    log(config, "debug", `Received ${signal}, cleaning up scopes...`);
    await cleanupAllScopes(config);
  };
  
  // SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    await handleExit('SIGINT');
    process.exit(130); // 128 + SIGINT signal number
  });
  
  // SIGTERM
  process.on('SIGTERM', async () => {
    await handleExit('SIGTERM');
    process.exit(143); // 128 + SIGTERM signal number
  });
  
  // Uncaught exceptions
  process.on('uncaughtException', async (error) => {
    log(config, "error", `Uncaught exception: ${error.message}`);
    await handleExit('uncaughtException');
    process.exit(1);
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    log(config, "error", `Unhandled rejection: ${reason}`);
    await handleExit('unhandledRejection');
    process.exit(1);
  });
  
  // Normal exit
  process.on('exit', () => {
    // Note: This is synchronous, so we can't await cleanupAllScopes
    // The other handlers should have already done the cleanup
    const allScopes = getAllScopes();
    if (allScopes.size > 0) {
      // Use stderr.write since console.log may not work during exit
      // and the config object may not be available
      process.stderr.write(`Warning: ${allScopes.size} scope(s) still in registry at exit\n`);
    }
  });
  
  log(config, "debug", "Cleanup handlers installed");
}
