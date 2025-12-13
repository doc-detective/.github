const pty = require("node-pty");
const os = require("os");
const { log } = require("../utils");
const { registerScope, getScope } = require("./registry");

exports.createTerminalScope = createTerminalScope;
exports.terminateTerminalScope = terminateTerminalScope;
exports.writeToTerminal = writeToTerminal;

/**
 * Creates a new terminal scope using node-pty.
 * 
 * @param {string} name - The scope name
 * @param {string} command - The command to run
 * @param {object} options - Terminal options
 * @param {string} options.workingDirectory - Working directory (default: '.')
 * @param {string} options.testId - Test identifier
 * @param {object} config - Config for logging
 * @returns {Promise<object>} The scope object
 */
async function createTerminalScope(name, command, options = {}, config) {
  const workingDir = options.workingDirectory || process.cwd();
  const testId = options.testId || 'unknown';
  
  log(config, "debug", `Creating terminal scope '${name}' with command: ${command}`);
  
  // Determine shell based on platform
  let shell;
  let shellArgs;
  
  if (os.platform() === 'win32') {
    // Windows - use cmd.exe or PowerShell
    shell = process.env.COMSPEC || 'cmd.exe';
    shellArgs = ['/c', command];
  } else {
    // Unix-like - use bash or sh
    shell = process.env.SHELL || '/bin/bash';
    shellArgs = ['-c', command];
  }
  
  try {
    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: workingDir,
      env: process.env
    });
    
    log(config, "debug", `PTY process spawned for scope '${name}' with PID: ${ptyProcess.pid}`);
    
    // Create scope data
    const scopeData = {
      type: 'terminal',
      process: ptyProcess,
      pty: ptyProcess,
      stdin: ptyProcess,
      stdout: ptyProcess,
      stderr: null, // PTY combines stdout/stderr
      workingDir: workingDir,
      testId: testId,
      command: command
    };
    
    // Register the scope
    registerScope(name, scopeData, config);
    
    // Handle process exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      log(config, "debug", `Terminal scope '${name}' exited with code ${exitCode}, signal ${signal}`);
    });
    
    return scopeData;
  } catch (error) {
    log(config, "error", `Failed to create terminal scope '${name}': ${error.message}`);
    throw new Error(`Failed to spawn terminal process: ${error.message}`);
  }
}

/**
 * Terminates a terminal scope.
 * Sends SIGTERM, waits 5 seconds, then sends SIGKILL if needed.
 * 
 * @param {string} name - The scope name
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function terminateTerminalScope(name, config) {
  const scope = getScope(name);
  
  if (!scope) {
    log(config, "warn", `Cannot terminate scope '${name}': scope not found`);
    return;
  }
  
  if (scope.type !== 'terminal') {
    throw new Error(`Scope '${name}' is not a terminal scope`);
  }
  
  log(config, "info", `Terminating terminal scope: ${name}`);
  
  try {
    const ptyProcess = scope.pty;
    
    if (!ptyProcess || !ptyProcess.pid) {
      log(config, "debug", `Process for scope '${name}' already terminated`);
      return;
    }
    
    // Check if process is still running
    try {
      process.kill(ptyProcess.pid, 0); // Signal 0 checks if process exists
    } catch (error) {
      log(config, "debug", `Process ${ptyProcess.pid} already terminated`);
      return;
    }
    
    // Send SIGTERM
    log(config, "debug", `Sending SIGTERM to process ${ptyProcess.pid}`);
    ptyProcess.kill('SIGTERM');
    
    // Wait up to 5 seconds for graceful shutdown
    const startTime = Date.now();
    const timeout = 5000;
    
    while (Date.now() - startTime < timeout) {
      try {
        process.kill(ptyProcess.pid, 0);
        // Still running, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Process is gone
        log(config, "debug", `Process ${ptyProcess.pid} terminated gracefully`);
        return;
      }
    }
    
    // Still running after timeout, send SIGKILL
    log(config, "debug", `Process ${ptyProcess.pid} did not terminate, sending SIGKILL`);
    try {
      ptyProcess.kill('SIGKILL');
    } catch (error) {
      log(config, "debug", `Error sending SIGKILL: ${error.message}`);
    }
    
  } catch (error) {
    log(config, "warn", `Error terminating terminal scope '${name}': ${error.message}`);
  }
}

/**
 * Writes text to a terminal scope's stdin.
 * Handles escape sequences like \n, \t, \r, \\, \xHH.
 * 
 * @param {string} name - The scope name
 * @param {string} text - The text to write
 * @param {object} config - Config for logging
 * @returns {Promise<void>}
 */
async function writeToTerminal(name, text, config) {
  const scope = getScope(name);
  
  if (!scope) {
    throw new Error(`Scope '${name}' not found`);
  }
  
  if (scope.type !== 'terminal') {
    throw new Error(`Scope '${name}' is not a terminal scope`);
  }
  
  // Process escape sequences
  let processedText = text;
  
  // Replace escape sequences
  processedText = processedText
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '\\'); // Must be last to avoid double-escaping
  
  log(config, "debug", `Writing to terminal scope '${name}': ${JSON.stringify(processedText)}`);
  
  try {
    scope.pty.write(processedText);
  } catch (error) {
    throw new Error(`Failed to write to terminal scope '${name}': ${error.message}`);
  }
}
