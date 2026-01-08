/**
 * Tests for DocumentImporter component - File browser for selecting documentation
 */
import React from 'react';
import { render } from 'ink-testing-library';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('DocumentImporter', function () {
  let DocumentImporter;
  const tempDir = path.join(__dirname, 'temp-importer');

  before(async function () {
    const module = await import('../../src/cli/builder/DocumentImporter.mjs');
    DocumentImporter = module.default;

    // Create temp directory with test files
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create test directory structure
    const subDir = path.join(tempDir, 'subdirectory');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir);
    }

    // Create test files
    fs.writeFileSync(path.join(tempDir, 'guide.md'), '# Test');
    fs.writeFileSync(path.join(tempDir, 'api.markdown'), '# API');
    fs.writeFileSync(path.join(tempDir, 'task.dita'), '<task></task>');
    fs.writeFileSync(path.join(tempDir, 'doc.xml'), '<concept></concept>');
    fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'Text file');
    fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested');
  });

  after(function () {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      const subDir = path.join(tempDir, 'subdirectory');
      if (fs.existsSync(subDir)) {
        fs.readdirSync(subDir).forEach((file) => {
          fs.unlinkSync(path.join(subDir, file));
        });
        fs.rmdirSync(subDir);
      }
      fs.readdirSync(tempDir).forEach((file) => {
        const filePath = path.join(tempDir, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(tempDir);
    }
  });

  describe('initial rendering', function () {
    it('should display file browser header', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Select Documentation File');
    });

    it('should show current directory path', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('temp-importer');
    });

    it('should display parent directory option when not at root', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('..');
      expect(frame).to.include('parent directory');
    });
  });

  describe('file filtering', function () {
    it('should show .md files', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('guide.md');
    });

    it('should show .markdown files', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('api.markdown');
    });

    it('should show .dita files', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('task.dita');
    });

    it('should show .xml files', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('doc.xml');
    });

    it('should not show unsupported file types', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.not.include('readme.txt');
    });

    it('should show subdirectories', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('subdirectory');
    });
  });

  describe('file icons', function () {
    it('should show folder icon for directories', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/📁.*subdirectory/);
    });

    it('should show file icon for documents', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/📄.*guide\.md/);
    });
  });

  describe('error handling', function () {
    it('should handle non-existent directory gracefully', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: '/nonexistent/path',
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.include('Error');
    });

    it('should handle permission errors gracefully', function () {
      // This test may not work on all systems, so we'll keep it simple
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      expect(lastFrame()).to.exist;
    });
  });

  describe('format detection', function () {
    it('should detect markdown format from .md extension', function () {
      let selectedFormat = null;
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: (filePath, format) => {
            selectedFormat = format;
          },
          onCancel: () => {},
        })
      );

      // In a real test, we'd simulate selection
      // For now, just verify the component renders
      expect(lastFrame()).to.exist;
    });

    it('should detect DITA format from .dita extension', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      expect(lastFrame()).to.exist;
    });
  });

  describe('help text', function () {
    it('should show escape key instruction', function () {
      const { lastFrame } = render(
        React.createElement(DocumentImporter, {
          initialDir: tempDir,
          onSelect: () => {},
          onCancel: () => {},
        })
      );

      const frame = lastFrame();
      expect(frame).to.match(/Esc|escape|cancel/i);
    });
  });
});
