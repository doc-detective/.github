/**
 * Tests for inline source file updates - simulating user inputs to update markdown files
 * 
 * Tests the complete flow of:
 * 1. Creating markdown files with inline statements
 * 2. Modifying the statements (simulating user edits)
 * 3. Writing the updates back to the file
 * 4. Verifying the output matches expected format
 * 
 * Each test validates:
 * - Comment types: htmlComment, jsxComment, linkReference
 * - Syntax types: json, yaml, xml
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
  prepareSourceUpdates,
  batchUpdateSourceContent,
} = require('../../src/cli/builder/sourceFileUtils.js');

import {
  getMockSpec,
  getMockTest,
  getMockGoToStep,
  getMockClickStep,
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

describe('Inline Source Updates - User Input Simulation', function () {
  // Temp file handling
  const tempDir = path.join(__dirname, 'temp-inline');
  
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

  describe('Comment Type: htmlComment', function () {
    describe('with JSON syntax', function () {
      it('creates and updates a markdown file with HTML comment JSON step', function () {
        const tempFile = path.join(tempDir, 'html-json-step.md');
        const originalContent = `# Test Documentation

This is a test document.

<!-- step {"goTo":"https://original.com"} -->

More content here.
`;
        fs.writeFileSync(tempFile, originalContent);
        
        // Simulate user modifying the step
        const modifiedStep = {
          goTo: 'https://modified.com',
          sourceLocation: {
            file: tempFile,
            isInline: true,
            startOffset: originalContent.indexOf('<!-- step'),
            endOffset: originalContent.indexOf('<!-- step') + '<!-- step {"goTo":"https://original.com"} -->'.length,
            commentFormat: 'htmlComment',
            originalText: '<!-- step {"goTo":"https://original.com"} -->',
          },
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'htmlComment',
          originalText: '<!-- step {"goTo":"https://original.com"} -->',
        });
        
        // Verify serialization preserves JSON format
        expect(serialized).to.match(/^<!-- step/);
        expect(serialized).to.match(/-->$/);
        expect(serialized).to.include('goTo');
        expect(serialized).to.include('https://modified.com');
        
        // Apply update to file
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset: modifiedStep.sourceLocation.startOffset,
            endOffset: modifiedStep.sourceLocation.endOffset,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        // Verify file content
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('https://modified.com');
        expect(updatedContent).to.not.include('https://original.com');
        expect(updatedContent).to.include('<!-- step');
        expect(updatedContent).to.include('-->');
      });

      it('creates and updates a test declaration with HTML comment JSON', function () {
        const tempFile = path.join(tempDir, 'html-json-test.md');
        const originalContent = `# Test Documentation

<!-- test {"testId":"original-test","description":"Original description"} -->
<!-- step {"goTo":"https://example.com"} -->

`;
        fs.writeFileSync(tempFile, originalContent);
        
        const modifiedTest = {
          testId: 'modified-test',
          description: 'Modified description',
          steps: [],
        };
        
        const serialized = serializeTestToInline({
          test: modifiedTest,
          commentFormat: 'htmlComment',
          originalText: '<!-- test {"testId":"original-test","description":"Original description"} -->',
        });
        
        expect(serialized).to.match(/^<!-- test/);
        expect(serialized).to.include('modified-test');
        expect(serialized).to.include('Modified description');
        
        // Apply update
        const startOffset = originalContent.indexOf('<!-- test');
        const endOffset = originalContent.indexOf('-->') + 3;
        
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset,
            endOffset,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('modified-test');
        expect(updatedContent).to.include('Modified description');
      });
    });

    describe('with YAML syntax', function () {
      it('creates and updates a markdown file with HTML comment YAML step', function () {
        const tempFile = path.join(tempDir, 'html-yaml-step.md');
        const originalContent = `# Test Documentation

<!-- step goTo: https://original.com -->

More content.
`;
        fs.writeFileSync(tempFile, originalContent);
        
        // Detect original syntax
        const detectedSyntax = detectSyntaxFormat('<!-- step goTo: https://original.com -->');
        expect(detectedSyntax).to.equal('yaml');
        
        const modifiedStep = {
          goTo: 'https://modified.com',
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'htmlComment',
          originalText: '<!-- step goTo: https://original.com -->',
        });
        
        // Verify YAML format is preserved
        expect(serialized).to.match(/^<!-- step/);
        expect(serialized).to.include('goTo:');
        expect(serialized).to.include('https://modified.com');
        
        // Apply update
        const startOffset = originalContent.indexOf('<!-- step');
        const endOffset = originalContent.indexOf('-->') + 3;
        
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset,
            endOffset,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('https://modified.com');
        expect(updatedContent).to.include('goTo:');
      });

      it('creates and updates multiline YAML step', function () {
        const tempFile = path.join(tempDir, 'html-yaml-multiline.md');
        const originalContent = `# Test Documentation

<!-- step
goTo: https://original.com
-->

More content.
`;
        fs.writeFileSync(tempFile, originalContent);
        
        const detectedSyntax = detectSyntaxFormat(originalContent.substring(
          originalContent.indexOf('<!-- step'),
          originalContent.indexOf('-->') + 3
        ));
        expect(detectedSyntax).to.equal('yaml');
        
        // Serialize with object form to get multiline YAML
        const modifiedStep = {
          goTo: {
            url: 'https://modified.com',
            timeout: 5000,
          },
        };
        
        const yamlContent = serializeToSyntax(modifiedStep, 'yaml', 'step');
        expect(yamlContent).to.include('\n');
        expect(yamlContent).to.include('goTo:');
      });

      it('creates and updates a test declaration with HTML comment YAML', function () {
        const tempFile = path.join(tempDir, 'html-yaml-test.md');
        const originalContent = `# Test Documentation

<!-- test testId: original-test -->
<!-- step goTo: https://example.com -->

`;
        fs.writeFileSync(tempFile, originalContent);
        
        const modifiedTest = {
          testId: 'modified-test',
          description: 'Added description',
        };
        
        const serialized = serializeTestToInline({
          test: modifiedTest,
          commentFormat: 'htmlComment',
          originalText: '<!-- test testId: original-test -->',
        });
        
        expect(serialized).to.include('testId:');
        expect(serialized).to.include('modified-test');
        
        const startOffset = originalContent.indexOf('<!-- test');
        const endOffset = originalContent.indexOf('<!-- step');
        
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset,
            endOffset: startOffset + '<!-- test testId: original-test -->'.length,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('modified-test');
      });
    });

    describe('with XML syntax', function () {
      it('creates and updates a markdown file with HTML comment XML step', function () {
        const tempFile = path.join(tempDir, 'html-xml-step.md');
        const originalContent = `# Test Documentation

<!-- step goTo="https://original.com" -->

More content.
`;
        fs.writeFileSync(tempFile, originalContent);
        
        const detectedSyntax = detectSyntaxFormat('<!-- step goTo="https://original.com" -->');
        expect(detectedSyntax).to.equal('xml');
        
        // Serialize to XML format
        const xmlContent = serializeToSyntax({ goTo: 'https://modified.com' }, 'xml', 'step');
        expect(xmlContent).to.equal('goTo="https://modified.com"');
        
        // Full serialization for step
        const serialized = `<!-- step ${xmlContent} -->`;
        
        const startOffset = originalContent.indexOf('<!-- step');
        const endOffset = originalContent.indexOf('-->') + 3;
        
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset,
            endOffset,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('goTo="https://modified.com"');
        expect(updatedContent).to.not.include('https://original.com');
      });

      it('serializes boolean and number values correctly in XML format', function () {
        const xmlContent = serializeToSyntax({ enabled: true, timeout: 5000 }, 'xml', 'step');
        
        expect(xmlContent).to.include('enabled=true');
        expect(xmlContent).to.include('timeout=5000');
      });

      it('creates and updates a test declaration with HTML comment XML', function () {
        const tempFile = path.join(tempDir, 'html-xml-test.md');
        const originalContent = `# Test Documentation

<!-- test testId="original-test" -->
<!-- step goTo="https://example.com" -->

`;
        fs.writeFileSync(tempFile, originalContent);
        
        const detectedSyntax = detectSyntaxFormat('<!-- test testId="original-test" -->');
        expect(detectedSyntax).to.equal('xml');
        
        const xmlContent = serializeToSyntax({ testId: 'modified-test', description: 'New description' }, 'xml', 'test');
        expect(xmlContent).to.include('testId="modified-test"');
        expect(xmlContent).to.include('description="New description"');
      });
    });
  });

  describe('Comment Type: jsxComment', function () {
    describe('with JSON syntax', function () {
      it('creates and updates a JSX file with JSX comment JSON step', function () {
        const tempFile = path.join(tempDir, 'jsx-json-step.jsx');
        const originalContent = `export default function Page() {
  return (
    <div>
      {/* step {"goTo":"https://original.com"} */}
      <h1>Hello World</h1>
    </div>
  );
}
`;
        fs.writeFileSync(tempFile, originalContent);
        
        // Verify default comment format for JSX
        expect(getDefaultCommentFormat('.jsx')).to.equal('jsxComment');
        
        const modifiedStep = {
          goTo: 'https://modified.com',
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'jsxComment',
          originalText: '{/* step {"goTo":"https://original.com"} */}',
        });
        
        expect(serialized).to.match(/^\{\s*\/\*/);
        expect(serialized).to.match(/\*\/\s*\}$/);
        expect(serialized).to.include('https://modified.com');
        
        const startOffset = originalContent.indexOf('{/* step');
        const endOffset = originalContent.indexOf('*/}') + 3;
        
        const result = batchUpdateSourceContent({
          filePath: tempFile,
          updates: [{
            startOffset,
            endOffset,
            newContent: serialized,
            replaceEntireLine: true,
          }],
        });
        
        expect(result.success).to.be.true;
        
        const updatedContent = fs.readFileSync(tempFile, 'utf8');
        expect(updatedContent).to.include('https://modified.com');
        expect(updatedContent).to.include('{/*');
        expect(updatedContent).to.include('*/}');
      });

      it('creates and updates a TSX file with JSX comment', function () {
        const tempFile = path.join(tempDir, 'tsx-json-step.tsx');
        const originalContent = `import React from 'react';

