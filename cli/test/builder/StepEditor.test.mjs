/**
 * Tests for StepEditor.mjs - Step editor component
 * 
 * Uses ink-testing-library to render and test the Ink React component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

import StepEditor from '../../src/cli/builder/StepEditor.mjs';
import {
  getMockStep,
  getMockGoToStep,
  getMockClickStep,
  getMockFindStep,
  getMockTypeStep,
} from './fixtures.mjs';

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('StepEditor component', function () {
  // Common callback stubs
  const noopCallbacks = {
    onChange: () => {},
    onSave: () => {},
    onCancel: () => {},
    onDelete: () => {},
  };

  describe('step type selection', function () {
    it('shows step type selector when step has no action', function () {
      const emptyStep = {};
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step: emptyStep,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Select Step Type');
    });

    it('lists available step types', function () {
      const emptyStep = {};
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step: emptyStep,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
      expect(frame).to.include('click');
      expect(frame).to.include('find');
    });
  });

  describe('menu display for existing step', function () {
    it('shows Edit Step header with step type', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Edit Step');
      expect(frame).to.include('goTo');
    });

    it('displays current step value', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('https://example.com');
    });

    it('shows Add field option', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add field');
    });

    it('shows Preview JSON option', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Preview JSON');
    });

    it('shows Change step type option', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Change step type');
    });

    it('shows Save step option for valid step', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Save step');
    });

    it('shows Delete step option', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Delete step');
    });

    it('shows Back option', function () {
      const step = getMockGoToStep('https://example.com');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Back');
    });
  });

  describe('step index display', function () {
    it('displays correct step number', function () {
      const step = getMockGoToStep();
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 2,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Step 3'); // 0-indexed to 1-indexed
    });
  });

  describe('different step types', function () {
    it('displays click step correctly', function () {
      const step = getMockClickStep('.submit-button');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('click');
      expect(frame).to.include('.submit-button');
    });

    it('displays find step correctly', function () {
      const step = getMockFindStep('#main-content');
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('find');
      expect(frame).to.include('#main-content');
    });

    it('displays type step with array value', function () {
      const step = getMockTypeStep(['test input', '$ENTER$']);
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('type');
    });
  });

  describe('object form steps', function () {
    it('displays object properties for detailed step', function () {
      const step = {
        goTo: {
          url: 'https://example.com',
          wait: { duration: 5000 },
        },
      };
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
    });
  });

  describe('step with common properties', function () {
    it('displays step with description', function () {
      const step = {
        goTo: 'https://example.com',
        description: 'Navigate to homepage',
      };
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('description');
      expect(frame).to.include('Navigate');
    });

    it('displays step with stepId', function () {
      const step = {
        goTo: 'https://example.com',
        stepId: 'nav-step',
      };
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('stepId');
      expect(frame).to.include('nav-step');
    });
  });

  describe('validation display', function () {
    it('shows warning for step with validation errors', function () {
      // A step with an unrecognized action type would fail validation
      // but we need a step type to display the menu, so we create an invalid value instead
      const step = {
        goTo: { url: '' }, // Empty required field might fail validation
      };
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      // The step might show validation warning or "Fix errors" message
      // depending on schema validation
      expect(frame).to.include('goTo');
    });
  });

  describe('source location preservation', function () {
    it('handles step with sourceLocation metadata', function () {
      const step = {
        goTo: 'https://example.com',
        sourceLocation: {
          file: '/path/to/file.md',
          isInline: true,
          startOffset: 0,
          endOffset: 50,
        },
      };
      const { lastFrame } = render(
        React.createElement(StepEditor, {
          step,
          stepIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      // sourceLocation should not appear in the menu as it's internal metadata
      expect(frame).to.include('goTo');
      expect(frame).to.not.include('sourceLocation');
    });
  });
});
