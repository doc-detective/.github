/**
 * Debug runner component - interactive step-by-step test execution
 * Allows users to run tests with a visible browser, edit steps, and retry on failure
 */

import React from 'react';
const { useState, useEffect, useCallback, useRef } = React;
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import StepEditor from './StepEditor.mjs';
import { StatusBar, JsonPreview, ConfirmPrompt } from './components.mjs';
import {
  getStepTypes,
  getCommonStepProperties,
  createDefaultStep,
  getBrowserActions,
  getStepActionType,
  stepRequiresBrowser,
} from './schemaUtils.mjs';

/**
 * Truncate a string to a maximum number of grapheme clusters (user-perceived characters).
 * Uses Intl.Segmenter if available (Node 16+), otherwise falls back to Array.from for code-point safety.
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum number of grapheme clusters
 * @param {string} [ellipsis='…'] - Ellipsis to append if truncated
 * @returns {string} The truncated string
 */
function truncateGraphemeSafe(str, maxLength, ellipsis = '…') {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }

  // Use Intl.Segmenter if available (Node 16+)
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = [...segmenter.segment(str)];
    
    if (segments.length <= maxLength) {
      return str;
    }
    
    const truncated = segments.slice(0, maxLength).map(s => s.segment).join('');
    return truncated + ellipsis;
  }

  // Fallback: use Array.from for code-point safety
  const codePoints = Array.from(str);
  
  if (codePoints.length <= maxLength) {
    return str;
  }
  
  return codePoints.slice(0, maxLength).join('') + ellipsis;
}

/**
 * Find the index of the first browser-requiring step
 * @param {Array} steps - Array of steps
 * @returns {number} Index of first browser step, or -1 if none
 */
function findFirstBrowserStepIndex(steps) {
  return steps.findIndex((step) => stepRequiresBrowser(step));
}

/**
 * Check if a goTo step exists before the given index
 * @param {Array} steps - Array of steps
 * @param {number} beforeIndex - Index to check before
 * @returns {boolean}
 */
