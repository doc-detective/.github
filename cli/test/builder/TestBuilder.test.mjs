/**
 * Tests for TestBuilder.mjs - Main test builder orchestrator component
 * 
 * Uses ink-testing-library to render and test the Ink React component.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import TestBuilder from '../../src/cli/builder/TestBuilder.mjs';
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

describe('TestBuilder component', function () {
  // Temp file handling for save tests
  const tempDir = path.join(__dirname, 'temp');
  
  before(function () {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  afterEach(function () {
    // Clean up temp files after each test
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  });
  
  after(function () {
    // Remove temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  describe('initial rendering', function () {
    it('shows spec name input when no initial spec provided', function () {
      const { lastFrame } = render(
        React.createElement(TestBuilder, { outputDir: tempDir })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Doc Detective Test Builder');
      expect(frame).to.include('Spec name');
    });

    it('shows menu when initial spec is provided', function () {
      const spec = getMockCompleteSpec({ testCount: 1, stepsPerTest: 2 });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Test Builder');
    });

    it('displays spec properties section', function () {
      const spec = getMockSpec({ specId: 'my-spec', description: 'My description' });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Spec Properties');
    });

    it('displays tests section', function () {
      const spec = getMockCompleteSpec({ testCount: 2, stepsPerTest: 1 });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Tests');
      expect(frame).to.include('(2)');
    });
  });

  describe('validation display', function () {
    it('shows validation warning for invalid spec', function () {
      const invalidSpec = { tests: 'not an array' };
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: invalidSpec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          isValid: false,
          validationErrors: 'tests must be an array',
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Validation Warning');
    });

    it('shows save disabled message when no tests', function () {
      const spec = getMockSpec(); // Empty tests array
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add at least one test');
    });
  });

  describe('menu items', function () {
    it('shows Add property option', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add property');
    });

    it('shows Add test option', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Add test');
    });

    it('shows Preview option', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Preview');
    });

    it('shows Exit option', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Exit');
    });

    it('shows Debug option when tests have steps', function () {
      const spec = getMockCompleteSpec({ testCount: 1, stepsPerTest: 2 });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('debug');
    });

    it('shows Save option when spec is valid with tests', function () {
      const spec = getMockCompleteSpec({ testCount: 1, stepsPerTest: 1 });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Save');
    });
  });

  describe('output path display', function () {
    it('displays JSON output path for JSON input', function () {
      const spec = getMockSpec();
      const inputPath = path.join(tempDir, 'test.spec.json');
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: inputPath,
          inputFileExtension: '.json',
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('.json');
      expect(frame).to.include('JSON');
    });

    it('displays YAML output path for YAML input', function () {
      const spec = getMockSpec();
      const inputPath = path.join(tempDir, 'test.spec.yaml');
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: inputPath,
          inputFileExtension: '.yaml',
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('.yaml');
      expect(frame).to.include('YAML');
    });
  });

  describe('back button behavior', function () {
    it('shows back option when onBack callback provided', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
          onBack: () => {},
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Back to spec list');
    });

    it('does not show back option when onBack not provided', function () {
      const spec = getMockSpec();
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.not.include('Back to spec list');
    });
  });

  describe('status bar', function () {
    it('displays spec name in status bar', function () {
      const spec = getMockSpec({ specId: 'my-test-spec' });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'my-test-spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('my-test-spec');
    });
  });

  describe('test list display', function () {
    it('displays test descriptions in menu', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({ testId: 'test-1', description: 'First test description', steps: [] }),
          getMockTest({ testId: 'test-2', description: 'Second test description', steps: [] }),
        ],
      });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('First test');
      expect(frame).to.include('Second test');
    });

    it('displays step count for each test', function () {
      const spec = getMockCompleteSpec({ testCount: 1, stepsPerTest: 3 });
      const { lastFrame } = render(
        React.createElement(TestBuilder, {
          initialSpec: spec,
          inputFilePath: path.join(tempDir, 'test.spec.json'),
          outputDir: tempDir,
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('3 steps');
    });
  });
});
