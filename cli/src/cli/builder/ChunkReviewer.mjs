/**
 * ChunkReviewer - Review and accept/reject generated tests
 * Provides list and detail views with accept/reject/regenerate actions
 */

import React from 'react';
const { useState, useMemo } = React;
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';

/**
 * ChunkReviewer component
 * @param {Object} props
 * @param {Array<ReviewItem>} props.items - Items to review
 * @param {Function} props.onAccept - Called with accepted items
 * @param {Function} props.onRegenerate - Called with item ID to regenerate
 * @param {Function} props.onCancel - Called when user cancels
 */
const ChunkReviewer = ({ items, onAccept, onRegenerate, onCancel }) => {
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localItems, setLocalItems] = useState(items);

  // Handle escape key
  useInput((input, key) => {
    if (key.escape) {
      if (view === 'detail') {
        setView('list');
      } else {
        onCancel();
      }
    }
  });

  // Calculate counts
  const { acceptedCount, autoAcceptedCount, pendingCount } = useMemo(() => {
    return {
      acceptedCount: localItems.filter((i) => i.status === 'accepted').length,
      autoAcceptedCount: localItems.filter((i) => i.status === 'auto-accepted').length,
      pendingCount: localItems.filter((i) => i.status === 'pending').length,
    };
  }, [localItems]);

  // List view
  if (view === 'list') {
    const menuItems = [];

    // Add individual items
    localItems.forEach((item, index) => {
      const chunk = item.generated.chunk;
      const testCount = item.generated.tests.length;
      const preservedCount = item.generated.preservedTests.length;
      const confidence = item.generated.confidence || 0;

      // Status icon
      const statusIcon = {
        pending: '○',
        accepted: '✓',
        'auto-accepted': '✓✓',
        rejected: '✗',
        regenerating: '⟳',
      }[item.status];

      // Build label
      let label = `${statusIcon} ${chunk.heading} (${testCount} new`;
      if (preservedCount > 0) {
        label += `, ${preservedCount} preserved`;
      }
      label += ')';

      // Add confidence indicator
      if (!item.generated.hasErrors) {
        label += ` [${confidence}%]`;
      }

      if (item.generated.hasErrors) {
        label += ' ⚠️ ERROR';
      }

      menuItems.push({
        label,
        value: `item_${index}`,
      });
    });

    // Add separator
    menuItems.push({ label: '─────────────────────', value: 'separator' });

    // Add bulk actions
    if (pendingCount > 0) {
      menuItems.push({ label: '✓ Accept all', value: 'acceptAll' });
      menuItems.push({ label: '✗ Reject all', value: 'rejectAll' });
    }

    if (acceptedCount > 0 || autoAcceptedCount > 0) {
      const totalAccepted = acceptedCount + autoAcceptedCount;
      menuItems.push({
        label: `→ Continue with ${totalAccepted} accepted test${totalAccepted === 1 ? '' : 's'}`,
        value: 'continue',
      });
    }

    menuItems.push({ label: '← Cancel', value: 'cancel' });

    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(
        Text,
        { bold: true, color: 'cyan', marginBottom: 1 },
        'Review Generated Tests'
      ),
      React.createElement(
        Text,
        { color: 'gray', marginBottom: 1 },
        'Select an item to view details and accept/reject'
      ),
      React.createElement(SelectInput, {
        items: menuItems,
        onSelect: (item) => {
          if (item.value.startsWith('item_')) {
            const index = parseInt(item.value.split('_')[1]);
            setSelectedIndex(index);
            setView('detail');
          } else if (item.value === 'acceptAll') {
            setLocalItems(localItems.map((i) => ({ ...i, status: 'accepted' })));
          } else if (item.value === 'rejectAll') {
            setLocalItems(localItems.map((i) => ({ ...i, status: 'rejected' })));
          } else if (item.value === 'continue') {
            const acceptedItems = localItems.filter((i) => i.status === 'accepted' || i.status === 'auto-accepted');
            onAccept(acceptedItems);
          } else if (item.value === 'cancel') {
            onCancel();
          }
        },
      })
    );
  }

  // Detail view
  if (view === 'detail') {
    const item = localItems[selectedIndex];
    const chunk = item.generated.chunk;
    const confidence = item.generated.confidence || 0;

    // Confidence color based on level
    let confidenceColor = 'red';
    if (confidence >= 80) confidenceColor = 'green';
    else if (confidence >= 60) confidenceColor = 'yellow';

    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(
        Text,
        { bold: true, color: 'cyan' },
        `Detail: ${chunk.heading}`
      ),
      React.createElement(
        Text,
        { color: 'gray' },
        `Lines ${chunk.startLine}-${chunk.endLine}`
      ),
      // Show confidence
      !item.generated.hasErrors &&
        React.createElement(
          Text,
          { color: confidenceColor, marginBottom: 1 },
          `Confidence: ${confidence}% ${item.status === 'auto-accepted' ? '(Auto-accepted)' : ''}`
        ),

      // Show preserved tests
      item.generated.preservedTests.length > 0 &&
        React.createElement(
          Box,
          { flexDirection: 'column', marginBottom: 1 },
          React.createElement(
            Text,
            { color: 'green', bold: true },
            `Preserved Inline Tests (${item.generated.preservedTests.length}):`
          ),
          React.createElement(
            Text,
            { color: 'gray' },
            JSON.stringify(item.generated.preservedTests, null, 2).substring(0, 200) + '...'
          )
        ),

      // Show generated tests
      React.createElement(
        Box,
        { flexDirection: 'column', marginBottom: 1 },
        React.createElement(
          Text,
          { bold: true },
          `Generated Tests (${item.generated.tests.length}):`
        ),
        item.generated.hasErrors
          ? React.createElement(
              Text,
              { color: 'red' },
              `Error: ${item.generated.errorMessage}`
            )
          : React.createElement(
              Text,
              { color: 'gray' },
              JSON.stringify(item.generated.tests, null, 2).substring(0, 300) + '...'
            )
      ),

      // Actions
      React.createElement(SelectInput, {
        items: [
          { label: '✓ Accept', value: 'accept' },
          { label: '✗ Reject', value: 'reject' },
          { label: '⟳ Regenerate', value: 'regenerate' },
          { label: '← Back to list', value: 'back' },
        ],
        onSelect: (action) => {
          if (action.value === 'accept') {
            setLocalItems(
              localItems.map((i, idx) =>
                idx === selectedIndex ? { ...i, status: 'accepted' } : i
              )
            );
            setView('list');
          } else if (action.value === 'reject') {
            setLocalItems(
              localItems.map((i, idx) =>
                idx === selectedIndex ? { ...i, status: 'rejected' } : i
              )
            );
            setView('list');
          } else if (action.value === 'regenerate') {
            onRegenerate(item.id);
            setView('list');
          } else {
            setView('list');
          }
        },
      })
    );
  }

  return null;
};

export default ChunkReviewer;
