const inquirer = require('inquirer').default;
const chalk = require('chalk');

class DebugManager {
  constructor(config) {
    this.config = config;
    this.isDebugMode = config.debug === true || config.debug === "stepThrough";
    this.isStepThroughMode = config.debug === "stepThrough";
    this.isBreakpointMode = config.debug === true;
  }

  /**
   * Determine if execution should pause at this step
   * @param {Object} step - The step being executed
   * @param {boolean} hasFailed - Whether the step has failed
   * @returns {boolean} - Whether to pause
   */
  shouldPause(step, hasFailed = false) {
    if (!this.isDebugMode) {
      return false;
    }

    // Always pause on failures in debug mode
    if (hasFailed) {
      return true;
    }

    // Pause on every step in stepThrough mode
    if (this.isStepThroughMode) {
      return true;
    }

    // Pause on breakpoints in breakpoint mode
    if (this.isBreakpointMode && step.breakpoint === true) {
      return true;
    }

    return false;
  }

  /**
   * Display debug information for the current step
   * @param {Object} step - The step being executed
   * @param {Object} context - The test context
   * @param {Object} metaValues - Current meta values and variables
   * @param {boolean} hasFailed - Whether the step has failed
   * @param {string} errorMessage - Error message if step failed
   */
  displayStepInfo(step, context, metaValues, hasFailed = false, errorMessage = null) {
    console.log('\n' + chalk.bold.cyan('='.repeat(60)));
    
    if (hasFailed) {
      console.log(chalk.bold.red('🚨 STEP FAILED - DEBUG PAUSE'));
    } else if (this.isStepThroughMode) {
      console.log(chalk.bold.blue('🔍 STEP-THROUGH MODE - DEBUG PAUSE'));
    } else {
      console.log(chalk.bold.yellow('🔴 BREAKPOINT - DEBUG PAUSE'));
    }
    
    console.log(chalk.bold.cyan('='.repeat(60)));

    // Step information
    console.log(chalk.bold('Step Information:'));
    console.log(`  ${chalk.cyan('ID:')} ${step.stepId || 'N/A'}`);
    console.log(`  ${chalk.cyan('Description:')} ${step.description || 'N/A'}`);
    
    // Action type and details
    const actionType = this.getActionType(step);
    console.log(`  ${chalk.cyan('Action:')} ${chalk.green(actionType)}`);
    
    if (step[actionType]) {
      const actionParams = typeof step[actionType] === 'object' 
        ? JSON.stringify(step[actionType], null, 2).split('\n').map(line => `    ${line}`).join('\n')
        : step[actionType];
      console.log(`  ${chalk.cyan('Parameters:')}\n${actionParams}`);
    }

    // Error information if failed
    if (hasFailed && errorMessage) {
      console.log(`  ${chalk.red('Error:')} ${errorMessage}`);
    }

    // Environment variables (truncated for readability)
    console.log(chalk.bold('\nEnvironment Variables:'));
    const envVars = Object.keys(process.env)
      .filter(key => !key.startsWith('npm_') && !key.startsWith('NODE_'))
      .slice(0, 10); // Limit to first 10 for readability
    
    if (envVars.length > 0) {
      envVars.forEach(key => {
        const value = process.env[key];
        const truncatedValue = value && value.length > 50 ? value.substring(0, 47) + '...' : value;
        console.log(`  ${chalk.cyan(key)}: ${truncatedValue || ''}`);
      });
      if (Object.keys(process.env).length > envVars.length) {
        console.log(`  ${chalk.gray('... and')} ${Object.keys(process.env).length - envVars.length} ${chalk.gray('more')}`);
      }
    } else {
      console.log('  (none)');
    }

    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');
  }

  /**
   * Get the action type from a step object
   * @param {Object} step - The step object
   * @returns {string} - The action type
   */
  getActionType(step) {
    const possibleActions = [
      'checkLink', 'click', 'find', 'goTo', 'httpRequest', 'loadVariables',
      'record', 'runCode', 'runShell', 'screenshot', 'stopRecord', 'type', 'wait'
    ];
    
    for (const action of possibleActions) {
      if (step[action] !== undefined) {
        return action;
      }
    }
    return 'unknown';
  }

  /**
   * Show interactive prompt for normal execution (non-failure)
   * @returns {Promise<string>} - User's choice
   */
  async promptForAction() {
    const choices = [
      { name: 'Continue - Execute next step', value: 'continue' },
      { name: 'Stop Test - Terminate test execution', value: 'stop' }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: choices,
        default: 'continue'
      }
    ]);

    return answer.action;
  }

  /**
   * Show interactive prompt for failure handling
   * @returns {Promise<string>} - User's choice
   */
  async promptForFailureAction() {
    const choices = [
      { name: 'Continue - Proceed to next step (ignore failure)', value: 'continue' },
      { name: 'Retry Step - Re-execute this step', value: 'retry' },
      { name: 'Skip Step - Mark as skipped and continue', value: 'skip' },
      { name: 'Stop Test - Terminate test execution', value: 'stop' }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Step failed. What would you like to do?',
        choices: choices,
        default: 'continue'
      }
    ]);

    return answer.action;
  }

  /**
   * Handle debug pause for a step
   * @param {Object} step - The step being executed
   * @param {Object} context - The test context
   * @param {Object} metaValues - Current meta values and variables
   * @param {boolean} hasFailed - Whether the step has failed
   * @param {string} errorMessage - Error message if step failed
   * @returns {Promise<string>} - User's action choice
   */
  async handleDebugPause(step, context, metaValues, hasFailed = false, errorMessage = null) {
    if (!this.shouldPause(step, hasFailed)) {
      return 'continue';
    }

    this.displayStepInfo(step, context, metaValues, hasFailed, errorMessage);

    if (hasFailed) {
      return await this.promptForFailureAction();
    } else {
      return await this.promptForAction();
    }
  }
}

module.exports = { DebugManager };