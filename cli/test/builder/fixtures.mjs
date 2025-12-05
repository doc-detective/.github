/**
 * Test data factories for CLI builder tests
 * 
 * These factories create valid test objects with sensible defaults,
 * accepting optional partial overrides following the project pattern.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { schemas } = require('doc-detective-common');

/**
 * Create a mock spec object with sensible defaults.
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid spec object
 */
export const getMockSpec = (overrides = {}) => {
  return {
    specId: 'test-spec',
    description: 'Test specification',
    tests: [],
    ...overrides,
  };
};

/**
 * Create a mock test object with sensible defaults.
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid test object
 */
export const getMockTest = (overrides = {}) => {
  return {
    testId: 'test-1',
    description: 'Test description',
    steps: [],
    ...overrides,
  };
};

/**
 * Create a mock step object with sensible defaults.
 * @param {string} actionType - The step action type (e.g., 'goTo', 'click', 'find')
 * @param {*} actionValue - The value for the action
 * @param {Object} overrides - Optional partial overrides for additional step properties
 * @returns {Object} A valid step object
 */
export const getMockStep = (actionType = 'goTo', actionValue = 'https://example.com', overrides = {}) => {
  return {
    [actionType]: actionValue,
    ...overrides,
  };
};

/**
 * Create a mock goTo step.
 * @param {string} url - The URL to navigate to
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid goTo step
 */
export const getMockGoToStep = (url = 'https://example.com', overrides = {}) => {
  return getMockStep('goTo', url, overrides);
};

/**
 * Create a mock click step.
 * @param {string|Object} selectorOrOptions - CSS selector string or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid click step
 */
export const getMockClickStep = (selectorOrOptions = '.button', overrides = {}) => {
  return getMockStep('click', selectorOrOptions, overrides);
};

/**
 * Create a mock find step.
 * @param {string|Object} selectorOrOptions - CSS selector string or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid find step
 */
export const getMockFindStep = (selectorOrOptions = '.element', overrides = {}) => {
  return getMockStep('find', selectorOrOptions, overrides);
};

/**
 * Create a mock type step.
 * @param {string[]|Object} keysOrOptions - Array of keys or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid type step
 */
export const getMockTypeStep = (keysOrOptions = ['test input'], overrides = {}) => {
  return getMockStep('type', keysOrOptions, overrides);
};

/**
 * Create a mock screenshot step.
 * @param {string|Object} pathOrOptions - Screenshot path or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid screenshot step
 */
export const getMockScreenshotStep = (pathOrOptions = 'screenshot.png', overrides = {}) => {
  return getMockStep('screenshot', pathOrOptions, overrides);
};

/**
 * Create a mock httpRequest step.
 * @param {Object} options - HTTP request options
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid httpRequest step
 */
export const getMockHttpRequestStep = (options = {}, overrides = {}) => {
  const defaultOptions = {
    url: 'https://api.example.com/endpoint',
    method: 'GET',
    ...options,
  };
  return getMockStep('httpRequest', defaultOptions, overrides);
};

/**
 * Create a mock runShell step.
 * @param {string|Object} commandOrOptions - Shell command or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid runShell step
 */
export const getMockRunShellStep = (commandOrOptions = 'echo "test"', overrides = {}) => {
  return getMockStep('runShell', commandOrOptions, overrides);
};

/**
 * Create a mock wait step.
 * @param {number|Object} durationOrOptions - Duration in ms or options object
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid wait step
 */
export const getMockWaitStep = (durationOrOptions = 1000, overrides = {}) => {
  return getMockStep('wait', durationOrOptions, overrides);
};

/**
 * Create a mock source location object for inline tests/steps.
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A valid source location object
 */
export const getMockSourceLocation = (overrides = {}) => {
  return {
    file: '/path/to/source.md',
    isInline: true,
    startOffset: 0,
    endOffset: 50,
    commentFormat: 'htmlComment',
    originalText: '<!-- step goTo: "https://example.com" -->',
    isAutoDetected: false,
    ...overrides,
  };
};

/**
 * Create a mock step with source location metadata.
 * @param {string} actionType - The step action type
 * @param {*} actionValue - The value for the action
 * @param {Object} sourceLocationOverrides - Overrides for the source location
 * @returns {Object} A step with sourceLocation property
 */
export const getMockInlineStep = (
  actionType = 'goTo',
  actionValue = 'https://example.com',
  sourceLocationOverrides = {}
) => {
  return {
    [actionType]: actionValue,
    sourceLocation: getMockSourceLocation(sourceLocationOverrides),
  };
};

/**
 * Create a complete mock spec with tests and steps.
 * @param {Object} options - Options for spec creation
 * @param {number} options.testCount - Number of tests to create (default: 1)
 * @param {number} options.stepsPerTest - Number of steps per test (default: 2)
 * @param {Object} options.specOverrides - Overrides for the spec
 * @returns {Object} A complete spec with tests and steps
 */
export const getMockCompleteSpec = (options = {}) => {
  const { testCount = 1, stepsPerTest = 2, specOverrides = {} } = options;
  
  const tests = [];
  for (let t = 0; t < testCount; t++) {
    const steps = [];
    
    // First step is always goTo for browser tests
    steps.push(getMockGoToStep(`https://example.com/page${t + 1}`));
    
    // Add additional steps
    for (let s = 1; s < stepsPerTest; s++) {
      const stepTypes = ['find', 'click', 'screenshot'];
      const stepType = stepTypes[s % stepTypes.length];
      
      switch (stepType) {
        case 'find':
          steps.push(getMockFindStep(`#element-${t}-${s}`));
          break;
        case 'click':
          steps.push(getMockClickStep(`#button-${t}-${s}`));
          break;
        case 'screenshot':
          steps.push(getMockScreenshotStep(`screenshot-${t}-${s}.png`));
          break;
      }
    }
    
    tests.push(getMockTest({
      testId: `test-${t + 1}`,
      description: `Test ${t + 1} description`,
      steps,
    }));
  }
  
  return getMockSpec({
    specId: 'complete-spec',
    description: 'Complete test specification',
    tests,
    ...specOverrides,
  });
};

/**
 * Create a mock runner result for DebugRunner tests.
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A mock step execution result
 */
export const getMockStepResult = (overrides = {}) => {
  return {
    status: 'PASS',
    description: 'Step completed successfully',
    ...overrides,
  };
};

/**
 * Create a failed mock runner result.
 * @param {string} errorMessage - The error message
 * @param {Object} overrides - Optional partial overrides
 * @returns {Object} A mock failed step execution result
 */
export const getMockFailedStepResult = (errorMessage = 'Element not found', overrides = {}) => {
  return getMockStepResult({
    status: 'FAIL',
    description: errorMessage,
    ...overrides,
  });
};

export default {
  getMockSpec,
  getMockTest,
  getMockStep,
  getMockGoToStep,
  getMockClickStep,
  getMockFindStep,
  getMockTypeStep,
  getMockScreenshotStep,
  getMockHttpRequestStep,
  getMockRunShellStep,
  getMockWaitStep,
  getMockSourceLocation,
  getMockInlineStep,
  getMockCompleteSpec,
  getMockStepResult,
  getMockFailedStepResult,
};
