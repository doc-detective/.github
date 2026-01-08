/**
 * Tests for ChunkReviewer component - Review and accept/reject generated tests
 */
import React from 'react';
import { render } from 'ink-testing-library';
import crypto from 'crypto';

let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('ChunkReviewer', function () {
  let ChunkReviewer;

  // Helper to create mock review items
  function createMockItem(overrides = {}) {
    return {
      id: crypto.randomUUID(),
      generated: {
        tests: [
          {
            description: 'Generated test',
            steps: [{ goTo: 'https://example.com' }],
          },
        ],
        preservedTests: [],
        chunk: {
          heading: 'Test Section',
          content: '## Test Section\nContent here',
          startLine: 1,
          endLine: 5,
        },
        hasErrors: false,
      },
      status: 'pending',
      regenerationAttempts: 0,
      ...overrides,
    };
  }

  before(async function () {
    const module = await import('../../src/cli/builder/ChunkReviewer.mjs');
    ChunkReviewer = module.default;
  });

  describe('initial rendering (list view)', function () {
    it('should display review header', function () {
      const items = [createMockItem()];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Review Generated Tests');
    });

    it('should show instruction text', function () {
      const items = [createMockItem()];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/select|view|details/i);
    });

    it('should list all review items', function () {
      const items = [
        createMockItem({ generated: { ...createMockItem().generated, chunk: { heading: 'Section 1' } } }),
        createMockItem({ generated: { ...createMockItem().generated, chunk: { heading: 'Section 2' } } }),
      ];

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Section 1');
      expect(frame).to.include('Section 2');
    });
  });

  describe('status icons', function () {
    it('should show pending icon (○) for pending items', function () {
      const items = [createMockItem({ status: 'pending' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('○');
    });

    it('should show accepted icon (✓) for accepted items', function () {
      const items = [createMockItem({ status: 'accepted' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('✓');
    });

    it('should show rejected icon (✗) for rejected items', function () {
      const items = [createMockItem({ status: 'rejected' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('✗');
    });

    it('should show regenerating icon (⟳) for regenerating items', function () {
      const items = [createMockItem({ status: 'regenerating' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('⟳');
    });

    it('should show auto-accepted icon (✓✓) for auto-accepted items', function () {
      const items = [createMockItem({ status: 'auto-accepted' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('✓✓');
    });
  });

  describe('test counts', function () {
    it('should show generated test count', function () {
      const item = createMockItem({
        generated: {
          ...createMockItem().generated,
          tests: [{}, {}, {}], // 3 tests
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/3.*new/i);
    });

    it('should show preserved test count when present', function () {
      const item = createMockItem({
        generated: {
          ...createMockItem().generated,
          tests: [{}],
          preservedTests: [{}, {}], // 2 preserved
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/2.*preserved/i);
    });

    it('should show error indicator when hasErrors is true', function () {
      const item = createMockItem({
        generated: {
          ...createMockItem().generated,
          hasErrors: true,
          errorMessage: 'API failed',
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/error|⚠/i);
    });
  });

  describe('bulk actions', function () {
    it('should show Accept All option when pending items exist', function () {
      const items = [createMockItem({ status: 'pending' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Accept all');
    });

    it('should show Reject All option when pending items exist', function () {
      const items = [createMockItem({ status: 'pending' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Reject all');
    });

    it('should show Continue option when accepted items exist', function () {
      const items = [createMockItem({ status: 'accepted' })];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/continue/i);
    });

    it('should show Cancel option', function () {
      const items = [createMockItem()];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/cancel|←/i);
    });
  });

  describe('separator', function () {
    it('should show separator between items and actions', function () {
      const items = [createMockItem()];
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/─+/);
    });
  });

  describe('empty state', function () {
    it('should handle empty items array', function () {
      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.exist;
    });
  });

  describe('confidence display', function () {
    it('should display confidence percentage in list view', function () {
      const item = createMockItem({
        generated: {
          ...createMockItem().generated,
          confidence: 85,
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('[85%]');
    });

    it('should not show confidence for items with errors', function () {
      const item = createMockItem({
        generated: {
          ...createMockItem().generated,
          hasErrors: true,
          confidence: 0,
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.not.include('[0%]');
      expect(frame).to.include('ERROR');
    });

    it('should include auto-accepted items in continue count', function () {
      const items = [
        createMockItem({ status: 'accepted' }),
        createMockItem({ status: 'auto-accepted' }),
      ];

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items,
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/continue.*2.*test/i);
    });

    it('should default to 0 confidence if not provided', function () {
      const item = createMockItem({
        generated: {
          tests: [],
          preservedTests: [],
          chunk: {
            content: 'test',
            heading: 'Test',
            startLine: 1,
            endLine: 1,
            filePath: '/test',
            type: 'markdown',
            context: {},
          },
          hasErrors: false,
          // No confidence field
        },
      });

      const { lastFrame } = render(
        React.createElement(ChunkReviewer, {
          items: [item],
          onAccept: () => {},
          onRegenerate: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('[0%]');
    });
  });
});