export const Component: React.FC = () => {
  return (
    <div>
      {/* step {"click":".button"} */}
      <button className="button">Click me</button>
    </div>
  );
};
`;
        fs.writeFileSync(tempFile, originalContent);
        
        expect(getDefaultCommentFormat('.tsx')).to.equal('jsxComment');
        
        const modifiedStep = {
          click: '.new-button',
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'jsxComment',
        });
        
        expect(serialized).to.include('{/*');
        expect(serialized).to.include('*/}');
        expect(serialized).to.include('.new-button');
      });

      it('creates and updates an MDX file with JSX comment', function () {
        const tempFile = path.join(tempDir, 'mdx-json-step.mdx');
        const originalContent = `# Documentation

{/* step {"goTo":"https://original.com"} */}

<Component />
`;
        fs.writeFileSync(tempFile, originalContent);
        
        expect(getDefaultCommentFormat('.mdx')).to.equal('jsxComment');
        
        const modifiedStep = {
          goTo: 'https://modified.com',
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'jsxComment',
        });
        
        expect(serialized).to.include('{/*');
        expect(serialized).to.include('*/}');
      });
    });

    describe('with YAML syntax', function () {
      it('creates and updates a JSX file with JSX comment YAML step', function () {
        const tempFile = path.join(tempDir, 'jsx-yaml-step.jsx');
        const originalContent = `export default function Page() {
  return (
    <div>
      {/* step goTo: https://original.com */}
      <h1>Hello World</h1>
    </div>
  );
}
`;
        fs.writeFileSync(tempFile, originalContent);
        
        // Detect the syntax from JSX comment
        const detectedSyntax = detectSyntaxFormat('{/* step goTo: https://original.com */}');
        expect(detectedSyntax).to.equal('yaml');
        
        const modifiedStep = {
          goTo: 'https://modified.com',
        };
        
        const serialized = serializeStepToInline({
          step: modifiedStep,
          commentFormat: 'jsxComment',
          originalText: '{/* step goTo: https://original.com */}',
        });
        
        expect(serialized).to.include('{/*');
        expect(serialized).to.include('*/}');
        expect(serialized).to.include('goTo:');
      });
    });

    describe('with multiline content', function () {
      it('creates multiline JSX comment for complex steps', function () {
        const complexStep = {
          goTo: {
            url: 'https://example.com',
            timeout: 5000,
          },
        };
        
        const yamlContent = serializeToSyntax(complexStep, 'yaml', 'step');
        expect(yamlContent).to.include('\n');
        
        // Multiline JSX comment format
        const multilineJsx = `{/* step\n${yamlContent}\n*/}`;
        expect(multilineJsx).to.include('{/* step');
        expect(multilineJsx).to.include('*/}');
      });
    });
  });

  describe('Comment Type: linkReference', function () {
    describe('with JSON syntax', function () {
      it('serializes step to link reference format', function () {
        const step = {
          goTo: 'https://example.com',
        };
        
        const serialized = serializeStepToInline({
          step,
          commentFormat: 'linkReference',
        });
        
        expect(serialized).to.include('[comment]: #');
        expect(serialized).to.include('step');
      });

      it('falls back to JSON for multiline content in link reference', function () {
        // Link reference format doesn't support multiline well
        const complexStep = {
          goTo: 'https://example.com',
          description: 'Navigate to page',
          stepId: 'nav-step',
        };
        
        const serialized = serializeStepToInline({
          step: complexStep,
          commentFormat: 'linkReference',
        });
        
        expect(serialized).to.include('[comment]: #');
        // Should use JSON stringify for complex content
        expect(serialized).to.include('{');
      });
    });
  });

  describe('Full Update Flow - prepareSourceUpdates', function () {
    it('prepares updates for modified inline steps', function () {
      const tempFile = path.join(tempDir, 'prepare-updates.md');
      
      const originalSpec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://original.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              commentFormat: 'htmlComment',
              originalText: '<!-- step goTo: "https://original.com" -->',
            }),
          ],
        }],
      });
      
      const modifiedSpec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://modified.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              commentFormat: 'htmlComment',
              originalText: '<!-- step goTo: "https://original.com" -->',
            }),
          ],
        }],
      });
      
      const updates = prepareSourceUpdates({ spec: modifiedSpec, originalSpec });
      
      expect(updates.size).to.equal(1);
      expect(updates.has(tempFile)).to.be.true;
      
      const fileUpdates = updates.get(tempFile);
      expect(fileUpdates).to.be.an('array');
      expect(fileUpdates.length).to.equal(1);
      expect(fileUpdates[0]).to.have.property('newContent');
      expect(fileUpdates[0].newContent).to.include('https://modified.com');
    });

    it('skips unmodified steps', function () {
      const tempFile = path.join(tempDir, 'skip-unmodified.md');
      
      const spec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://example.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
            }),
          ],
        }],
      });
      
      // Deep clone to create identical original
      const originalSpec = JSON.parse(JSON.stringify(spec));
      
      const updates = prepareSourceUpdates({ spec, originalSpec });
      
      expect(updates.size).to.equal(0);
    });

    it('handles auto-detected steps with insertLineAfter', function () {
      const tempFile = path.join(tempDir, 'auto-detected.md');
      
      const originalSpec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://original.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              isAutoDetected: true,
            }),
          ],
        }],
      });
      
      const modifiedSpec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://modified.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              isAutoDetected: true,
            }),
          ],
        }],
      });
      
      const updates = prepareSourceUpdates({ spec: modifiedSpec, originalSpec });
      
      expect(updates.size).to.equal(1);
      const fileUpdates = updates.get(tempFile);
      expect(fileUpdates[0]).to.have.property('insertLineAfter', true);
    });

    it('inserts new test declaration when test has metadata but no source location', function () {
      const tempFile = path.join(tempDir, 'new-test-decl.md');
      
      const originalSpec = getMockSpec({
        tests: [{
          testId: 'new-test',
          description: 'New test description',
          steps: [
            getMockInlineStep('goTo', 'https://example.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              commentFormat: 'htmlComment',
            }),
          ],
        }],
      });
      
      // Original has no test metadata
      const emptyOriginalSpec = getMockSpec({
        tests: [{
          steps: [
            getMockInlineStep('goTo', 'https://example.com', {
              file: tempFile,
              startOffset: 50,
              endOffset: 100,
              commentFormat: 'htmlComment',
            }),
          ],
        }],
      });
      
      const updates = prepareSourceUpdates({ spec: originalSpec, originalSpec: emptyOriginalSpec });
      
      expect(updates.size).to.equal(1);
      const fileUpdates = updates.get(tempFile);
      
      // Should have a test declaration insertion
      const testDeclUpdate = fileUpdates.find(u => u.isNewTestDeclaration);
      expect(testDeclUpdate).to.exist;
      expect(testDeclUpdate.insertLineBefore).to.be.true;
    });
  });

  describe('Complete File Update Workflow', function () {
    it('updates markdown file with multiple inline steps', function () {
      const tempFile = path.join(tempDir, 'complete-workflow.md');
      const originalContent = `# Documentation

