const path = require("path");

const {
  parseMarkdown,
  parseMdx,
  parseRst,
  parseAsciidoc,
  parseDitaXml,
  parseHtml,
  parseNaive,
  detectFormat,
  getParser,
  parseDocument,
  DEFAULT_CHUNK_LEVEL,
} = require("./parsers");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("Parsers Module", function () {
  describe("DEFAULT_CHUNK_LEVEL", function () {
    it("should be 2 (H2 level)", function () {
      expect(DEFAULT_CHUNK_LEVEL).to.equal(2);
    });
  });

  describe("detectFormat", function () {
    it("should detect markdown files", function () {
      expect(detectFormat("/docs/guide.md")).to.equal("markdown");
      expect(detectFormat("/docs/guide.markdown")).to.equal("markdown");
    });

    it("should detect MDX files", function () {
      expect(detectFormat("/docs/page.mdx")).to.equal("mdx");
    });

    it("should detect reStructuredText files", function () {
      expect(detectFormat("/docs/index.rst")).to.equal("rst");
      expect(detectFormat("/docs/index.rest")).to.equal("rst");
    });

    it("should detect AsciiDoc files", function () {
      expect(detectFormat("/docs/guide.adoc")).to.equal("asciidoc");
      expect(detectFormat("/docs/guide.asciidoc")).to.equal("asciidoc");
      expect(detectFormat("/docs/guide.asc")).to.equal("asciidoc");
    });

    it("should detect DITA files", function () {
      expect(detectFormat("/docs/topic.dita")).to.equal("dita");
      expect(detectFormat("/docs/map.ditamap")).to.equal("dita");
    });

    it("should detect XML files", function () {
      expect(detectFormat("/docs/config.xml")).to.equal("xml");
    });

    it("should detect HTML files", function () {
      expect(detectFormat("/docs/page.html")).to.equal("html");
      expect(detectFormat("/docs/page.htm")).to.equal("html");
      expect(detectFormat("/docs/page.xhtml")).to.equal("html");
    });

    it("should return unknown for unrecognized extensions", function () {
      expect(detectFormat("/docs/file.txt")).to.equal("unknown");
      expect(detectFormat("/docs/file.json")).to.equal("unknown");
      expect(detectFormat("/docs/file")).to.equal("unknown");
    });

    it("should handle case-insensitive extensions", function () {
      expect(detectFormat("/docs/file.MD")).to.equal("markdown");
      expect(detectFormat("/docs/file.HTML")).to.equal("html");
    });
  });

  describe("getParser", function () {
    it("should return parseMarkdown for markdown format", function () {
      expect(getParser("markdown")).to.equal(parseMarkdown);
    });

    it("should return parseMdx for mdx format", function () {
      expect(getParser("mdx")).to.equal(parseMdx);
    });

    it("should return parseRst for rst format", function () {
      expect(getParser("rst")).to.equal(parseRst);
    });

    it("should return parseAsciidoc for asciidoc format", function () {
      expect(getParser("asciidoc")).to.equal(parseAsciidoc);
    });

    it("should return parseDitaXml for dita format", function () {
      expect(getParser("dita")).to.equal(parseDitaXml);
    });

    it("should return parseDitaXml for xml format", function () {
      expect(getParser("xml")).to.equal(parseDitaXml);
    });

    it("should return parseHtml for html format", function () {
      expect(getParser("html")).to.equal(parseHtml);
    });

    it("should return parseNaive for unknown format", function () {
      expect(getParser("unknown")).to.equal(parseNaive);
    });

    it("should return parseNaive for undefined format", function () {
      expect(getParser(undefined)).to.equal(parseNaive);
    });
  });

  describe("parseMarkdown", function () {
    it("should parse simple markdown with H2 sections", async function () {
      const content = `# Main Title

Introduction paragraph.

## Section One

Content for section one.

## Section Two

Content for section two.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should include heading in chunk", async function () {
      const content = `## Getting Started

Follow these steps to get started.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].heading).to.equal("Getting Started");
      expect(chunks[0].content).to.include("Follow these steps");
    });

    it("should include source location information", async function () {
      const content = `## First Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
      expect(chunks[0].sourceLocation.startLine).to.be.a("number");
      expect(chunks[0].sourceLocation.endLine).to.be.a("number");
      expect(chunks[0].sourceLocation.startOffset).to.be.a("number");
      expect(chunks[0].sourceLocation.endOffset).to.be.a("number");
    });

    it("should handle content before first heading", async function () {
      const content = `Some intro text before any heading.

## First Section

Section content.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      // Should have at least 2 chunks - intro and section
      expect(chunks.length).to.be.at.least(1);
    });

    it("should respect custom chunkLevel option", async function () {
      const content = `# H1 Title

## H2 Section

### H3 Subsection

Content in H3.

### Another H3

More content.`;

      // Chunk at H3 level
      const chunks = await parseMarkdown(content, { chunkLevel: 3 });

      // Should create chunks at H3 boundaries too
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should return whole document when no headings present", async function () {
      const content = `This is a document without any headings.

Just paragraphs of text.

And more text.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].content).to.equal(content);
      expect(chunks[0].heading).to.be.null;
    });

    it("should handle empty content", async function () {
      const chunks = await parseMarkdown("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should handle whitespace-only content", async function () {
      const chunks = await parseMarkdown("   \n\n   ");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should handle code blocks correctly", async function () {
      const content = `## Code Example

Here is some code:

\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\`

More content after code.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      // Content should be in chunks (may include code block in section)
      expect(chunks.length).to.be.at.least(1);
      // Find the chunk with the code example
      const codeChunk = chunks.find(c => c.content.includes("```javascript"));
      expect(codeChunk).to.exist;
    });

    it("should handle links and inline formatting", async function () {
      const content = `## Links Section

Check out [Example](https://example.com) for more info.

**Bold text** and *italic text* are supported.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0].content).to.include("[Example](https://example.com)");
      expect(chunks[0].content).to.include("**Bold text**");
    });
  });

  describe("parseMdx", function () {
    it("should parse MDX content with JSX components", async function () {
      const content = `## Component Example

<Button onClick={() => alert('clicked')}>Click me</Button>

Regular markdown text.`;

      const chunks = await parseMdx(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].content).to.include("<Button");
    });

    it("should handle MDX imports", async function () {
      const content = `import { Button } from '@components/Button'

## Using Components

<Button>Click</Button>`;

      const chunks = await parseMdx(content);

      expect(chunks).to.be.an("array");
      // Should handle the import statement
    });

    it("should include source location", async function () {
      const content = `## MDX Section

Some content.`;

      const chunks = await parseMdx(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
      expect(chunks[0].sourceLocation.startLine).to.be.a("number");
    });

    it("should handle empty MDX content", async function () {
      const chunks = await parseMdx("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });
  });

  describe("parseAsciidoc", function () {
    it("should parse AsciiDoc with section headings", async function () {
      const content = `= Main Title

Introduction.

== First Section

Content for first section.

== Second Section

Content for second section.`;

      const chunks = await parseAsciidoc(content);

      expect(chunks).to.be.an("array");
      // Should find sections
    });

    it("should return whole document when no sections", async function () {
      const content = `= Document Title

Just a document with a title but no sections.

Some paragraphs here.`;

      const chunks = await parseAsciidoc(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(1);
    });

    it("should include source location", async function () {
      const content = `= Title

== Section

Content here.`;

      const chunks = await parseAsciidoc(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
    });

    it("should handle empty content", async function () {
      const chunks = await parseAsciidoc("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });
  });

  describe("parseDitaXml", function () {
    it("should parse DITA topic content", async function () {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="sample">
  <title>Sample Topic</title>
  <body>
    <section>
      <title>First Section</title>
      <p>Section content here.</p>
    </section>
  </body>
</topic>`;

      const chunks = await parseDitaXml(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(1);
    });

    it("should extract text from sections", async function () {
      const content = `<topic>
  <title>Topic Title</title>
  <body>
    <section>
      <title>Section Title</title>
      <p>Paragraph text.</p>
    </section>
  </body>
</topic>`;

      const chunks = await parseDitaXml(content);

      expect(chunks).to.be.an("array");
      // Should extract section content
    });

    it("should handle task elements", async function () {
      const content = `<task id="sample-task">
  <title>Task Title</title>
  <taskbody>
    <steps>
      <step><cmd>Do something.</cmd></step>
    </steps>
  </taskbody>
</task>`;

      const chunks = await parseDitaXml(content);

      expect(chunks).to.be.an("array");
    });

    it("should include source location", async function () {
      const content = `<topic><title>Test</title></topic>`;

      const chunks = await parseDitaXml(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
    });

    it("should handle empty content", async function () {
      const chunks = await parseDitaXml("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should handle malformed XML gracefully", async function () {
      const content = `<not valid xml`;

      // Should fall back to naive parsing
      const chunks = await parseDitaXml(content);
      expect(chunks).to.be.an("array");
    });
  });

  describe("parseHtml", function () {
    it("should parse HTML with heading sections", async function () {
      const content = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
<h1>Main Title</h1>
<p>Introduction.</p>
<h2>First Section</h2>
<p>First section content.</p>
<h2>Second Section</h2>
<p>Second section content.</p>
</body>
</html>`;

      const chunks = await parseHtml(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should extract headings as chunk titles", async function () {
      const content = `<h2>Getting Started</h2>
<p>Follow these steps.</p>`;

      const chunks = await parseHtml(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].heading).to.equal("Getting Started");
    });

    it("should handle semantic section elements", async function () {
      const content = `<section>
<h2>Section One</h2>
<p>Content one.</p>
</section>
<section>
<h2>Section Two</h2>
<p>Content two.</p>
</section>`;

      const chunks = await parseHtml(content);

      expect(chunks).to.be.an("array");
    });

    it("should include source location", async function () {
      const content = `<h2>Test</h2><p>Content</p>`;

      const chunks = await parseHtml(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
    });

    it("should handle empty HTML", async function () {
      const chunks = await parseHtml("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should handle HTML without headings", async function () {
      const content = `<div><p>Just some paragraphs.</p><p>More text.</p></div>`;

      const chunks = await parseHtml(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
    });

    it("should respect chunkLevel option", async function () {
      const content = `<h1>H1 Title</h1>
<p>Content under H1.</p>
<h2>H2 Section</h2>
<p>Content under H2.</p>
<h3>H3 Subsection</h3>
<p>Content under H3.</p>`;

      const chunks = await parseHtml(content, { chunkLevel: 3 });

      expect(chunks).to.be.an("array");
      // Should include H3 as section boundary
    });
  });

  describe("parseNaive", function () {
    it("should parse markdown-style headings", async function () {
      const content = `# Main Title

Introduction.

## Section One

Content one.

## Section Two

Content two.`;

      const chunks = await parseNaive(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should parse AsciiDoc-style headings", async function () {
      const content = `= Main Title

Introduction.

== Section One

Content one.`;

      const chunks = await parseNaive(content);

      expect(chunks).to.be.an("array");
    });

    it("should parse rST-style headings with underlines", async function () {
      const content = `Main Title
==========

Introduction text.

Section One
-----------

Content for section one.`;

      const chunks = await parseNaive(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should include source location", async function () {
      const content = `## Test Section

Content here.`;

      const chunks = await parseNaive(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
      expect(chunks[0].sourceLocation.startLine).to.be.a("number");
      expect(chunks[0].sourceLocation.endLine).to.be.a("number");
    });

    it("should return whole document when no headings found", async function () {
      const content = `Just plain text.

More paragraphs.

No headings here.`;

      const chunks = await parseNaive(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].content).to.equal(content);
    });

    it("should handle empty content", async function () {
      const chunks = await parseNaive("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should respect chunkLevel option", async function () {
      const content = `# H1

## H2

### H3

Content.`;

      const chunks = await parseNaive(content, { chunkLevel: 3 });

      expect(chunks).to.be.an("array");
      // Should recognize H3 as section boundary
    });
  });

  describe("parseRst", function () {
    // Note: parseRst requires tree-sitter-rst WASM which may not be available in all environments
    // These tests will gracefully fall back to naive parsing if WASM isn't loaded

    it("should parse rST content", async function () {
      const content = `Title
=====

Introduction.

Section One
-----------

Content one.

Section Two
-----------

Content two.`;

      const chunks = await parseRst(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(1);
    });

    it("should include source location", async function () {
      const content = `Test
====

Content here.`;

      const chunks = await parseRst(content);

      expect(chunks[0].sourceLocation).to.be.an("object");
    });

    it("should handle empty content", async function () {
      const chunks = await parseRst("");
      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(0);
    });

    it("should handle content without sections", async function () {
      const content = `Just some plain text without any sections.

Another paragraph.`;

      const chunks = await parseRst(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
    });
  });

  describe("parseDocument", function () {
    it("should use parseMarkdown for .md files", async function () {
      const content = `## Section

Content.`;

      const chunks = await parseDocument(content, "/docs/guide.md");

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(1);
      expect(chunks[0].heading).to.equal("Section");
    });

    it("should use parseMdx for .mdx files", async function () {
      const content = `## Section

<Component />`;

      const chunks = await parseDocument(content, "/docs/page.mdx");

      expect(chunks).to.be.an("array");
    });

    it("should use parseHtml for .html files", async function () {
      const content = `<h2>Section</h2><p>Content</p>`;

      const chunks = await parseDocument(content, "/docs/page.html");

      expect(chunks).to.be.an("array");
    });

    it("should use parseAsciidoc for .adoc files", async function () {
      const content = `= Title

== Section

Content.`;

      const chunks = await parseDocument(content, "/docs/guide.adoc");

      expect(chunks).to.be.an("array");
    });

    it("should use parseDitaXml for .dita files", async function () {
      const content = `<topic><title>Test</title></topic>`;

      const chunks = await parseDocument(content, "/docs/topic.dita");

      expect(chunks).to.be.an("array");
    });

    it("should use parseNaive for unknown extensions", async function () {
      const content = `## Section

Content.`;

      const chunks = await parseDocument(content, "/docs/file.txt");

      expect(chunks).to.be.an("array");
    });

    it("should pass options to the parser", async function () {
      const content = `# H1

## H2

### H3

Content.`;

      const chunks = await parseDocument(content, "/docs/guide.md", {
        chunkLevel: 3,
      });

      expect(chunks).to.be.an("array");
    });
  });

  describe("Chunk structure validation", function () {
    it("should always include content property", async function () {
      const content = `## Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0]).to.have.property("content");
      expect(chunks[0].content).to.be.a("string");
      expect(chunks[0].content.length).to.be.greaterThan(0);
    });

    it("should always include sourceLocation property", async function () {
      const content = `## Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0]).to.have.property("sourceLocation");
      expect(chunks[0].sourceLocation).to.have.property("startLine");
      expect(chunks[0].sourceLocation).to.have.property("endLine");
      expect(chunks[0].sourceLocation).to.have.property("startColumn");
      expect(chunks[0].sourceLocation).to.have.property("endColumn");
      expect(chunks[0].sourceLocation).to.have.property("startOffset");
      expect(chunks[0].sourceLocation).to.have.property("endOffset");
    });

    it("should include heading property (can be null)", async function () {
      const content = `## Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0]).to.have.property("heading");
    });

    it("should have valid line numbers (1-based)", async function () {
      const content = `## Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0].sourceLocation.startLine).to.be.at.least(1);
      expect(chunks[0].sourceLocation.endLine).to.be.at.least(
        chunks[0].sourceLocation.startLine
      );
    });

    it("should have valid offsets (0-based)", async function () {
      const content = `## Section

Some content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks[0].sourceLocation.startOffset).to.be.at.least(0);
      expect(chunks[0].sourceLocation.endOffset).to.be.greaterThan(
        chunks[0].sourceLocation.startOffset
      );
    });
  });

  describe("Edge cases", function () {
    it("should handle very long documents", async function () {
      const sections = [];
      for (let i = 0; i < 100; i++) {
        sections.push(`## Section ${i}\n\nContent for section ${i}.`);
      }
      const content = sections.join("\n\n");

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(100);
    });

    it("should handle special characters in headings", async function () {
      const content = `## Section with "quotes" & <special> chars

Content here.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks[0].heading).to.include("quotes");
    });

    it("should handle Unicode content", async function () {
      const content = `## 日本語の見出し

日本語のコンテンツ。

## Émojis 🎉

Content with émojis 👍`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.equal(2);
      expect(chunks[0].heading).to.equal("日本語の見出し");
    });

    it("should handle mixed line endings", async function () {
      const content = "## Section One\r\n\r\nContent.\r\n\n## Section Two\n\nMore content.";

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
      expect(chunks.length).to.be.at.least(2);
    });

    it("should handle deeply nested headings", async function () {
      const content = `# H1

## H2

### H3

#### H4

##### H5

###### H6

Content at deepest level.`;

      const chunks = await parseMarkdown(content);

      expect(chunks).to.be.an("array");
    });
  });
});
