import React from 'react';
const { createElement: h } = React;
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const TestRunner = ({ config, progress, currentSpec, currentTest }) => {
  return h(Box, { flexDirection: 'column' },
    h(Box, { marginBottom: 1 },
      h(Text, { color: 'yellow' },
        h(Spinner, { type: 'dots' }), ' Running tests...'
      )
    ),

    // Progress bars
    progress.specs.total > 0 && h(Box, { marginBottom: 0 },
      h(Text, { color: 'gray' },
        `Specs: ${progress.specs.current}/${progress.specs.total}`
      )
    ),

    progress.tests.total > 0 && h(Box, { marginBottom: 0 },
      h(Text, { color: 'gray' },
        `Tests: ${progress.tests.current}/${progress.tests.total}`
      )
    ),

    progress.steps.total > 0 && h(Box, { marginBottom: 1 },
      h(Text, { color: 'gray' },
        `Steps: ${progress.steps.current}/${progress.steps.total}`
      )
    ),

    // Current execution context
    currentSpec && h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { color: 'cyan' }, `Current: ${currentSpec}`),
      currentTest && h(Text, { color: 'gray', dimColor: true }, `→ ${currentTest}`)
    )
  );
};

export default TestRunner;