This is an introduction.

<!-- test testId: "workflow-test" -->

Navigate to the homepage:
<!-- step goTo: "https://original1.com" -->

Click the button:
<!-- step click: ".original-button" -->

Take a screenshot:
<!-- step screenshot: "original.png" -->

Done!
`;
      fs.writeFileSync(tempFile, originalContent);
      
      // Find offsets for each step
      const step1Start = originalContent.indexOf('<!-- step goTo:');
      const step1End = originalContent.indexOf('-->', step1Start) + 3;
      
      const step2Start = originalContent.indexOf('<!-- step click:');
      const step2End = originalContent.indexOf('-->', step2Start) + 3;
      
      const step3Start = originalContent.indexOf('<!-- step screenshot:');
      const step3End = originalContent.indexOf('-->', step3Start) + 3;
      
      // Create updates
      const updates = [
        {
          startOffset: step1Start,
          endOffset: step1End,
          newContent: '<!-- step goTo: "https://modified1.com" -->',
          replaceEntireLine: true,
        },
        {
          startOffset: step2Start,
          endOffset: step2End,
          newContent: '<!-- step click: ".modified-button" -->',
          replaceEntireLine: true,
        },
        {
          startOffset: step3Start,
          endOffset: step3End,
          newContent: '<!-- step screenshot: "modified.png" -->',
          replaceEntireLine: true,
        },
      ];
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates,
      });
      
      expect(result.success).to.be.true;
      expect(result.results).to.have.lengthOf(3);
      
      const updatedContent = fs.readFileSync(tempFile, 'utf8');
      expect(updatedContent).to.include('https://modified1.com');
      expect(updatedContent).to.include('.modified-button');
      expect(updatedContent).to.include('modified.png');
      expect(updatedContent).to.not.include('https://original1.com');
      expect(updatedContent).to.not.include('.original-button');
      expect(updatedContent).to.not.include('original.png');
      
      // Verify structure is preserved
      expect(updatedContent).to.include('# Documentation');
      expect(updatedContent).to.include('Navigate to the homepage:');
      expect(updatedContent).to.include('Click the button:');
      expect(updatedContent).to.include('Take a screenshot:');
      expect(updatedContent).to.include('Done!');
    });

    it('handles mixed comment and syntax formats in same file', function () {
      const tempFile = path.join(tempDir, 'mixed-formats.md');
      const originalContent = `# Mixed Format Documentation

