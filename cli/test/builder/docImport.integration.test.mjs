/**
 * Integration tests for doc-to-test import flow
 * These tests require API keys and test the full workflow
 */
import { parseDocument, generateTestsForChunk } from '../../src/cli/builder/DocAnalyzer.mjs';
import * as fs from 'fs';
import * as path from 'path';

let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

// Only run these tests if API key is available
const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

describe('Doc Import Integration', function () {
  // Increase timeout for AI calls
  this.timeout(60000);

  const sampleDocPath = path.join(process.cwd(), 'test/fixtures/sample-api-guide.md');

  // Skip all tests if no API key
  before(function () {
    if (!hasApiKey) {
      this.skip();
    }
  });

  describe('end-to-end workflow', function () {
    it('should parse markdown document', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const result = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      expect(result).to.have.property('chunks');
      expect(result.chunks).to.be.an('array');
      expect(result.chunks.length).to.be.greaterThan(0);

      // Verify chunk structure
      const firstChunk = result.chunks[0];
      expect(firstChunk).to.have.property('content');
      expect(firstChunk).to.have.property('heading');
      expect(firstChunk).to.have.property('startLine');
      expect(firstChunk).to.have.property('endLine');
      expect(firstChunk).to.have.property('type');
    });

    it('should generate tests for a chunk', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const result = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      // Generate tests for the first chunk
      const firstChunk = result.chunks[0];
      const generated = await generateTestsForChunk({
        chunk: firstChunk,
        existingTests: [],
        config: {},
        attemptNumber: 0,
      });

      expect(generated).to.have.property('tests');
      expect(generated).to.have.property('preservedTests');
      expect(generated).to.have.property('chunk');
      expect(generated).to.have.property('hasErrors');

      // Should have generated at least some tests
      expect(generated.tests).to.be.an('array');

      // If successful, tests should have proper structure
      if (!generated.hasErrors && generated.tests.length > 0) {
        const firstTest = generated.tests[0];
        expect(firstTest).to.have.property('steps');
        expect(firstTest.steps).to.be.an('array');
      }
    });
  });

  describe('hybrid chunking rules', function () {
    it('should apply hybrid rules when enabled', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const withRules = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      const withoutRules = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: false,
      });

      // With hybrid rules, we might have fewer chunks (combined short ones)
      // or the same number if all chunks are already optimal
      expect(withRules.chunks.length).to.be.at.most(withoutRules.chunks.length);
    });
  });

  describe('error handling', function () {
    it('should handle empty document gracefully', async function () {
      const emptyContent = '# Empty Doc\n\nNo content here.';

      const result = await parseDocument({
        filePath: 'test.md',
        content: emptyContent,
        config: {},
        applyHybridRules: true,
      });

      // Should parse but might have very few or no chunks
      expect(result).to.have.property('chunks');
      expect(result.chunks).to.be.an('array');
    });

    it('should handle malformed markdown', async function () {
      const malformedContent = '## Heading\n\n## Another\n\n### Sub';

      const result = await parseDocument({
        filePath: 'test.md',
        content: malformedContent,
        config: {},
        applyHybridRules: true,
      });

      // Should still parse without crashing
      expect(result).to.have.property('chunks');
    });
  });

  describe('test generation quality', function () {
    it('should add sourceLocation metadata to generated tests', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const result = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      const firstChunk = result.chunks[0];
      const generated = await generateTestsForChunk({
        chunk: firstChunk,
        existingTests: [],
        config: {},
        attemptNumber: 0,
      });

      // Check if tests have sourceLocation metadata
      if (!generated.hasErrors && generated.tests.length > 0) {
        const firstTest = generated.tests[0];
        expect(firstTest).to.have.property('sourceLocation');
        expect(firstTest.sourceLocation).to.have.property('file');
        expect(firstTest.sourceLocation).to.have.property('startLine');
        expect(firstTest.sourceLocation).to.have.property('endLine');
      }
    });

    it('should preserve chunk metadata in generated output', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const result = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      const firstChunk = result.chunks[0];
      const generated = await generateTestsForChunk({
        chunk: firstChunk,
        existingTests: [],
        config: {},
        attemptNumber: 0,
      });

      expect(generated.chunk).to.deep.equal(firstChunk);
    });
  });

  describe('multiple format support', function () {
    it('should detect markdown format', async function () {
      const content = '## Heading\n\nContent';

      const result = await parseDocument({
        filePath: 'test.md',
        content,
        config: {},
        applyHybridRules: false,
      });

      expect(result.chunks[0].type).to.equal('markdown');
    });

    // DITA support will be added in future phases
    it.skip('should detect DITA format', async function () {
      const ditaContent = '<?xml version="1.0"?><task></task>';

      const result = await parseDocument({
        filePath: 'test.dita',
        content: ditaContent,
        config: {},
        applyHybridRules: false,
      });

      expect(result.chunks[0].type).to.include('dita');
    });
  });

  describe('regeneration', function () {
    it('should handle regeneration with different attempt numbers', async function () {
      const content = fs.readFileSync(sampleDocPath, 'utf8');

      const result = await parseDocument({
        filePath: sampleDocPath,
        content,
        config: {},
        applyHybridRules: true,
      });

      const firstChunk = result.chunks[0];

      // Generate with attempt 0
      const generated1 = await generateTestsForChunk({
        chunk: firstChunk,
        existingTests: [],
        config: {},
        attemptNumber: 0,
      });

      // Generate with attempt 1 (regeneration)
      const generated2 = await generateTestsForChunk({
        chunk: firstChunk,
        existingTests: [],
        config: {},
        attemptNumber: 1,
      });

      // Both should complete (may or may not have different results)
      expect(generated1).to.have.property('tests');
      expect(generated2).to.have.property('tests');
    });
  });
});
