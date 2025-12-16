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
  
  // Helper to run cleanup and then exit reliably
  const exitWithCleanup = (code, reason) => {
    handleExit(reason)
      .catch((err) => {
        log(config, 'error', `Error during cleanup: ${err.stack || err}`);
      })
      .finally(() => {
        // Allow stdio to flush then exit
        setImmediate(() => process.exit(code));
        // Force exit after 5s if something prevents exit
        setTimeout(() => process.exit(code), 5000).unref();
      });
  };

  // SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    log(config, 'info', 'Received SIGINT, cleaning up...');
    exitWithCleanup(130, 'SIGINT'); // 128 + SIGINT
  });

  // SIGTERM
  process.on('SIGTERM', () => {
    log(config, 'info', 'Received SIGTERM, cleaning up...');
    exitWithCleanup(143, 'SIGTERM'); // 128 + SIGTERM
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    log(config, 'error', `Uncaught exception: ${error && error.stack ? error.stack : error}`);
    exitWithCleanup(1, 'uncaughtException');
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    log(config, 'error', `Unhandled rejection: ${reason}`);
    exitWithCleanup(1, 'unhandledRejection');
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
