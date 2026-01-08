/**
 * DocumentImporter - File browser for selecting documentation files
 * Allows users to navigate directories and select markdown or DITA files
 */

import React from 'react';
const { useState, useEffect, useMemo } = React;
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Detect format from file extension
 * @param {string} filename - File name
 * @returns {string} Format: 'markdown' or 'dita'
 */
function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  if (ext === '.dita' || ext === '.xml') return 'dita';
  return 'unknown';
}

/**
 * Get file preview (first 500 chars)
 * @param {string} filePath - Path to file
 * @returns {string} Preview text
 */
function getFilePreview(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.substring(0, 500) + (content.length > 500 ? '\n...' : '');
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

/**
 * DocumentImporter component
 * @param {Object} props
 * @param {string} props.initialDir - Starting directory
 * @param {Function} props.onSelect - Called with (filePath, format) when file selected
 * @param {Function} props.onCancel - Called when user cancels
 */
const DocumentImporter = ({ initialDir, onSelect, onCancel }) => {
  const [currentDir, setCurrentDir] = useState(initialDir);
  const [selectedFile, setSelectedFile] = useState(null);
  const [view, setView] = useState('browse'); // 'browse' | 'preview' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);

  // Get directory contents
  const items = useMemo(() => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      const items = [];

      // Add parent directory option (if not at root)
      const parentDir = path.dirname(currentDir);
      if (parentDir !== currentDir) {
        items.push({
          label: '.. (parent directory)',
          value: parentDir,
          type: 'directory',
        });
      }

      // Add subdirectories
      entries
        .filter((e) => e.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((e) => {
          items.push({
            label: `📁 ${e.name}`,
            value: path.join(currentDir, e.name),
            type: 'directory',
          });
        });

      // Add supported files
      entries
        .filter((e) => e.isFile())
        .filter((e) => {
          const ext = path.extname(e.name).toLowerCase();
          return ['.md', '.markdown', '.dita', '.xml'].includes(ext);
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((e) => {
          items.push({
            label: `📄 ${e.name}`,
            value: path.join(currentDir, e.name),
            type: 'file',
            format: detectFormat(e.name),
          });
        });

      return items;
    } catch (err) {
      setErrorMessage(`Error reading directory: ${err.message}`);
      setView('error');
      return [];
    }
  }, [currentDir]);

  // Handle escape key
  useInput((input, key) => {
    if (key.escape) {
      if (view === 'preview') {
        setView('browse');
        setSelectedFile(null);
      } else {
        onCancel();
      }
    }
  });

  // Error view
  if (view === 'error') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'red' }, 'Error'),
      React.createElement(
        Text,
        { color: 'gray', marginTop: 1 },
        errorMessage
      ),
      React.createElement(
        Text,
        { color: 'gray', marginTop: 1 },
        'Press Esc to cancel'
      )
    );
  }

  // Browse view
  if (view === 'browse') {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(
        Text,
        { bold: true, color: 'cyan' },
        'Select Documentation File'
      ),
      React.createElement(
        Text,
        { color: 'gray', marginBottom: 1 },
        `Current: ${currentDir}`
      ),
      items.length > 0
        ? React.createElement(SelectInput, {
            items,
            onSelect: (item) => {
              if (item.type === 'directory') {
                setCurrentDir(item.value);
              } else if (item.type === 'file') {
                setSelectedFile(item);
                setView('preview');
              }
            },
          })
        : React.createElement(
            Text,
            { color: 'yellow' },
            'No supported files found in this directory'
          ),
      React.createElement(
        Text,
        { color: 'gray', marginTop: 1 },
        'Press Esc to cancel'
      )
    );
  }

  // Preview view
  if (view === 'preview' && selectedFile) {
    const preview = getFilePreview(selectedFile.value);

    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'Preview'),
      React.createElement(
        Text,
        { color: 'gray' },
        `File: ${path.basename(selectedFile.value)}`
      ),
      React.createElement(
        Text,
        { color: 'gray', marginBottom: 1 },
        `Format: ${selectedFile.format}`
      ),
      React.createElement(
        Box,
        {
          flexDirection: 'column',
          borderStyle: 'single',
          borderColor: 'gray',
          padding: 1,
          marginBottom: 1,
        },
        React.createElement(Text, null, preview)
      ),
      React.createElement(SelectInput, {
        items: [
          { label: '✓ Import this file', value: 'import' },
          { label: '← Back', value: 'back' },
        ],
        onSelect: (item) => {
          if (item.value === 'import') {
            onSelect(selectedFile.value, selectedFile.format);
          } else {
            setView('browse');
            setSelectedFile(null);
          }
        },
      })
    );
  }

  return null;
};

export default DocumentImporter;
