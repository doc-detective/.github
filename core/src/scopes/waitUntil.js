const { log } = require("../utils");

exports.isRegexPattern = isRegexPattern;
exports.parseRegex = parseRegex;
exports.matchesCondition = matchesCondition;
exports.waitForConditions = waitForConditions;

/**
 * Checks if a pattern string represents a regex pattern.
 * Regex patterns must start and end with '/' and the last '/' must be at the end or followed only by flags.
 * Valid flags are: g, i, m, u, y, s, d
 * 
 * @param {string} pattern - The pattern to check
 * @returns {boolean} True if pattern is a regex
 */
function isRegexPattern(pattern) {
  if (typeof pattern !== 'string') return false;
  // Must start with / and have at least one more / 
  if (!pattern.startsWith('/') || pattern.length < 2) return false;
  // Find the last /
  const lastSlashIndex = pattern.lastIndexOf('/');
  if (lastSlashIndex === 0) return false;
  // Everything after the last / must be valid regex flags (or empty)
  const afterLastSlash = pattern.substring(lastSlashIndex + 1);
  return /^[gimuysd]*$/.test(afterLastSlash);
}

/**
 * Parses a regex pattern string into a RegExp object.
 * Format: /pattern/flags
 * 
 * @param {string} pattern - The regex pattern string
 * @returns {RegExp} The compiled regex
 * @throws {Error} If pattern is invalid
 */
function parseRegex(pattern) {
  const lastSlashIndex = pattern.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
  
  const regexBody = pattern.substring(1, lastSlashIndex);
  const flags = pattern.substring(lastSlashIndex + 1);
  
  try {
    return new RegExp(regexBody, flags);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern} - ${error.message}`);
  }
}

/**
 * Tests if output matches a condition (string or regex).
 * 
 * @param {string} output - The output to test
 * @param {string} condition - The condition (string or regex pattern)
 * @returns {boolean} True if condition matches or is empty
 */
function matchesCondition(output, condition) {
  // Empty or undefined conditions always match
  if (!condition || condition === '') return true;
  
  if (isRegexPattern(condition)) {
    const regex = parseRegex(condition);
    return regex.test(output);
  }
  
  // Case-sensitive substring match
  return output.includes(condition);
}

/**
 * Waits for stdout/stderr conditions to be met by listening to streams.
 * 
 * Note: There is a potential race condition between the initial buffer check and listener
 * attachment. If data arrives after the buffer check but before listeners are attached,
 * it will be added to the buffer but won't trigger a condition check until the next chunk
 * arrives. This is a known limitation that should be acceptable for most use cases since
 * the pattern will still be detected when subsequent data arrives.
 * 
 * @param {object} options - Wait options
 * @param {object} options.scope - The scope object with streams
 * @param {object} options.conditions - Conditions to wait for
 * @param {string} options.conditions.stdout - Stdout condition (optional)
 * @param {string} options.conditions.stderr - Stderr condition (optional)
 * @param {number} options.timeout - Timeout in milliseconds (default 30000)
 * @param {object} options.config - Config for logging
 * @returns {Promise<object>} Resolves with {met: true} or rejects with timeout error
 */
async function waitForConditions({ scope, conditions, timeout = 30000, config }) {
  // If no conditions specified, resolve immediately
  if (!conditions || (!conditions.stdout && !conditions.stderr)) {
    return { met: true };
  }
  
  return new Promise((resolve, reject) => {
    let stdoutMet = !conditions.stdout || conditions.stdout === '';
    let stderrMet = !conditions.stderr || conditions.stderr === '';
    let timeoutId;
    
    // Check if already met from buffer
    if (!stdoutMet && scope.stdoutBuffer) {
      const stdoutContent = scope.stdoutBuffer.join('\n');
      if (matchesCondition(stdoutContent, conditions.stdout)) {
        stdoutMet = true;
        log(config, "debug", `Stdout condition already met in buffer: ${conditions.stdout}`);
      }
    }
    
    if (!stderrMet && scope.stderrBuffer) {
      const stderrContent = scope.stderrBuffer.join('\n');
      if (matchesCondition(stderrContent, conditions.stderr)) {
        stderrMet = true;
        log(config, "debug", `Stderr condition already met in buffer: ${conditions.stderr}`);
      }
    }
    
    // Check if all conditions already met
    if (stdoutMet && stderrMet) {
      log(config, "info", "All waitUntil conditions already met");
      return resolve({ met: true });
    }
    
    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      const unmetConditions = [];
      if (!stdoutMet && conditions.stdout) unmetConditions.push(`stdout: "${conditions.stdout}"`);
      if (!stderrMet && conditions.stderr) unmetConditions.push(`stderr: "${conditions.stderr}"`);
      reject(new Error(`Timeout waiting for conditions: ${unmetConditions.join(', ')}`));
    }, timeout);
    
    // Listen to stdout - match against accumulated buffer to catch patterns spanning chunks
    const stdoutListener = (data) => {
      const chunk = data.toString();
      log(config, "debug", `Stdout chunk: ${chunk.substring(0, 100)}...`);
      
      if (!stdoutMet && conditions.stdout) {
        // Match against accumulated buffer to catch patterns spanning multiple chunks
        const fullOutput = scope.stdoutBuffer.join('\n');
        if (matchesCondition(fullOutput, conditions.stdout)) {
          stdoutMet = true;
          log(config, "info", `Stdout condition met: ${conditions.stdout}`);
          
          if (stderrMet) {
            cleanup();
            resolve({ met: true });
          }
        }
      }
    };
    
    // Listen to stderr - match against accumulated buffer to catch patterns spanning chunks
    const stderrListener = (data) => {
      const chunk = data.toString();
      log(config, "debug", `Stderr chunk: ${chunk.substring(0, 100)}...`);
      
      if (!stderrMet && conditions.stderr) {
        // Match against accumulated buffer to catch patterns spanning multiple chunks
        const fullOutput = scope.stderrBuffer.join('\n');
        if (matchesCondition(fullOutput, conditions.stderr)) {
          stderrMet = true;
          log(config, "info", `Stderr condition met: ${conditions.stderr}`);
          
          if (stdoutMet) {
            cleanup();
            resolve({ met: true });
          }
        }
      }
    };
    
    // Attach listeners
    if (scope.stdout && !stdoutMet) {
      scope.stdout.on('data', stdoutListener);
    }
    if (scope.stderr && !stderrMet) {
      scope.stderr.on('data', stderrListener);
    }
    
    // Cleanup function
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (scope.stdout) scope.stdout.removeListener('data', stdoutListener);
      if (scope.stderr) scope.stderr.removeListener('data', stderrListener);
    };
  });
}
