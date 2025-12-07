/**
 * Tests for sourceFileUtils.js - Source file update utilities for inline test editing
 * 
 * Tests serialization, syntax detection, and file update operations.
 */

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  serializeStepToInline,
  serializeTestToInline,
  detectSyntaxFormat,
  serializeToSyntax,
  getDefaultCommentFormat,
  canSerializeAsSimple,
  hasTestMetadata,
  getFileContentHash,
  findLineStart,
  findLineEnd,
  getLineIndentation,
  hasSourceFileChanged,
  updateSourceContent,
  insertSourceContent,
  batchUpdateSourceContent,
  hasInlineSourceLocations,
  getInlineSourceFiles,
  isAutoDetectedStep,
  prepareSourceUpdates,
  hasAutoDetectedSteps,
} = require('../../src/cli/builder/sourceFileUtils.js');

import {
  getMockSpec,
  getMockTest,
  getMockStep,
  getMockGoToStep,
  getMockSourceLocation,
  getMockInlineStep,
} from './fixtures.mjs';

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('sourceFileUtils', function () {
  // Temp file handling
  const tempDir = path.join(__dirname, 'temp');
  
  before(function () {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  afterEach(function () {
    // Clean up temp files after each test
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
  });
  
  after(function () {
    // Remove temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  describe('detectSyntaxFormat', function () {
    it('detects JSON format from object syntax', function () {
      const result = detectSyntaxFormat('<!-- step {"goTo": "https://example.com"} -->');
      
      expect(result).to.equal('json');
    });

    it('detects YAML format from key: value syntax', function () {
      const result = detectSyntaxFormat('<!-- step goTo: https://example.com -->');
      
      expect(result).to.equal('yaml');
    });

    it('detects XML format from attribute syntax', function () {
      const result = detectSyntaxFormat('<!-- step goTo="https://example.com" -->');
      
      expect(result).to.equal('xml');
    });

    it('returns null for empty input', function () {
      const result = detectSyntaxFormat('');
      
      expect(result).to.be.null;
    });

    it('returns null for undefined input', function () {
      const result = detectSyntaxFormat(undefined);
      
      expect(result).to.be.null;
    });

    it('handles JSX comment format', function () {
      const result = detectSyntaxFormat('{/* step {"goTo": "url"} */}');
      
      expect(result).to.equal('json');
    });

    it('handles multiline YAML format', function () {
      const result = detectSyntaxFormat('<!-- step\ngoTo: https://example.com\ntimeout: 5000\n-->');
      
      expect(result).to.equal('yaml');
    });
  });

  describe('serializeToSyntax', function () {
    it('serializes to JSON format', function () {
      const obj = { goTo: 'https://example.com' };
      const result = serializeToSyntax(obj, 'json', 'step');
      
      expect(result).to.equal('{"goTo":"https://example.com"}');
    });

    it('serializes to YAML format', function () {
      const obj = { goTo: 'https://example.com' };
      const result = serializeToSyntax(obj, 'yaml', 'step');
      
      expect(result).to.include('goTo:');
    });

    it('serializes to XML format', function () {
      const obj = { goTo: 'https://example.com' };
      const result = serializeToSyntax(obj, 'xml', 'step');
      
      expect(result).to.include('goTo="https://example.com"');
    });

    it('handles boolean values in XML format', function () {
      const obj = { enabled: true };
      const result = serializeToSyntax(obj, 'xml', 'step');
      
      expect(result).to.include('enabled=true');
    });

    it('handles number values in XML format', function () {
      const obj = { timeout: 5000 };
      const result = serializeToSyntax(obj, 'xml', 'step');
      
      expect(result).to.include('timeout=5000');
    });
  });

  describe('getDefaultCommentFormat', function () {
    it('returns htmlComment for .md files', function () {
      expect(getDefaultCommentFormat('.md')).to.equal('htmlComment');
    });

    it('returns htmlComment for .html files', function () {
      expect(getDefaultCommentFormat('.html')).to.equal('htmlComment');
    });

    it('returns jsxComment for .jsx files', function () {
      expect(getDefaultCommentFormat('.jsx')).to.equal('jsxComment');
    });

    it('returns jsxComment for .tsx files', function () {
      expect(getDefaultCommentFormat('.tsx')).to.equal('jsxComment');
    });

    it('returns jsxComment for .mdx files', function () {
      expect(getDefaultCommentFormat('.mdx')).to.equal('jsxComment');
    });

    it('returns htmlComment for unknown extensions', function () {
      expect(getDefaultCommentFormat('.unknown')).to.equal('htmlComment');
    });

    it('handles null/undefined extension', function () {
      expect(getDefaultCommentFormat(null)).to.equal('htmlComment');
      expect(getDefaultCommentFormat(undefined)).to.equal('htmlComment');
    });
  });

  describe('serializeStepToInline', function () {
    it('serializes simple goTo step to HTML comment', function () {
      const step = getMockGoToStep('https://example.com');
      const result = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.match(/^<!-- step/);
      expect(result).to.match(/-->$/);
      expect(result).to.include('goTo');
      expect(result).to.include('https://example.com');
    });

    it('serializes step to JSX comment format', function () {
      const step = getMockGoToStep('https://example.com');
      const result = serializeStepToInline({
        step,
        commentFormat: 'jsxComment',
      });
      
      expect(result).to.match(/^\{\s*\/\*/);
      expect(result).to.match(/\*\/\s*\}$/);
    });

    it('removes sourceLocation from serialized output', function () {
      const step = getMockInlineStep('goTo', 'https://example.com');
      const result = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.not.include('sourceLocation');
    });

    it('uses simple format for simple steps', function () {
      const step = { goTo: 'https://example.com' };
      const result = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.include('goTo:');
    });

    it('preserves original syntax format when available', function () {
      const step = { goTo: 'https://example.com' };
      const result = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
        originalText: '<!-- step goTo: "https://old.com" -->',
      });
      
      // Should detect YAML format from original and use it
      expect(result).to.include('goTo:');
    });
  });

  describe('serializeTestToInline', function () {
    it('serializes test declaration to HTML comment', function () {
      const test = getMockTest({ testId: 'my-test', description: 'Test description' });
      const result = serializeTestToInline({
        test,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.match(/^<!-- test/);
      expect(result).to.match(/-->$/);
    });

    it('includes testId in serialized output', function () {
      const test = getMockTest({ testId: 'my-test' });
      const result = serializeTestToInline({
        test,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.include('testId');
      expect(result).to.include('my-test');
    });

    it('includes description in serialized output', function () {
      const test = getMockTest({ description: 'My test description' });
      const result = serializeTestToInline({
        test,
        commentFormat: 'htmlComment',
      });
      
      expect(result).to.include('description');
    });
  });

  describe('canSerializeAsSimple', function () {
    it('returns true for step with only action', function () {
      const step = { goTo: 'https://example.com' };
      
      expect(canSerializeAsSimple(step, 'goTo')).to.be.true;
    });

    it('returns false for step with additional properties', function () {
      const step = { goTo: 'https://example.com', description: 'Navigate' };
      
      expect(canSerializeAsSimple(step, 'goTo')).to.be.false;
    });

    it('returns false for step with object action value', function () {
      const step = { goTo: { url: 'https://example.com', timeout: 5000 } };
      
      expect(canSerializeAsSimple(step, 'goTo')).to.be.false;
    });

    it('returns true for boolean action value', function () {
      const step = { wait: true };
      
      expect(canSerializeAsSimple(step, 'wait')).to.be.true;
    });

    it('returns true for numeric action value', function () {
      const step = { wait: 5000 };
      
      expect(canSerializeAsSimple(step, 'wait')).to.be.true;
    });
  });

  describe('hasTestMetadata', function () {
    it('returns true for test with testId', function () {
      const test = { testId: 'my-test', steps: [] };
      
      expect(hasTestMetadata(test)).to.be.true;
    });

    it('returns true for test with description', function () {
      const test = { description: 'My test', steps: [] };
      
      expect(hasTestMetadata(test)).to.be.true;
    });

    it('returns false for test with only steps', function () {
      const test = { steps: [{ goTo: 'https://example.com' }] };
      
      expect(hasTestMetadata(test)).to.be.false;
    });

    it('returns false for null/undefined', function () {
      expect(hasTestMetadata(null)).to.be.false;
      expect(hasTestMetadata(undefined)).to.be.false;
    });
  });

  describe('getFileContentHash', function () {
    it('returns hash for existing file', function () {
      const tempFile = path.join(tempDir, 'hash-test.txt');
      fs.writeFileSync(tempFile, 'test content');
      
      const hash = getFileContentHash(tempFile);
      
      expect(hash).to.be.a('string');
      expect(hash).to.have.lengthOf(32); // MD5 hex length
    });

    it('returns null for non-existent file', function () {
      const hash = getFileContentHash('/non/existent/file.txt');
      
      expect(hash).to.be.null;
    });

    it('returns consistent hash for same content', function () {
      const tempFile = path.join(tempDir, 'hash-consistent.txt');
      fs.writeFileSync(tempFile, 'consistent content');
      
      const hash1 = getFileContentHash(tempFile);
      const hash2 = getFileContentHash(tempFile);
      
      expect(hash1).to.equal(hash2);
    });

    it('returns different hash for different content', function () {
      const tempFile1 = path.join(tempDir, 'hash-diff1.txt');
      const tempFile2 = path.join(tempDir, 'hash-diff2.txt');
      fs.writeFileSync(tempFile1, 'content 1');
      fs.writeFileSync(tempFile2, 'content 2');
      
      const hash1 = getFileContentHash(tempFile1);
      const hash2 = getFileContentHash(tempFile2);
      
      expect(hash1).to.not.equal(hash2);
    });
  });

  describe('findLineStart', function () {
    it('finds start of first line', function () {
      const content = 'first line\nsecond line';
      
      expect(findLineStart(content, 5)).to.equal(0);
    });

    it('finds start of second line', function () {
      const content = 'first line\nsecond line';
      
      expect(findLineStart(content, 15)).to.equal(11);
    });

    it('handles offset at start of file', function () {
      const content = 'line content';
      
      expect(findLineStart(content, 0)).to.equal(0);
    });
  });

  describe('findLineEnd', function () {
    it('finds end of first line', function () {
      const content = 'first line\nsecond line';
      
      expect(findLineEnd(content, 5)).to.equal(11); // After newline
    });

    it('finds end of last line', function () {
      const content = 'first line\nsecond line';
      
      expect(findLineEnd(content, 15)).to.equal(22); // End of content
    });
  });

  describe('getLineIndentation', function () {
    it('returns spaces for space-indented line', function () {
      const content = '    indented line';
      
      expect(getLineIndentation(content, 0)).to.equal('    ');
    });

    it('returns tabs for tab-indented line', function () {
      const content = '\t\tindented line';
      
      expect(getLineIndentation(content, 0)).to.equal('\t\t');
    });

    it('returns empty string for non-indented line', function () {
      const content = 'not indented';
      
      expect(getLineIndentation(content, 0)).to.equal('');
    });
  });

  describe('hasSourceFileChanged', function () {
    it('returns false when file has not changed', function () {
      const tempFile = path.join(tempDir, 'unchanged.txt');
      fs.writeFileSync(tempFile, 'original content');
      
      const hash = getFileContentHash(tempFile);
      
      expect(hasSourceFileChanged(tempFile, hash)).to.be.false;
    });

    it('returns true when file has changed', function () {
      const tempFile = path.join(tempDir, 'changed.txt');
      fs.writeFileSync(tempFile, 'original content');
      
      const hash = getFileContentHash(tempFile);
      fs.writeFileSync(tempFile, 'modified content');
      
      expect(hasSourceFileChanged(tempFile, hash)).to.be.true;
    });

    it('returns true for non-existent file', function () {
      expect(hasSourceFileChanged('/non/existent/file.txt', 'somehash')).to.be.true;
    });
  });

  describe('updateSourceContent', function () {
    it('replaces content at specified offsets', function () {
      const tempFile = path.join(tempDir, 'update-test.txt');
      fs.writeFileSync(tempFile, 'Hello World');
      
      const result = updateSourceContent({
        filePath: tempFile,
        startOffset: 6,
        endOffset: 11,
        newContent: 'Universe',
      });
      
      expect(result.success).to.be.true;
      expect(fs.readFileSync(tempFile, 'utf8')).to.equal('Hello Universe');
    });

    it('returns offset delta', function () {
      const tempFile = path.join(tempDir, 'delta-test.txt');
      fs.writeFileSync(tempFile, 'short');
      
      const result = updateSourceContent({
        filePath: tempFile,
        startOffset: 0,
        endOffset: 5,
        newContent: 'much longer text',
      });
      
      expect(result.success).to.be.true;
      expect(result.offsetDelta).to.equal(11); // 16 - 5
    });

    it('returns error for invalid offsets', function () {
      const tempFile = path.join(tempDir, 'invalid-offset.txt');
      fs.writeFileSync(tempFile, 'content');
      
      const result = updateSourceContent({
        filePath: tempFile,
        startOffset: 100,
        endOffset: 200,
        newContent: 'new',
      });
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid offsets');
    });

    it('returns error for non-existent file', function () {
      const result = updateSourceContent({
        filePath: '/non/existent/file.txt',
        startOffset: 0,
        endOffset: 5,
        newContent: 'new',
      });
      
      expect(result.success).to.be.false;
    });
  });

  describe('batchUpdateSourceContent', function () {
    it('applies multiple updates in correct order', function () {
      const tempFile = path.join(tempDir, 'batch-test.txt');
      fs.writeFileSync(tempFile, 'line1\nline2\nline3');
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [
          { startOffset: 0, endOffset: 5, newContent: 'first' },
          { startOffset: 12, endOffset: 17, newContent: 'third' },
        ],
      });
      
      expect(result.success).to.be.true;
      expect(fs.readFileSync(tempFile, 'utf8')).to.equal('first\nline2\nthird');
    });

    it('handles replaceEntireLine option', function () {
      const tempFile = path.join(tempDir, 'replace-line.txt');
      fs.writeFileSync(tempFile, '  indented line\nnext line');
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [
          { startOffset: 2, endOffset: 15, newContent: 'new content', replaceEntireLine: true },
        ],
      });
      
      expect(result.success).to.be.true;
      const content = fs.readFileSync(tempFile, 'utf8');
      expect(content).to.include('new content');
      expect(content).to.include('next line');
    });

    it('handles insertLineBefore option', function () {
      const tempFile = path.join(tempDir, 'insert-before.txt');
      fs.writeFileSync(tempFile, '  existing line\n');
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [
          { startOffset: 2, endOffset: 2, newContent: 'inserted line', insertLineBefore: true },
        ],
      });
      
      expect(result.success).to.be.true;
      const content = fs.readFileSync(tempFile, 'utf8');
      expect(content.indexOf('inserted line')).to.be.lessThan(content.indexOf('existing line'));
    });

    it('handles insertLineAfter option', function () {
      const tempFile = path.join(tempDir, 'insert-after.txt');
      fs.writeFileSync(tempFile, 'existing line\n');
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [
          { startOffset: 0, endOffset: 13, newContent: 'inserted line', insertLineAfter: true },
        ],
      });
      
      expect(result.success).to.be.true;
      const content = fs.readFileSync(tempFile, 'utf8');
      expect(content.indexOf('existing line')).to.be.lessThan(content.indexOf('inserted line'));
    });

    it('returns success for empty updates array', function () {
      const result = batchUpdateSourceContent({
        filePath: '/any/path.txt',
        updates: [],
      });
      
      expect(result.success).to.be.true;
      expect(result.results).to.deep.equal([]);
    });
  });

  describe('hasInlineSourceLocations', function () {
    it('returns false for spec without inline sources', function () {
      const spec = getMockSpec({
        tests: [getMockTest({ steps: [getMockGoToStep()] })],
      });
      
      expect(hasInlineSourceLocations(spec)).to.be.false;
    });

    it('returns true for spec with inline step sources', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({
            steps: [getMockInlineStep('goTo', 'https://example.com')],
          }),
        ],
      });
      
      expect(hasInlineSourceLocations(spec)).to.be.true;
    });

    it('returns true for spec with inline test sources', function () {
      const spec = getMockSpec({
        tests: [
          {
            ...getMockTest(),
            sourceLocation: getMockSourceLocation(),
          },
        ],
      });
      
      expect(hasInlineSourceLocations(spec)).to.be.true;
    });

    it('returns false for null/undefined spec', function () {
      expect(hasInlineSourceLocations(null)).to.be.false;
      expect(hasInlineSourceLocations(undefined)).to.be.false;
    });
  });

  describe('getInlineSourceFiles', function () {
    it('returns empty set for spec without inline sources', function () {
      const spec = getMockSpec();
      const files = getInlineSourceFiles(spec);
      
      expect(files.size).to.equal(0);
    });

    it('returns unique file paths from inline sources', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({
            steps: [
              getMockInlineStep('goTo', 'url1', { file: '/path/to/file1.md' }),
              getMockInlineStep('click', '.btn', { file: '/path/to/file1.md' }),
              getMockInlineStep('find', '.elem', { file: '/path/to/file2.md' }),
            ],
          }),
        ],
      });
      
      const files = getInlineSourceFiles(spec);
      
      expect(files.size).to.equal(2);
      expect(files.has('/path/to/file1.md')).to.be.true;
      expect(files.has('/path/to/file2.md')).to.be.true;
    });
  });

  describe('isAutoDetectedStep', function () {
    it('returns true for auto-detected step', function () {
      const step = getMockInlineStep('goTo', 'url', { isAutoDetected: true });
      
      expect(isAutoDetectedStep(step)).to.be.true;
    });

    it('returns false for explicit inline step', function () {
      const step = getMockInlineStep('goTo', 'url', { isAutoDetected: false });
      
      expect(isAutoDetectedStep(step)).to.be.false;
    });

    it('returns false for step without sourceLocation', function () {
      const step = getMockGoToStep();
      
      expect(isAutoDetectedStep(step)).to.be.false;
    });
  });

  describe('hasAutoDetectedSteps', function () {
    it('returns true for spec with auto-detected steps', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({
            steps: [getMockInlineStep('goTo', 'url', { isAutoDetected: true })],
          }),
        ],
      });
      
      expect(hasAutoDetectedSteps(spec)).to.be.true;
    });

    it('returns false for spec without auto-detected steps', function () {
      const spec = getMockSpec({
        tests: [
          getMockTest({
            steps: [getMockGoToStep()],
          }),
        ],
      });
      
      expect(hasAutoDetectedSteps(spec)).to.be.false;
    });
  });

  describe('prepareSourceUpdates', function () {
    it('returns empty map for spec without inline sources', function () {
      const spec = getMockSpec({
        tests: [getMockTest({ steps: [getMockGoToStep()] })],
      });
      
      const updates = prepareSourceUpdates({ spec, originalSpec: spec });
      
      expect(updates.size).to.equal(0);
    });

    it('includes updates for modified inline steps', function () {
      const originalSpec = getMockSpec({
        tests: [
          getMockTest({
            steps: [
              getMockInlineStep('goTo', 'https://old.com', {
                file: '/path/to/file.md',
                startOffset: 0,
                endOffset: 50,
              }),
            ],
          }),
        ],
      });
      
      const modifiedSpec = getMockSpec({
        tests: [
          getMockTest({
            steps: [
              getMockInlineStep('goTo', 'https://new.com', {
                file: '/path/to/file.md',
                startOffset: 0,
                endOffset: 50,
              }),
            ],
          }),
        ],
      });
      
      const updates = prepareSourceUpdates({ spec: modifiedSpec, originalSpec });
      
      expect(updates.size).to.equal(1);
      expect(updates.has('/path/to/file.md')).to.be.true;
    });

    it('skips unmodified inline steps', function () {
      // Use test without metadata (testId/description) to avoid triggering test declaration insertion
      const originalSpec = getMockSpec({
        tests: [
          {
            steps: [
              getMockInlineStep('goTo', 'https://example.com', {
                file: '/path/to/file.md',
                startOffset: 0,
                endOffset: 50,
              }),
            ],
          },
        ],
      });
      
      // Create a deep clone with identical content
      const spec = JSON.parse(JSON.stringify(originalSpec));
      
      // Same content as original - no modifications
      const updates = prepareSourceUpdates({ spec, originalSpec });
      
      expect(updates.size).to.equal(0);
    });

    it('handles auto-detected steps with insertLineAfter', function () {
      // Use test without metadata (testId/description) to avoid triggering test declaration insertion
      const originalSpec = getMockSpec({
        tests: [
          {
            steps: [
              getMockInlineStep('goTo', 'https://old.com', {
                file: '/path/to/file.md',
                startOffset: 0,
                endOffset: 50,
                isAutoDetected: true,
              }),
            ],
          },
        ],
      });
      
      const modifiedSpec = getMockSpec({
        tests: [
          {
            steps: [
              getMockInlineStep('goTo', 'https://new.com', {
                file: '/path/to/file.md',
                startOffset: 0,
                endOffset: 50,
                isAutoDetected: true,
              }),
            ],
          },
        ],
      });
      
      const updates = prepareSourceUpdates({ spec: modifiedSpec, originalSpec });
      
      expect(updates.size).to.equal(1);
      const fileUpdates = updates.get('/path/to/file.md');
      expect(fileUpdates).to.be.an('array');
      expect(fileUpdates.length).to.be.greaterThan(0);
      expect(fileUpdates[0]).to.have.property('insertLineAfter', true);
    });
  });
});
