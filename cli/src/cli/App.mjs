import React from 'react';
const { createElement: h } = React;
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import TestRunner from './TestRunner.mjs';
import ResultsSummary from './ResultsSummary.mjs';

const App = ({ config, resolvedTests, state }) => {
  return h(Box, { flexDirection: 'column', paddingY: 1 },
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color: 'cyan' }, 'Doc Detective')
    ),

    state.phase === 'initializing' && h(Box, null,
      h(Text, { color: 'gray' },
        h(Spinner, { type: 'dots' }), ' Initializing...'
      )
    ),

    state.phase === 'running' && h(TestRunner, {
      config,
      progress: state.progress,
      currentSpec: state.currentSpec,
      currentTest: state.currentTest,
    }),

    state.phase === 'completed' && state.results && h(ResultsSummary, {
      results: state.results,
      config,
    }),

    state.phase === 'error' && h(Box, { flexDirection: 'column' },
      h(Text, { color: 'red', bold: true }, '✖ Error'),
      h(Text, { color: 'red' }, state.error)
    )
  );
};

export default App;
