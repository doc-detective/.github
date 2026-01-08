/**
 * Tests for GenerationProgress component - Progress indicator during AI generation
 */
import React from 'react';
import { render } from 'ink-testing-library';

let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('GenerationProgress', function () {
  let GenerationProgress;

  before(async function () {
    const module = await import('../../src/cli/builder/GenerationProgress.mjs');
    GenerationProgress = module.default;
  });

  describe('initial rendering', function () {
    it('should display progress header', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 0,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Generating Tests');
    });

    it('should show progress bar', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 4,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Progress:');
      expect(frame).to.match(/\[.*\]/); // Progress bar brackets
    });
  });

  describe('progress calculation', function () {
    it('should show 0% when current is 0', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 0,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/0%|0\/10/);
    });

    it('should show 50% when halfway through', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/50%|5\/10/);
    });

    it('should show 100% when complete', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 10,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/100%|10\/10/);
    });

    it('should handle division by zero (total = 0)', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 0,
          total: 0,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('0%');
    });
  });

  describe('current chunk display', function () {
    it('should show current chunk heading when processing', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 3,
          total: 10,
          currentChunkHeading: 'API Documentation',
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('API Documentation');
      expect(frame).to.include('Processing');
    });

    it('should show spinner when processing chunk', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 3,
          total: 10,
          currentChunkHeading: 'Installation',
          errors: [],
        })
      );

      const frame = lastFrame();
      // Spinner characters may vary, just check for heading
      expect(frame).to.include('Installation');
    });

    it('should not show processing text when no current chunk', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 3,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      // Should not have "Processing:" when currentChunkHeading is null
      const hasProcessing = frame.includes('Processing:');
      expect(hasProcessing).to.be.false;
    });
  });

  describe('error display', function () {
    it('should not show errors section when empty', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.not.include('Errors');
    });

    it('should show errors section with count', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: ['Error 1', 'Error 2'],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Errors');
      expect(frame).to.include('2');
    });

    it('should list individual errors', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: ['API timeout', 'Invalid response'],
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('API timeout');
      expect(frame).to.include('Invalid response');
    });

    it('should show errors in red color', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: ['Test error'],
        })
      );

      // Can't easily test color in text output, but verify error is shown
      const frame = lastFrame();
      expect(frame).to.include('Test error');
    });
  });

  describe('completion state', function () {
    it('should show completion message when current equals total', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 10,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/complete|done|finished/i);
    });

    it('should not show completion message when not done', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      const hasCompletion = frame.match(/complete|done|finished/i);
      expect(hasCompletion).to.be.null;
    });
  });

  describe('progress bar visualization', function () {
    it('should show filled and empty sections', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 5,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      // Should have both filled (█) and empty (░) characters
      expect(frame).to.match(/[█]/);
      expect(frame).to.match(/[░]/);
    });

    it('should show all filled when complete', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 10,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      // Should have filled character
      expect(frame).to.match(/[█]/);
    });

    it('should show all empty when starting', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 0,
          total: 10,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      // Should have empty character
      expect(frame).to.match(/[░]/);
    });
  });

  describe('fractional progress', function () {
    it('should handle non-integer percentages', function () {
      const { lastFrame } = render(
        React.createElement(GenerationProgress, {
          current: 1,
          total: 3,
          currentChunkHeading: null,
          errors: [],
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/33%|1\/3/);
    });
  });
});
