/**
 * Tests for DocAnalyzer module - TDD approach
 */
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('DocAnalyzer', function () {
  let parseDocument, splitMarkdownByHeadings, splitDitaByTopics, generateTestsForChunk;

  before(async function () {
    const module = await import('../../src/cli/builder/DocAnalyzer.mjs');
    parseDocument = module.parseDocument;
    splitMarkdownByHeadings = module.splitMarkdownByHeadings;
    splitDitaByTopics = module.splitDitaByTopics;
    generateTestsForChunk = module.generateTestsForChunk;
  });

  describe('parseDocument', function () {
    const tempDir = path.join(__dirname, 'temp-docanalyzer');

    before(function () {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });

    afterEach(function () {
      // Clean up temp files
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

    it('should read file when content not provided', async function () {
      const filePath = path.join(tempDir, 'test.md');
      const content = '## Heading 1\nContent here\n## Heading 2\nMore content';
      fs.writeFileSync(filePath, content);

      const chunks = await parseDocument({ filePath, config: {} });

      expect(chunks).to.be.an('array');
      expect(chunks.length).to.be.greaterThan(0);
    });

    it('should detect markdown format from .md extension', async function () {
      const content = '## Heading 1\nContent\n## Heading 2\nMore content';
      const chunks = await parseDocument({
        filePath: 'test.md',
        content,
        config: {},
        applyHybridRules: false, // Disable hybrid rules for this test
      });

      expect(chunks).to.be.an('array');
      expect(chunks.length).to.equal(2);
      expect(chunks[0].type).to.equal('markdown');
    });

    it('should detect markdown format from .markdown extension', async function () {
      const content = '## Heading\nContent';
      const chunks = await parseDocument({
        filePath: 'test.markdown',
        content,
        config: {},
      });

      expect(chunks[0].type).to.equal('markdown');
    });

    it('should detect DITA format from .dita extension', async function () {
      const content = '<task><title>Test Task</title><taskbody></taskbody></task>';
      const chunks = await parseDocument({
        filePath: 'test.dita',
        content,
        config: {},
      });

      expect(chunks).to.be.an('array');
      expect(chunks[0].type).to.match(/dita/);
    });

    it('should detect DITA format from .xml extension', async function () {
      const content = '<concept><title>Test</title></concept>';
      const chunks = await parseDocument({
        filePath: 'test.xml',
        content,
        config: {},
      });

      expect(chunks).to.be.an('array');
      expect(chunks[0].type).to.match(/dita/);
    });

    it('should throw error for unsupported format', async function () {
      try {
        await parseDocument({
          filePath: 'test.txt',
          content: 'plain text',
          config: {},
        });
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.include('Unsupported format');
      }
    });

    it('should handle file read errors gracefully', async function () {
      const filePath = path.join(tempDir, 'nonexistent.md');

      try {
        await parseDocument({ filePath, config: {} });
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  describe('splitMarkdownByHeadings', function () {
    it('should split on ## headings', function () {
      const content = `## Heading 1
Content for section 1

## Heading 2
Content for section 2`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      expect(chunks).to.have.length(2);
      expect(chunks[0].heading).to.equal('Heading 1');
      expect(chunks[1].heading).to.equal('Heading 2');
    });

    it('should split on ### headings', function () {
      const content = `### Subheading 1
Content 1

### Subheading 2
Content 2`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      expect(chunks).to.have.length(2);
      expect(chunks[0].heading).to.equal('Subheading 1');
      expect(chunks[1].heading).to.equal('Subheading 2');
    });

    it('should preserve heading hierarchy in context', function () {
      const content = `## Parent Section
Parent content here

### Child Section
Child content here`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      expect(chunks).to.have.length(2);
      expect(chunks[0].heading).to.equal('Parent Section');
      expect(chunks[1].heading).to.equal('Child Section');
      expect(chunks[1].context.parentHeading).to.equal('Parent Section');
    });

    it('should track correct line numbers', function () {
      const content = `Line 1
Line 2
## First Heading
Line 4
Line 5
## Second Heading
Line 7`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      expect(chunks).to.have.length(2);
      expect(chunks[0].startLine).to.equal(3); // 1-based
      expect(chunks[0].endLine).to.equal(5);
      expect(chunks[1].startLine).to.equal(6);
      expect(chunks[1].endLine).to.equal(7);
    });

    it('should include full content between headings', function () {
      const content = `## Heading 1
Line 1
Line 2

Code block here

## Heading 2
Next section`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      expect(chunks[0].content).to.include('Line 1');
      expect(chunks[0].content).to.include('Line 2');
      expect(chunks[0].content).to.include('Code block here');
    });

    it('should not apply hybrid rules by default', function () {
      const content = `## Short 1
A

## Short 2
B

## Normal Section
${'x'.repeat(600)}`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      // Should return all 3 chunks without combining
      expect(chunks.length).to.equal(3);
    });

    it('should not split long sections (done at parseDocument level)', function () {
      const longContent = 'x'.repeat(6000);
      const content = `## Long Section
${longContent}

Another paragraph.`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      // Should return single chunk (splitting is done by hybrid rules)
      expect(chunks.length).to.equal(1);
    });

    it('should handle documents with no ## or ### headings', function () {
      const content = `# Top level heading only
Just plain text
No ## or ### headings here`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      // Should return empty array or single chunk with all content
      expect(chunks).to.be.an('array');
    });

    it('should ignore # (single hash) headings', function () {
      const content = `# Main Title
Some intro text

## Section 1
Content

# Another Main Title
More intro

## Section 2
More content`;

      const chunks = splitMarkdownByHeadings(content, 'test.md');

      // Should only split on ## headings, not #
      const headings = chunks.map((c) => c.heading);
      expect(headings).to.include('Section 1');
      expect(headings).to.include('Section 2');
      expect(headings).to.not.include('Main Title');
    });

    it('should preserve absolute file path', function () {
      const chunks = splitMarkdownByHeadings('## Test\nContent', '/absolute/path/test.md');

      expect(chunks[0].filePath).to.equal(path.resolve('/absolute/path/test.md'));
    });

    it('should set type to "markdown"', function () {
      const chunks = splitMarkdownByHeadings('## Test\nContent', 'test.md');

      expect(chunks[0].type).to.equal('markdown');
    });
  });

  describe('Hybrid Rules (via parseDocument)', function () {
    it('should combine short sections when hybrid rules enabled', async function () {
      const tempDir = path.join(__dirname, 'temp-docanalyzer');
      const filePath = path.join(tempDir, 'short.md');
      const content = `## Short 1
A

## Short 2
B

## Normal Section
${'x'.repeat(600)}`;

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);

      const chunks = await parseDocument({
        filePath,
        config: {},
        applyHybridRules: true,
      });

      // First two short sections should be combined
      expect(chunks.length).to.be.lessThan(3);
      const combinedChunk = chunks.find((c) => c.heading.includes('+'));
      expect(combinedChunk).to.exist;

      // Cleanup
      fs.unlinkSync(filePath);
    });

    it('should split long sections when hybrid rules enabled', async function () {
      const tempDir = path.join(__dirname, 'temp-docanalyzer');
      const filePath = path.join(tempDir, 'long.md');
      const longContent = 'x'.repeat(6000);
      const content = `## Long Section
${longContent}

Another paragraph.`;

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);

      const chunks = await parseDocument({
        filePath,
        config: {},
        applyHybridRules: true,
      });

      // Long section should be split
      expect(chunks.length).to.be.greaterThan(1);

      // Cleanup
      fs.unlinkSync(filePath);
    });

    it('should not apply rules when disabled', async function () {
      const content = `## Short 1
A

## Short 2
B`;

      const chunks = await parseDocument({
        filePath: 'test.md',
        content,
        config: {},
        applyHybridRules: false,
      });

      // Should keep both chunks separate
      expect(chunks.length).to.equal(2);
      expect(chunks[0].heading).to.equal('Short 1');
      expect(chunks[1].heading).to.equal('Short 2');
    });
  });

  describe('splitDitaByTopics', function () {
    it('should return at least one chunk for DITA content', function () {
      const content = '<task><title>Test Task</title><taskbody></taskbody></task>';
      const chunks = splitDitaByTopics(content, 'test.dita');

      expect(chunks).to.be.an('array');
      expect(chunks.length).to.be.greaterThan(0);
    });

    it('should set correct type for DITA chunks', function () {
      const content = '<task><title>Test</title></task>';
      const chunks = splitDitaByTopics(content, 'test.dita');

      expect(chunks[0].type).to.match(/dita/);
    });

    it('should include full content', function () {
      const content = '<task><title>Test Task</title><taskbody><p>Paragraph</p></taskbody></task>';
      const chunks = splitDitaByTopics(content, 'test.dita');

      expect(chunks[0].content).to.equal(content);
    });

    it('should handle empty DITA documents', function () {
      const content = '';
      const chunks = splitDitaByTopics(content, 'test.dita');

      expect(chunks).to.be.an('array');
    });
  });

  describe('generateTestsForChunk', function () {
    this.timeout(30000); // AI calls can be slow

    const mockChunk = {
      content: '## API Testing\n\nNavigate to https://example.com and verify the page loads.',
      heading: 'API Testing',
      startLine: 10,
      endLine: 12,
      filePath: '/test/doc.md',
      type: 'markdown',
      context: {},
    };

    it('should call analyzer with chunk content', async function () {
      // Skip if no API key available
      if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        this.skip();
      }

      const config = {
        integrations: {
          anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        },
      };

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config,
      });

      expect(result).to.be.an('object');
      expect(result.tests).to.be.an('array');
      expect(result.preservedTests).to.be.an('array');
      expect(result.chunk).to.equal(mockChunk);
      expect(result.hasErrors).to.be.a('boolean');
    });

    it('should preserve existing inline tests', async function () {
      const existingTests = [
        {
          testId: 'existing-test',
          description: 'Existing test',
          steps: [],
        },
      ];

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests,
        config: {},
      });

      expect(result.preservedTests).to.deep.equal(existingTests);
    });

    it('should handle API failures gracefully', async function () {
      const invalidConfig = {
        integrations: {
          anthropic: { apiKey: 'invalid-key-123' },
        },
      };

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: invalidConfig,
      });

      expect(result.hasErrors).to.be.true;
      expect(result.errorMessage).to.be.a('string');
      expect(result.tests).to.be.an('array');
    });

    it('should add sourceLocation metadata to generated tests', async function () {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        this.skip();
      }

      const config = {
        integrations: {
          anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        },
      };

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config,
      });

      if (result.tests.length > 0) {
        const test = result.tests[0];
        expect(test.sourceLocation).to.exist;
        expect(test.sourceLocation.file).to.equal(mockChunk.filePath);
        expect(test.sourceLocation.startLine).to.equal(mockChunk.startLine);
        expect(test.sourceLocation.endLine).to.equal(mockChunk.endLine);
        expect(test.sourceLocation.isGenerated).to.be.true;
        expect(test.sourceLocation.generatedFrom).to.equal('doc-import');
      }
    });

    it('should include parent context in AI prompt', async function () {
      const chunkWithContext = {
        ...mockChunk,
        context: {
          parentHeading: 'Getting Started',
        },
      };

      // We can't easily test the prompt content without mocking,
      // but we can verify the function accepts context
      const result = await generateTestsForChunk({
        chunk: chunkWithContext,
        existingTests: [],
        config: {},
      });

      expect(result).to.exist;
    });

    it('should handle regeneration attempts', async function () {
      const result1 = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: {},
        attemptNumber: 0,
      });

      const result2 = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: {},
        attemptNumber: 1,
      });

      // Both should complete without error (even if API fails)
      expect(result1).to.exist;
      expect(result2).to.exist;
    });

    it('should return empty tests array on failure', async function () {
      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: { integrations: {} }, // No API key
      });

      expect(result.tests).to.be.an('array');
      expect(result.hasErrors).to.be.true;
    });

    it('should preserve chunk reference in result', function () {
      const result = generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: {},
      });

      return result.then((res) => {
        expect(res.chunk).to.equal(mockChunk);
      });
    });

    it('should return confidence score in result', async function () {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        this.skip();
      }

      const config = {
        integrations: {
          anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        },
      };

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config,
      });

      expect(result).to.have.property('confidence');
      expect(result.confidence).to.be.a('number');
      expect(result.confidence).to.be.at.least(0);
      expect(result.confidence).to.be.at.most(100);
    });

    it('should return 0 confidence on failure', async function () {
      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config: { integrations: {} }, // No API key
      });

      expect(result.confidence).to.equal(0);
      expect(result.hasErrors).to.be.true;
    });

    it('should default to 70% confidence for successful generation', async function () {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        this.skip();
      }

      const config = {
        integrations: {
          anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        },
      };

      const result = await generateTestsForChunk({
        chunk: mockChunk,
        existingTests: [],
        config,
      });

      // Should have a confidence score (default 70% or parsed from response)
      if (!result.hasErrors) {
        expect(result.confidence).to.be.at.least(60); // Should be reasonable
      }
    });
  });
});
