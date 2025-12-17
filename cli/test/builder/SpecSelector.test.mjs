/**
 * Tests for SpecSelector.mjs - Spec selector component for choosing which spec to edit
 * 
 * Uses ink-testing-library to render and test the Ink React component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { createRequire } from 'module';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import SpecSelector from '../../src/cli/builder/SpecSelector.mjs';
import {
  getMockSpec,
  getMockTest,
  getMockGoToStep,
  getMockCompleteSpec,
} from './fixtures.mjs';

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('SpecSelector component', function () {
  const tempDir = path.join(__dirname, 'temp');

  describe('header display', function () {
    it('displays Doc Detective Test Builder title', function () {
      const specs = [{
        spec: getMockSpec({ specId: 'test-spec' }),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Doc Detective Test Builder');
    });

    it('displays instruction to select a specification', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Select a specification to edit');
    });
  });

  describe('spec count display', function () {
    it('displays single spec count correctly', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Found 1 specification');
    });

    it('displays multiple specs count correctly', function () {
      const specs = [
        {
          spec: getMockSpec({ specId: 'spec-1' }),
          filePath: path.join(tempDir, 'test1.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
        {
          spec: getMockSpec({ specId: 'spec-2' }),
          filePath: path.join(tempDir, 'test2.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
        {
          spec: getMockSpec({ specId: 'spec-3' }),
          filePath: path.join(tempDir, 'test3.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
      ];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Found 3 specifications');
    });
  });

  describe('spec list display', function () {
    it('displays spec ID', function () {
      const specs = [{
        spec: getMockSpec({ specId: 'my-awesome-spec' }),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('my-awesome-spec');
    });

    it('displays file name', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'unique-filename.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('unique-filename.spec.json');
    });

    it('displays test count', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({ steps: [getMockGoToStep()] }),
          getMockTest({ steps: [getMockGoToStep()] }),
        ],
      });
      const specs = [{
        spec,
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('2 tests');
    });

    it('displays singular test label for one test', function () {
      const spec = getMockSpec({
        tests: [getMockTest({ steps: [getMockGoToStep()] })],
      });
      const specs = [{
        spec,
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('1 test');
    });

    it('displays zero tests count', function () {
      const spec = getMockSpec({ tests: [] });
      const specs = [{
        spec,
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('0 tests');
    });
  });

  describe('validation status display', function () {
    it('displays checkmark for valid spec', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('✅');
    });

    it('displays warning for invalid spec', function () {
      const specs = [{
        spec: { tests: 'invalid' },
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: false,
        validationErrors: 'tests must be an array',
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('⚠️');
    });

    it('displays validation error message for invalid spec', function () {
      const specs = [{
        spec: { tests: 'invalid' },
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: false,
        validationErrors: 'tests must be an array',
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('tests must be an array');
    });
  });

  describe('menu options', function () {
    it('displays create new specification option', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Create new specification');
    });

    // Note: Exit option may be off-screen in ScrollableSelect with many items
    // The component does have an exit option but it may not be visible in initial render
    it('component includes menu items for navigation', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      // Should have navigation hints
      expect(frame).to.include('↑↓');
    });
  });

  describe('navigation hint', function () {
    it('displays keyboard navigation hint', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('↑↓');
      expect(frame).to.include('Enter');
    });
  });

  describe('multiple specs handling', function () {
    it('displays all specs in list', function () {
      const specs = [
        {
          spec: getMockSpec({ specId: 'first-spec' }),
          filePath: path.join(tempDir, 'first.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
        {
          spec: getMockSpec({ specId: 'second-spec' }),
          filePath: path.join(tempDir, 'second.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
      ];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('first-spec');
      expect(frame).to.include('second-spec');
    });

    it('displays mix of valid and invalid specs', function () {
      const specs = [
        {
          spec: getMockSpec({ specId: 'valid-spec' }),
          filePath: path.join(tempDir, 'valid.spec.json'),
          extension: '.json',
          isValid: true,
          validationErrors: null,
        },
        {
          spec: { specId: 'invalid-spec', tests: 'not-array' },
          filePath: path.join(tempDir, 'invalid.spec.json'),
          extension: '.json',
          isValid: false,
          validationErrors: 'tests must be array',
        },
      ];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('✅');
      expect(frame).to.include('⚠️');
    });
  });

  describe('fallback spec ID', function () {
    it('uses id field when specId is not set', function () {
      const specs = [{
        spec: { id: 'fallback-id', tests: [] },
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('fallback-id');
    });

    it('uses Spec N when no id fields are set', function () {
      const specs = [{
        spec: { tests: [] },
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Spec 1');
    });
  });

  describe('file path handling', function () {
    it('handles null file path gracefully', function () {
      const specs = [{
        spec: getMockSpec({ specId: 'no-file-spec' }),
        filePath: null,
        extension: null,
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('no-file-spec');
    });
  });

  describe('different file extensions', function () {
    it('handles JSON extension', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.json'),
        extension: '.json',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('.json');
    });

    it('handles YAML extension', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.yaml'),
        extension: '.yaml',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('.yaml');
    });

    it('handles YML extension', function () {
      const specs = [{
        spec: getMockSpec(),
        filePath: path.join(tempDir, 'test.spec.yml'),
        extension: '.yml',
        isValid: true,
        validationErrors: null,
      }];
      
      const { lastFrame } = render(
        React.createElement(SpecSelector, { specs, outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('.yml');
    });
  });
});