function hasGoToBefore(steps, beforeIndex) {
  for (let i = 0; i < beforeIndex; i++) {
    if (steps[i].goTo !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Debug Runner component
 * @param {Object} props
 * @param {Object} props.test - The test to run
 * @param {number} props.testIndex - Index of the test in the spec
 * @param {Function} props.onComplete - Called when debug session completes with updated test
 * @param {Function} props.onCancel - Called when user cancels debug session
 */
const DebugRunner = ({ test, testIndex, onComplete, onCancel }) => {
  const { exit } = useApp();
  
  // Phase states
  const [phase, setPhase] = useState('init'); // 'init', 'checkGoTo', 'addGoTo', 'running', 'stepPreview', 'stepEdit', 'stepResult', 'complete', 'error'
  
  // Runner state
  const [runner, setRunner] = useState(null);
  const [cleanup, setCleanup] = useState(null);
  const [runStep, setRunStep] = useState(null);
  const [initError, setInitError] = useState(null);
  
  // Test state (mutable copy)
  const [localTest, setLocalTest] = useState(() => JSON.parse(JSON.stringify(test)));
  
  // Step execution state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepResult, setStepResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Results tracking
  const [results, setResults] = useState({ passed: 0, failed: 0 });
  
  // Auto-advance timer ref
  const autoAdvanceTimer = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
      if (cleanup) {
        cleanup().catch(() => {});
      }
    };
  }, [cleanup]);

  // Initialize runner
  useEffect(() => {
    if (phase !== 'init') return;
    
    const initRunner = async () => {
      try {
        const { getRunner } = require('doc-detective-core');
        const result = await getRunner({ headless: false });
        setRunner(result.runner);
        setCleanup(() => result.cleanup);
        setRunStep(() => result.runStep);
        
        // Check if we need a goTo step
        const steps = localTest.steps || [];
        const firstBrowserIndex = findFirstBrowserStepIndex(steps);
        
        if (firstBrowserIndex >= 0 && !hasGoToBefore(steps, firstBrowserIndex)) {
          setPhase('checkGoTo');
        } else {
          setPhase('stepPreview');
        }
      } catch (error) {
        setInitError(error.message || 'Failed to initialize browser');
        setPhase('error');
      }
    };
    
    initRunner();
  }, [phase, localTest.steps]);

  // Handle escape key
  useInput((input, key) => {
    if (key.escape) {
      if (phase === 'stepEdit') {
        setPhase('stepPreview');
      } else if (phase === 'stepPreview' || phase === 'stepResult') {
        // Confirm exit
        setPhase('confirmExit');
      }
    }
  });

  // Cleanup and exit helper
  const cleanupAndExit = useCallback(async (callback) => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    if (cleanup) {
      try {
        await cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    callback();
  }, [cleanup]);

  // Execute current step
  const executeStep = useCallback(async () => {
    if (!runStep || !runner) return;
    
    const steps = localTest.steps || [];
    const step = steps[currentStepIndex];
    
    if (!step) {
      setPhase('complete');
      return;
    }
    
    setIsExecuting(true);
    setStepResult(null);
    
    try {
      const result = await runStep({
        config: {},
        context: {},
        step,
        driver: runner,
        metaValues: {},
        options: {},
      });
      
      setStepResult(result);
      
      if (result.status === 'PASS') {
        setResults((prev) => ({ ...prev, passed: prev.passed + 1 }));
        setPhase('stepResult');
        
        // Auto-advance after 1.5 seconds
        autoAdvanceTimer.current = setTimeout(() => {
          if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
            setPhase('stepPreview');
          } else {
            setPhase('complete');
          }
        }, 1500);
      } else {
        setResults((prev) => ({ ...prev, failed: prev.failed + 1 }));
        setPhase('stepResult');
      }
    } catch (error) {
      setStepResult({
        status: 'FAIL',
        description: error.message || 'Step execution failed',
      });
      setResults((prev) => ({ ...prev, failed: prev.failed + 1 }));
      setPhase('stepResult');
    } finally {
      setIsExecuting(false);
    }
  }, [runStep, runner, localTest.steps, currentStepIndex]);

  // Add goTo step at the specified index
  const addGoToStep = useCallback((url, insertIndex) => {
    const newSteps = [...(localTest.steps || [])];
    newSteps.splice(insertIndex, 0, { goTo: url });
    setLocalTest({ ...localTest, steps: newSteps });
  }, [localTest]);

  // Update a step
  const updateStep = useCallback((stepIndex, updatedStep) => {
    const newSteps = [...(localTest.steps || [])];
    newSteps[stepIndex] = updatedStep;
    setLocalTest({ ...localTest, steps: newSteps });
  }, [localTest]);

  // Get step display info
  const getStepDisplay = (step) => {
    const actionType = getStepActionType(step);
    const actionValue = actionType ? step[actionType] : null;
    const displayValue = typeof actionValue === 'string' 
      ? truncateGraphemeSafe(actionValue, 50) 
      : typeof actionValue === 'object' 
        ? truncateGraphemeSafe(JSON.stringify(actionValue), 50)
        : '';
    return { actionType: actionType || 'unknown', displayValue };
  };

  const steps = localTest.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex];

  // Error phase
  if (phase === 'error') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', 'Error'],
        validationStatus: false,
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'red', bold: true }, '❌ Initialization Error')
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'red' }, initError)
      ),
      React.createElement(SelectInput, {
        items: [{ label: '← Back', value: 'back' }],
        onSelect: () => onCancel(),
      })
    );
  }

  // Init phase - loading
  if (phase === 'init') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', 'Initializing'],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'cyan' }, '🚀 Starting browser...')
      ),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true },
        'This may take a moment. The browser will open in visible mode.'
      )
    );
  }

  // Check goTo phase
  if (phase === 'checkGoTo') {
    const firstBrowserIndex = findFirstBrowserStepIndex(steps);
    const firstBrowserStep = steps[firstBrowserIndex];
    const { actionType } = getStepDisplay(firstBrowserStep);

    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', 'Navigation Required'],
        validationStatus: false,
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'yellow', bold: true }, '⚠️  No Navigation Step Found')
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(
          Text,
          null,
          `The first browser action is "${actionType}" (step ${firstBrowserIndex + 1}), but there's no goTo step before it.`
        )
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(
          Text,
          { color: 'gray' },
          'Browser actions require navigating to a URL first.'
        )
      ),
      React.createElement(SelectInput, {
        items: [
          { label: '➕ Add a goTo step', value: 'addGoTo' },
          { label: '← Cancel debug session', value: 'cancel' },
        ],
        onSelect: (item) => {
          if (item.value === 'addGoTo') {
            setPhase('addGoTo');
          } else {
            cleanupAndExit(onCancel);
          }
        },
      })
    );
  }

  // Add goTo phase
  if (phase === 'addGoTo') {
    const firstBrowserIndex = findFirstBrowserStepIndex(steps);

    return React.createElement(GoToInput, {
      onSubmit: (url) => {
        addGoToStep(url, firstBrowserIndex);
        setPhase('stepPreview');
      },
      onCancel: () => setPhase('checkGoTo'),
    });
  }

  // Step preview phase
  if (phase === 'stepPreview' && currentStep) {
    const { actionType, displayValue } = getStepDisplay(currentStep);

    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', `Step ${currentStepIndex + 1}/${totalSteps}`],
        hint: 'Run, edit, or stop the debug session',
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: 'cyan' }, `Step ${currentStepIndex + 1}: `),
        React.createElement(Text, { color: 'white' }, actionType),
        displayValue && React.createElement(Text, { color: 'gray' }, `: ${displayValue}`)
      ),
      React.createElement(
        Box,
        { marginBottom: 1, borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
        React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(Text, { color: 'gray', dimColor: true }, 'Step JSON:'),
          React.createElement(Text, { color: 'white' }, JSON.stringify(currentStep, null, 2))
        )
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'gray' }, `Progress: ${results.passed} passed, ${results.failed} failed`)
      ),
      React.createElement(SelectInput, {
        items: [
          { label: '▶️  Run this step', value: 'run' },
          { label: '✏️  Edit step before running', value: 'edit' },
          { label: '⛔ Stop debug session', value: 'stop' },
        ],
        onSelect: (item) => {
          if (item.value === 'run') {
            executeStep();
          } else if (item.value === 'edit') {
            setPhase('stepEdit');
          } else if (item.value === 'stop') {
            cleanupAndExit(() => onComplete(localTest));
          }
        },
      })
    );
  }

  // Step edit phase
  if (phase === 'stepEdit' && currentStep) {
    return React.createElement(StepEditor, {
      step: currentStep,
      stepIndex: currentStepIndex,
      onChange: (updatedStep) => {
        updateStep(currentStepIndex, updatedStep);
      },
      onSave: (updatedStep) => {
        updateStep(currentStepIndex, updatedStep);
        setPhase('stepPreview');
      },
      onCancel: () => setPhase('stepPreview'),
      onDelete: () => {
        // Don't allow deletion during debug - would mess up step indices
        setPhase('stepPreview');
      },
    });
  }

  // Step result phase
  if (phase === 'stepResult') {
    const passed = stepResult?.status === 'PASS';
    const { actionType } = getStepDisplay(currentStep);

    if (passed) {
      return React.createElement(
        Box,
        { flexDirection: 'column', padding: 1 },
        React.createElement(StatusBar, {
          location: ['Debug Runner', `Step ${currentStepIndex + 1}/${totalSteps}`],
          validationStatus: true,
        }),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, { color: 'green', bold: true }, '✅ Step Passed')
        ),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, null, `"${actionType}" completed successfully.`)
        ),
        stepResult?.description && React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, { color: 'gray' }, stepResult.description)
        ),
        React.createElement(
          Text,
          { color: 'gray', dimColor: true },
          currentStepIndex < totalSteps - 1 
            ? 'Auto-advancing to next step...' 
            : 'Test complete! Finishing up...'
        )
      );
    } else {
      // Failed - show error and options
      return React.createElement(
        Box,
        { flexDirection: 'column', padding: 1 },
        React.createElement(StatusBar, {
          location: ['Debug Runner', `Step ${currentStepIndex + 1}/${totalSteps}`],
          validationStatus: false,
        }),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, { color: 'red', bold: true }, '❌ Step Failed')
        ),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, null, `"${actionType}" failed to execute.`)
        ),
        stepResult?.description && React.createElement(
          Box,
          { marginBottom: 1, paddingX: 1, borderStyle: 'single', borderColor: 'red' },
          React.createElement(Text, { color: 'red' }, stepResult.description)
        ),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, { color: 'gray' }, `Progress: ${results.passed} passed, ${results.failed} failed`)
        ),
        React.createElement(SelectInput, {
          items: [
            { label: '✏️  Edit step and retry', value: 'editRetry' },
            { label: '⛔ Stop debug session', value: 'stop' },
          ],
          onSelect: (item) => {
            if (item.value === 'editRetry') {
              // Decrement failed count since we're retrying
              setResults((prev) => ({ ...prev, failed: prev.failed - 1 }));
              setPhase('stepEdit');
            } else {
              cleanupAndExit(() => onComplete(localTest));
            }
          },
        })
      );
    }
  }

  // Confirm exit phase
  if (phase === 'confirmExit') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', 'Confirm Exit'],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'yellow', bold: true }, '⚠️  Stop Debug Session?')
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, null, 'This will close the browser and return to the editor.')
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'gray' }, `Current progress: ${results.passed} passed, ${results.failed} failed`)
      ),
      React.createElement(SelectInput, {
        items: [
          { label: 'Stop and save changes', value: 'stop' },
          { label: 'Continue debugging', value: 'continue' },
        ],
        onSelect: (item) => {
          if (item.value === 'stop') {
            cleanupAndExit(() => onComplete(localTest));
          } else {
            setPhase('stepPreview');
          }
        },
      })
    );
  }

  // Complete phase
  if (phase === 'complete') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', 'Complete'],
        validationStatus: results.failed === 0,
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(
          Text,
          { color: results.failed === 0 ? 'green' : 'yellow', bold: true },
          results.failed === 0 ? '🎉 All Steps Passed!' : '⚠️  Debug Session Complete'
        )
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, null, `Results: ${results.passed} passed, ${results.failed} failed`)
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(
          Text,
          { color: 'gray' },
          'Any changes made during debugging will be preserved.'
        )
      ),
      React.createElement(SelectInput, {
        items: [
          { label: '← Return to editor', value: 'done' },
        ],
        onSelect: () => {
          cleanupAndExit(() => onComplete(localTest));
        },
      })
    );
  }

  // Fallback for executing state
  if (isExecuting) {
    const { actionType } = getStepDisplay(currentStep);
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(StatusBar, {
        location: ['Debug Runner', `Step ${currentStepIndex + 1}/${totalSteps}`],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: 'cyan' }, `⏳ Running "${actionType}"...`)
      ),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true },
        'Check the browser window for action execution.'
      )
    );
  }

  // Default fallback
  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { color: 'gray' }, 'Loading...')
  );
};

/**
 * GoTo URL input component
 */
const GoToInput = ({ onSubmit, onCancel }) => {
  const [url, setUrl] = useState('https://');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      if (url.trim() && (url.startsWith('http://') || url.startsWith('https://'))) {
        onSubmit(url.trim());
      }
      return;
    }
    if (key.backspace || key.delete) {
      setUrl((prev) => prev.slice(0, -1));
      return;
    }
    if (!key.ctrl && !key.meta && input) {
      setUrl((prev) => prev + input);
    }
  });

  const isValid = url.trim() && (url.startsWith('http://') || url.startsWith('https://'));

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(StatusBar, {
      location: ['Debug Runner', 'Add goTo Step'],
    }),
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '🌐 Add Navigation Step')
    ),
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, null, 'Enter the URL to navigate to before running browser actions:')
    ),
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { color: 'cyan' }, 'URL: '),
      React.createElement(Text, { color: isValid ? 'green' : 'white' }, url),
      React.createElement(Text, { color: 'gray' }, '█')
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'gray', dimColor: true },
        'Press Enter to confirm, Esc to cancel'
      )
    ),
    !isValid && url.length > 0 && React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'yellow' },
        'URL must start with http:// or https://'
      )
    )
  );
};

export default DebugRunner;
