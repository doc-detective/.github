/**
 * GenerationProgress - Progress indicator during AI test generation
 * Shows progress bar, current chunk, and errors
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

/**
 * GenerationProgress component
 * @param {Object} props
 * @param {number} props.current - Current chunk number (0-based or 1-based)
 * @param {number} props.total - Total number of chunks
 * @param {string|null} props.currentChunkHeading - Heading of chunk being processed
 * @param {Array<string>} props.errors - Array of error messages
 */
const GenerationProgress = ({ current, total, currentChunkHeading, errors }) => {
  // Calculate progress percentage
  const progress = total > 0 ? Math.floor((current / total) * 100) : 0;

  // Create progress bar
  const barLength = 20;
  const filledLength = Math.floor((progress / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  // Check if complete
  const isComplete = current === total && total > 0;

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },

    // Header
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(
        Text,
        { bold: true, color: 'cyan' },
        'Generating Tests from Documentation'
      )
    ),

    // Progress bar
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(
        Text,
        null,
        `Progress: [${bar}] ${current}/${total} (${progress}%)`
      )
    ),

    // Current chunk (if processing)
    currentChunkHeading &&
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Spinner, { type: 'dots' }),
        React.createElement(
          Text,
          { color: 'yellow', marginLeft: 1 },
          ` Processing: ${currentChunkHeading}`
        )
      ),

    // Errors (if any)
    errors.length > 0 &&
      React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 1 },
        React.createElement(
          Text,
          { color: 'red', bold: true },
          `Errors (${errors.length}):`
        ),
        ...errors.map((err, i) =>
          React.createElement(
            Text,
            { key: i, color: 'red' },
            `  • ${err}`
          )
        )
      ),

    // Completion message
    isComplete &&
      React.createElement(
        Text,
        { color: 'green', marginTop: 1 },
        '✓ Generation complete!'
      )
  );
};

export default GenerationProgress;
