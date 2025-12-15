/**
 * Test editor component - manages tests and their steps (ESM version)
 */

import React from 'react';
const { useState, useMemo } = React;
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import {
  getTestFields,
  validateTest,
  createDefaultStep,
  getCommonStepProperties,
  getStepTypes,
} from './schemaUtils.mjs';
import FieldEditor from './FieldEditor.mjs';
import StepEditor from './StepEditor.mjs';
import { StatusBar, JsonPreview, DescriptiveItem, NoIndicator, ScrollableSelect } from './components.mjs';

/**
 * Test editor - edit test properties and manage steps
 */
const TestEditor = ({
  test,
  testIndex,
  onChange,
  onSave,
  onCancel,
  onDelete,
}) => {
  const [view, setView] = useState('menu'); // 'menu', 'editMeta', 'editStep', 'addStep', 'preview', 'confirmCancel'
  const [editingField, setEditingField] = useState(null);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [localTest, setLocalTest] = useState(test);

  // Track original test for detecting changes
  const [originalTest] = useState(() => JSON.parse(JSON.stringify(test)));

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localTest) !== JSON.stringify(originalTest);
  }, [localTest, originalTest]);

  // Get test fields
  const { fields: testFields } = useMemo(() => getTestFields(), []);

  // Validation
  const validation = useMemo(() => validateTest(localTest), [localTest]);

  // Handle escape - go back from any sub-view, or cancel from main menu
  useInput((input, key) => {
    if (key.escape) {
      if (view === 'menu') {
        if (hasUnsavedChanges) {
          setView('confirmCancel');
        } else {
          onCancel();
        }
      } else if (view === 'confirmCancel') {
        setView('menu');
      } else {
        setView('menu');
        setEditingField(null);
        setEditingStepIndex(null);
      }
    }
  });

  // Edit metadata field view
  if (view === 'editMeta' && editingField) {
    const fieldDef = testFields.find((f) => f.name === editingField);

    if (!fieldDef) {
      console.warn(`[TestEditor] Missing field definition for editingField: "${editingField}"`);
      return React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(StatusBar, {
          location: ['Test ' + (testIndex + 1), editingField],
          validationStatus: validation.valid,
        }),
        React.createElement(
          Box,
          { marginBottom: 1 },
          React.createElement(Text, { color: 'yellow' }, `⚠️  Unknown field: "${editingField}"`)
        ),
        React.createElement(
          Text,
          { color: 'gray' },
          'Press Esc to go back'
        )
      );
    }

    const currentValue = localTest[editingField];

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(StatusBar, {
        location: ['Test ' + (testIndex + 1), editingField],
        validationStatus: validation.valid,
      }),
      React.createElement(FieldEditor, {
        field: fieldDef,
        value: currentValue,
        onChange: (newValue) => {
          const updatedTest = { ...localTest, [editingField]: newValue };
          setLocalTest(updatedTest);
          onChange(updatedTest);
        },
        onSubmit: () => setView('menu'),
        onCancel: () => setView('menu'),
      })
    );
  }

  // Edit step view
  if (view === 'editStep' && editingStepIndex !== null) {
    const currentStep = localTest.steps?.[editingStepIndex] || {};

    return React.createElement(StepEditor, {
      step: currentStep,
      stepIndex: editingStepIndex,
      onChange: (updatedStep) => {
        const newSteps = [...(localTest.steps || [])];
        newSteps[editingStepIndex] = updatedStep;
        const updatedTest = { ...localTest, steps: newSteps };
        setLocalTest(updatedTest);
        onChange(updatedTest);
      },
      onSave: (updatedStep) => {
        const newSteps = [...(localTest.steps || [])];
        newSteps[editingStepIndex] = updatedStep;
        const updatedTest = { ...localTest, steps: newSteps };
        setLocalTest(updatedTest);
        onChange(updatedTest);
        setView('menu');
        setEditingStepIndex(null);
      },
      onCancel: () => {
        setView('menu');
        setEditingStepIndex(null);
      },
      onDelete: () => {
        const newSteps = [...(localTest.steps || [])];
        newSteps.splice(editingStepIndex, 1);
        const updatedTest = { ...localTest, steps: newSteps };
        setLocalTest(updatedTest);
        onChange(updatedTest);
        setView('menu');
        setEditingStepIndex(null);
      },
    });
  }

  // Add step view
  if (view === 'addStep') {
    // Create new step with step editor (it will prompt for type)
    // Default to goTo step as a reasonable starting point
    const newStep = createDefaultStep('goTo');

    return React.createElement(StepEditor, {
      step: newStep,
      stepIndex: (localTest.steps || []).length,
      onChange: () => {},
      onSave: (newStep) => {
        const newSteps = [...(localTest.steps || []), newStep];
        const updatedTest = { ...localTest, steps: newSteps };
        setLocalTest(updatedTest);
        onChange(updatedTest);
        setView('menu');
      },
      onCancel: () => setView('menu'),
      onDelete: () => setView('menu'),
    });
  }

  // Add metadata field view
  if (view === 'addMeta') {
    // Get fields that aren't already set
    const availableFields = testFields.filter((f) => {
      if (f.name === 'steps') return false; // Steps handled separately
      if (f.name === '$schema') return false;
      return localTest[f.name] === undefined;
    });

    const items = availableFields.map((f) => ({
      label: `${f.name}${f.required ? ' (required)' : ''}`,
      description: f.description || '',
      value: f.name,
    }));

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(StatusBar, {
        location: ['Test ' + (testIndex + 1), 'Add Property'],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: 'cyan' }, 'Select property to add:')
      ),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true, marginBottom: 1 },
        '(Esc to go back)'
      ),
      React.createElement(ScrollableSelect, {
        items,
        itemComponent: DescriptiveItem,
        indicatorComponent: NoIndicator,
        onSelect: (item) => {
          setEditingField(item.value);
          setView('editMeta');
        },
      })
    );
  }

  // Delete metadata field view
  if (view === 'deleteMeta') {
    const deletableFields = testFields.filter((f) => {
      if (f.name === 'steps') return false;
      if (f.name === '$schema') return false;
      if (f.required) return false;
      return localTest[f.name] !== undefined;
    });

    const items = deletableFields.map((f) => ({
      label: `🗑️  ${f.name}: ${String(localTest[f.name]).substring(0, 30)}`,
      value: f.name,
    }));

    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(StatusBar, {
        location: ['Test ' + (testIndex + 1), 'Delete Property'],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: 'red' }, 'Select property to delete:')
      ),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true, marginBottom: 1 },
        '(Esc to go back)'
      ),
      React.createElement(SelectInput, {
        items,
        onSelect: (item) => {
          const updatedTest = { ...localTest };
          delete updatedTest[item.value];
          setLocalTest(updatedTest);
          onChange(updatedTest);
          setView('menu');
        },
      })
    );
  }

  // Preview view
  if (view === 'preview') {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(StatusBar, {
        location: ['Test ' + (testIndex + 1), 'Preview'],
        validationStatus: validation.valid,
      }),
      React.createElement(JsonPreview, {
        data: localTest,
        title: 'Test Preview',
      }),
      !validation.valid &&
        React.createElement(
          Box,
          { marginTop: 1 },
          React.createElement(Text, { color: 'red' }, 'Validation errors: ' + validation.errors)
        ),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(SelectInput, {
          items: [{ label: '← Back', value: 'back' }],
          onSelect: () => setView('menu'),
        })
      )
    );
  }

  // Main menu view
  const menuItems = [];
  let menuIndex = 0;

  // Test metadata
  menuItems.push({
    label: '📝 Test Properties',
    value: `none_${menuIndex++}`,
  });

  testFields
    .filter((f) => f.name !== 'steps' && f.name !== '$schema' && localTest[f.name] !== undefined)
    .forEach((f) => {
      const val = localTest[f.name];
      const stringSource = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const displayVal = stringSource.substring(0, 50);
      menuItems.push({
        label: `   ✏️  ${f.name}: ${displayVal}${stringSource.length > 50 ? '...' : ''}`,
        value: `editMeta:${f.name}`,
      });
    });

  menuItems.push({
    label: '   ➕ Add property',
    value: 'addMeta',
  });
  menuItems.push({
    label: '   🗑️  Delete property',
    value: 'deleteMeta',
  });

  menuItems.push({ label: '─────── Steps ──────────', value: `none_${menuIndex++}` });

  // Steps section
  const steps = localTest.steps || [];
  menuItems.push({
    label: `📋 Steps (${steps.length})`,
    value: `none_${menuIndex++}`,
  });

  // Get common step properties and valid step types once for reuse
  const commonStepProps = Object.keys(getCommonStepProperties());
  const validStepTypes = getStepTypes();

  steps.forEach((step, index) => {
    // Determine step type by finding a key that is a valid step type (not a common property)
    const stepType = Object.keys(step).find((k) => validStepTypes.includes(k) && !commonStepProps.includes(k));
    const stepValue = stepType ? step[stepType] : null;
    const displayValue = typeof stepValue === 'string' ? stepValue.substring(0, 40) : '';
    const displayType = stepType || '(unknown step type)';

    menuItems.push({
      label: `   ${index + 1}. ${displayType}${displayValue ? ': ' + displayValue : ''}${displayValue.length >= 40 ? '...' : ''}`,
      value: `editStep:${index}`,
    });
  });

  menuItems.push({
    label: '   ➕ Add step',
    value: 'addStep',
  });

  menuItems.push({ label: '─────── Save/Exit ──────', value: `none_${menuIndex++}` });

  // Actions
  menuItems.push({ label: '🔍 Preview JSON', value: 'preview' });

  if (validation.valid) {
    menuItems.push({ label: '💾 Save test', value: 'save' });
  } else {
    menuItems.push({
      label: '⚠️  Fix errors before saving',
      value: `none_${menuIndex++}`,
    });
  }

  menuItems.push({ label: '🗑️  Delete test', value: 'delete' });
  menuItems.push({ label: '← Back (discard changes)', value: 'cancel' });

  // Confirm cancel with unsaved changes
  if (view === 'confirmCancel') {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(StatusBar, {
        location: ['Test ' + (testIndex + 1), 'Confirm'],
      }),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { bold: true, color: 'yellow' }, '⚠️  Unsaved Changes')
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, null, 'You have unsaved changes to this test. Are you sure you want to go back?')
      ),
      React.createElement(SelectInput, {
        items: [
          { label: '← Discard changes and go back', value: 'discard' },
          { label: 'Continue editing', value: 'continue' },
        ],
        onSelect: (item) => {
          if (item.value === 'discard') {
            onCancel();
          } else {
            setView('menu');
          }
        },
      })
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(StatusBar, {
      location: ['Test ' + (testIndex + 1)],
      validationStatus: validation.valid,
      hint: 'Use ↑↓ to navigate, Enter to select',
    }),
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'Edit Test'),
      localTest.description &&
        React.createElement(Text, { color: 'gray' }, ': ' + localTest.description)
    ),
    !validation.valid &&
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(
          Text,
          { color: 'yellow' },
          '⚠️  Test has validation errors'
        )
      ),
    React.createElement(SelectInput, {
      items: menuItems,
      onSelect: (item) => {
        const value = item.value;

        // Handle editMeta action (format: "editMeta:fieldName")
        if (value.startsWith('editMeta:')) {
          const field = value.substring(9);
          setEditingField(field);
          setView('editMeta');
          return;
        }

        // Handle editStep action (format: "editStep:index")
        if (value.startsWith('editStep:')) {
          const stepIndex = parseInt(value.substring(9), 10);
          setEditingStepIndex(stepIndex);
          setView('editStep');
          return;
        }

        switch (value) {
          case 'addMeta':
            setView('addMeta');
            break;
          case 'deleteMeta':
            setView('deleteMeta');
            break;
          case 'addStep':
            setView('addStep');
            break;
          case 'preview':
            setView('preview');
            break;
          case 'save':
            onSave(localTest);
            break;
          case 'delete':
            onDelete();
            break;
          case 'cancel':
            if (hasUnsavedChanges) {
              setView('confirmCancel');
            } else {
              onCancel();
            }
            break;
          // Ignore 'none_*' values
        }
      },
    })
  );
};

export default TestEditor;
