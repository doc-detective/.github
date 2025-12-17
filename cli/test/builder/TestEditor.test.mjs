/**
 * Tests for TestEditor.mjs - Test editor component
 * 
 * Uses ink-testing-library to render and test the Ink React component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import TestEditor from '../../src/cli/builder/TestEditor.mjs';
import {
  getMockTest,
  getMockGoToStep,
  getMockClickStep,
  getMockFindStep,
  getMockTypeStep,
  getMockInlineStep,
} from './fixtures.mjs';

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('TestEditor component', function () {
  // Common callback stubs
  const noopCallbacks = {
    onChange: () => {},
    onSave: () => {},
    onCancel: () => {},
    onDelete: () => {},
  };

  describe('initial rendering', function () {
    it('displays Edit Test header', function () {
      const test = getMockTest({ description: 'My test' });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Edit Test');
    });

    it('displays test description in header', function () {
      const test = getMockTest({ description: 'Navigation test suite' });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Navigation test suite');
    });

    it('displays correct test index in status bar', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 2,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Test 3'); // 0-indexed to 1-indexed
    });
  });

  describe('menu structure', function () {
    it('displays Test Properties section', function () {
      const test = getMockTest({ testId: 'my-test' });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Test Properties');
    });

    it('displays Steps section', function () {
      const test = getMockTest({ steps: [] });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Steps');
    });

    it('shows Add property option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add property');
    });

    it('shows Delete property option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Delete property');
    });

    it('shows Add step option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add step');
    });

    it('shows Preview JSON option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Preview JSON');
    });

    it('shows Save test option for valid test', function () {
      const test = getMockTest({ steps: [getMockGoToStep()] });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Save test');
    });

    it('shows Delete test option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Delete test');
    });

    it('shows Back option', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Back');
    });
  });

  describe('test metadata display', function () {
    it('displays testId when set', function () {
      const test = getMockTest({ testId: 'nav-test-001' });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('testId');
      expect(frame).to.include('nav-test-001');
    });

    it('displays description when set', function () {
      const test = getMockTest({ description: 'Test user login flow' });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('description');
      expect(frame).to.include('Test user login');
    });

    it('truncates long values', function () {
      const longDescription = 'A'.repeat(100);
      const test = getMockTest({ description: longDescription });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('...');
    });
  });

  describe('steps display', function () {
    it('displays step count', function () {
      const test = getMockTest({
        steps: [
          getMockGoToStep('https://example.com'),
          getMockClickStep('.button'),
          getMockFindStep('.element'),
        ],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Steps (3)');
    });

    it('displays zero steps count', function () {
      const test = getMockTest({ steps: [] });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Steps (0)');
    });

    it('displays step type and number', function () {
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('1.');
      expect(frame).to.include('goTo');
    });

    it('displays step value for string actions', function () {
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com/page')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('https://example.com/page');
    });

    it('displays multiple steps in order', function () {
      const test = getMockTest({
        steps: [
          getMockGoToStep('https://example.com'),
          getMockClickStep('.submit'),
          getMockFindStep('.result'),
        ],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('1.');
      expect(frame).to.include('goTo');
      expect(frame).to.include('2.');
      expect(frame).to.include('click');
      expect(frame).to.include('3.');
      expect(frame).to.include('find');
    });

    it('truncates long step values', function () {
      const longUrl = 'https://example.com/' + 'a'.repeat(100);
      const test = getMockTest({
        steps: [getMockGoToStep(longUrl)],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('...');
    });
  });

  describe('step types handling', function () {
    it('displays goTo step correctly', function () {
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
    });

    it('displays click step correctly', function () {
      const test = getMockTest({
        steps: [getMockClickStep('.button')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('click');
    });

    it('displays find step correctly', function () {
      const test = getMockTest({
        steps: [getMockFindStep('#element')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('find');
    });

    it('displays type step correctly', function () {
      const test = getMockTest({
        steps: [getMockTypeStep(['test input'])],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('type');
    });

    it('handles step with object value', function () {
      const test = getMockTest({
        steps: [{
          goTo: {
            url: 'https://example.com',
            wait: { duration: 5000 },
          },
        }],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
    });

    it('handles step with unknown action type gracefully', function () {
      const test = getMockTest({
        steps: [{ unknownAction: 'value' }],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('unknown');
    });
  });

  describe('validation display', function () {
    it('shows validation warning for invalid test', function () {
      // A test with steps containing unknown action types might fail validation
      const test = {
        testId: 'test-1',
        steps: [{ invalidStep: true }],
      };
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('validation errors');
    });

    it('shows fix errors message for invalid test', function () {
      const test = {
        testId: 'test-1',
        steps: [{ invalidStep: true }],
      };
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Fix errors');
    });

    it('shows save option for valid test', function () {
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Save test');
    });
  });

  describe('sourceLocation handling', function () {
    it('does not display sourceLocation in step list', function () {
      const test = getMockTest({
        steps: [getMockInlineStep('goTo', 'https://example.com')],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.not.include('sourceLocation');
    });
  });

  describe('hint display', function () {
    it('shows navigation hint', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('↑↓');
      expect(frame).to.include('Enter');
    });
  });

  describe('steps with common properties', function () {
    it('displays step with description', function () {
      const test = getMockTest({
        steps: [{
          goTo: 'https://example.com',
          description: 'Navigate to homepage',
        }],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
    });

    it('displays step with stepId', function () {
      const test = getMockTest({
        steps: [{
          goTo: 'https://example.com',
          stepId: 'step-1',
        }],
      });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
    });
  });

  describe('empty test handling', function () {
    it('handles test with no steps', function () {
      const test = getMockTest({ steps: [] });
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Steps (0)');
      expect(frame).to.include('Add step');
    });

    it('handles test with undefined steps', function () {
      const test = { testId: 'test-1' }; // No steps property
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Steps (0)');
    });

    it('handles test with minimal properties', function () {
      const test = { testId: 'minimal-test' };
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Edit Test');
      expect(frame).to.include('testId');
    });
  });

  describe('status bar display', function () {
    it('displays test number in status bar', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 0,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Test 1');
    });

    it('displays different test numbers correctly', function () {
      const test = getMockTest();
      const { lastFrame } = render(
        React.createElement(TestEditor, {
          test,
          testIndex: 4,
          ...noopCallbacks,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Test 5');
    });
  });
});