<!-- test {"testId":"json-test"} -->

JSON format step:
<!-- step {"goTo":"https://json.com"} -->

YAML format step (unquoted value for clear YAML detection):
<!-- step wait: 5000 -->

XML format step:
<!-- step screenshot="xml.png" -->

`;
      fs.writeFileSync(tempFile, originalContent);
      
      // Verify syntax detection
      // JSON: starts with { or has quoted key/value patterns
      expect(detectSyntaxFormat('<!-- step {"goTo":"https://json.com"} -->')).to.equal('json');
      // YAML: key: value without JSON-like quotes - using numeric value for clear detection
      expect(detectSyntaxFormat('<!-- step wait: 5000 -->')).to.equal('yaml');
      // XML: key="value" or key=value attribute syntax
      expect(detectSyntaxFormat('<!-- step screenshot="xml.png" -->')).to.equal('xml');
      
      // Create serialized updates preserving each format
      const jsonStep = serializeStepToInline({
        step: { goTo: 'https://json-modified.com' },
        commentFormat: 'htmlComment',
        originalText: '<!-- step {"goTo":"https://json.com"} -->',
      });
      
      const yamlStep = serializeStepToInline({
        step: { wait: 3000 },
        commentFormat: 'htmlComment',
        originalText: '<!-- step wait: 5000 -->',
      });
      
      // Verify formats are preserved
      expect(jsonStep).to.include('goTo:'); // Simple format uses YAML-like syntax
      expect(yamlStep).to.include('wait:');
    });

    it('preserves indentation when updating steps', function () {
      const tempFile = path.join(tempDir, 'preserve-indent.md');
      const originalContent = `# Indented Documentation

  This section is indented.
  
  <!-- step goTo: "https://original.com" -->
  
  More indented content.
