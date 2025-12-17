import React from 'react';
const { createElement: h } = React;
import { Box, Text } from 'ink';

const ResultsSummary = ({ results, config }) => {
  if (!results || !results.summary) {
    return h(Box, null,
      h(Text, { color: 'yellow' }, 'No results available.')
    );
  }

  const { specs, tests, contexts, steps } = results.summary;

  // Calculate totals
  const totalSpecs = specs ? specs.pass + specs.fail + specs.warning + specs.skipped : 0;
  const totalTests = tests ? tests.pass + tests.fail + tests.warning + tests.skipped : 0;
  const totalContexts = contexts ? contexts.pass + contexts.fail + contexts.warning + contexts.skipped : 0;
  const totalSteps = steps ? steps.pass + steps.fail + steps.warning + steps.skipped : 0;

  // Check for failures
  const hasFailures =
    (specs && specs.fail > 0) ||
    (tests && tests.fail > 0) ||
    (contexts && contexts.fail > 0) ||
    (steps && steps.fail > 0);

  // Check if all skipped
  const allSpecsSkipped =
    specs && specs.pass === 0 && specs.fail === 0 && specs.skipped > 0;

  const failedItems = hasFailures && results.specs ? getFailedItems(results) : [];

  return h(Box, { flexDirection: 'column' },
    // Header
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, underline: true }, 'Test Results Summary')
    ),

    // Specs summary
    specs && h(Box, { flexDirection: 'column', marginBottom: 1 },
      h(Text, { bold: true }, 'Specs'),
      h(Box, { marginLeft: 2 },
        h(Text, null, `Total: ${totalSpecs} `),
        specs.pass > 0 && h(Text, { color: 'green' }, `✓ ${specs.pass} passed `),
        specs.fail > 0 && h(Text, { color: 'red' }, `✖ ${specs.fail} failed `),
        specs.warning > 0 && h(Text, { color: 'yellow' }, `⚠ ${specs.warning} warnings `),
        specs.skipped > 0 && h(Text, { color: 'gray' }, `⊘ ${specs.skipped} skipped`)
      )
    ),

    // Tests summary
    tests && h(Box, { flexDirection: 'column', marginBottom: 1 },
      h(Text, { bold: true }, 'Tests'),
      h(Box, { marginLeft: 2 },
        h(Text, null, `Total: ${totalTests} `),
        tests.pass > 0 && h(Text, { color: 'green' }, `✓ ${tests.pass} passed `),
        tests.fail > 0 && h(Text, { color: 'red' }, `✖ ${tests.fail} failed `),
        tests.warning > 0 && h(Text, { color: 'yellow' }, `⚠ ${tests.warning} warnings `),
        tests.skipped > 0 && h(Text, { color: 'gray' }, `⊘ ${tests.skipped} skipped`)
      )
    ),

    // Contexts summary
    contexts && h(Box, { flexDirection: 'column', marginBottom: 1 },
      h(Text, { bold: true }, 'Contexts'),
      h(Box, { marginLeft: 2 },
        h(Text, null, `Total: ${totalContexts} `),
        contexts.pass > 0 && h(Text, { color: 'green' }, `✓ ${contexts.pass} passed `),
        contexts.fail > 0 && h(Text, { color: 'red' }, `✖ ${contexts.fail} failed `),
        contexts.warning > 0 && h(Text, { color: 'yellow' }, `⚠ ${contexts.warning} warnings `),
        contexts.skipped > 0 && h(Text, { color: 'gray' }, `⊘ ${contexts.skipped} skipped`)
      )
    ),

    // Steps summary
    steps && h(Box, { flexDirection: 'column', marginBottom: 1 },
      h(Text, { bold: true }, 'Steps'),
      h(Box, { marginLeft: 2 },
        h(Text, null, `Total: ${totalSteps} `),
        steps.pass > 0 && h(Text, { color: 'green' }, `✓ ${steps.pass} passed `),
        steps.fail > 0 && h(Text, { color: 'red' }, `✖ ${steps.fail} failed `),
        steps.warning > 0 && h(Text, { color: 'yellow' }, `⚠ ${steps.warning} warnings `),
        steps.skipped > 0 && h(Text, { color: 'gray' }, `⊘ ${steps.skipped} skipped`)
      )
    ),

    // Overall status
    h(Box, { marginTop: 1 },
      allSpecsSkipped
        ? h(Text, { color: 'yellow' }, '⚠ All items were skipped')
        : hasFailures
          ? h(Text, { color: 'red', bold: true }, '✖ Tests failed')
          : h(Text, { color: 'green', bold: true }, '✓ All tests passed!')
    ),

    // Failed items detail
    hasFailures && results.specs && h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { bold: true, color: 'red' }, 'Failed Items:'),
      ...failedItems.map((item, index) =>
        h(Box, { key: index, marginLeft: 2 },
          h(Text, { color: 'red' }, `• ${item}`)
        )
      )
    )
  );
};

// Helper function to extract failed items
function getFailedItems(results) {
  const failures = [];

  if (!results.specs) return failures;

  results.specs.forEach((spec, specIndex) => {
    if (spec.result === 'FAIL') {
      failures.push(`Spec: ${spec.specId || `Spec ${specIndex + 1}`}`);
    }

    if (spec.tests && spec.tests.length > 0) {
      spec.tests.forEach((test, testIndex) => {
        if (test.result === 'FAIL') {
          failures.push(
            `Test: ${test.testId || `Test ${testIndex + 1}`} (from ${
              spec.specId || `Spec ${specIndex + 1}`
            })`
          );
        }

        if (test.contexts && test.contexts.length > 0) {
          test.contexts.forEach((context, contextIndex) => {
            if (
              context.result === 'FAIL' ||
              (context.result && context.result.status === 'FAIL')
            ) {
              failures.push(
                `Context: ${context.platform || 'unknown'}/${
                  context.browser ? context.browser.name : 'unknown'
                } (from ${test.testId || `Test ${testIndex + 1}`})`
              );
            }

            if (context.steps && context.steps.length > 0) {
              context.steps.forEach((step, stepIndex) => {
                if (step.result === 'FAIL') {
                  failures.push(
                    `Step: ${step.stepId || `Step ${stepIndex + 1}`} - ${
                      step.resultDescription || 'Unknown error'
                    }`
                  );
                }
              });
            }
          });
        }
      });
    }
  });

  return failures;
}

export default ResultsSummary;