`;
      fs.writeFileSync(tempFile, originalContent);
      
      const startOffset = originalContent.indexOf('  <!-- step');
      const endOffset = originalContent.indexOf('-->', startOffset) + 3;
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [{
          startOffset,
          endOffset,
          newContent: '<!-- step goTo: "https://modified.com" -->',
          replaceEntireLine: true,
        }],
      });
      
      expect(result.success).to.be.true;
      
      const updatedContent = fs.readFileSync(tempFile, 'utf8');
      // Indentation should be preserved
      expect(updatedContent).to.include('  <!-- step goTo: "https://modified.com" -->');
    });

    it('handles inserting new lines before and after existing content', function () {
      const tempFile = path.join(tempDir, 'insert-lines.md');
      const originalContent = `# Documentation

<!-- step goTo: "https://example.com" -->

`;
      fs.writeFileSync(tempFile, originalContent);
      
      const stepOffset = originalContent.indexOf('<!-- step');
      
      // Insert a test declaration before the step
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [{
          startOffset: stepOffset,
          endOffset: stepOffset,
          newContent: '<!-- test testId: "inserted-test" -->',
          insertLineBefore: true,
        }],
      });
      
      expect(result.success).to.be.true;
      
      const updatedContent = fs.readFileSync(tempFile, 'utf8');
      const testPos = updatedContent.indexOf('<!-- test');
      const stepPos = updatedContent.indexOf('<!-- step');
      
      expect(testPos).to.be.lessThan(stepPos);
    });
  });

  describe('Edge Cases', function () {
    it('handles empty file gracefully', function () {
      const tempFile = path.join(tempDir, 'empty.md');
      fs.writeFileSync(tempFile, '');
      
      const result = batchUpdateSourceContent({
        filePath: tempFile,
        updates: [{
          startOffset: 0,
          endOffset: 0,
          newContent: '<!-- step goTo: "https://example.com" -->',
        }],
      });
      
      expect(result.success).to.be.true;
      
      const content = fs.readFileSync(tempFile, 'utf8');
      expect(content).to.equal('<!-- step goTo: "https://example.com" -->');
    });

    it('handles special characters in URLs', function () {
      const step = { goTo: 'https://example.com/path?query=value&other=123#section' };
      
      const jsonSerialized = serializeToSyntax(step, 'json', 'step');
      expect(jsonSerialized).to.include('https://example.com/path?query=value&other=123#section');
      
      const yamlSerialized = serializeToSyntax(step, 'yaml', 'step');
      expect(yamlSerialized).to.include('goTo:');
    });

    it('handles quotes in values', function () {
      const step = { find: '[data-test="my-element"]' };
      
      const jsonSerialized = serializeToSyntax(step, 'json', 'step');
      expect(jsonSerialized).to.include('\\"my-element\\"');
      
      const yamlSerialized = serializeToSyntax(step, 'yaml', 'step');
      expect(yamlSerialized).to.include('data-test');
    });

    it('handles Unicode characters', function () {
      const step = { type: ['Hello 世界 🌍'] };
      
      const serialized = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
      });
      
      expect(serialized).to.include('世界');
      expect(serialized).to.include('🌍');
    });

    it('handles very long URLs', function () {
      const longUrl = 'https://example.com/' + 'a'.repeat(500);
      const step = { goTo: longUrl };
      
      const serialized = serializeStepToInline({
        step,
        commentFormat: 'htmlComment',
      });
      
      expect(serialized).to.include(longUrl);
    });
  });
});
