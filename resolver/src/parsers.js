const { unified } = require("unified");
const remarkParse = require("remark-parse");
const remarkMdx = require("remark-mdx");
const { visit } = require("unist-util-visit");
const { load: cheerioLoad } = require("cheerio");
const { XMLParser } = require("fast-xml-parser");
const path = require("path");

/**
 * @typedef {Object} Chunk
 * @property {string} content - The text content of the chunk
 * @property {string} [heading] - The heading/title of this section (if any)
 * @property {Object} sourceLocation - Source location information
 * @property {number} sourceLocation.startLine - 1-based start line
 * @property {number} sourceLocation.endLine - 1-based end line
 * @property {number} sourceLocation.startColumn - 1-based start column
 * @property {number} sourceLocation.endColumn - 1-based end column
 * @property {number} sourceLocation.startOffset - 0-based character offset
 * @property {number} sourceLocation.endOffset - 0-based character offset
 */

/**
 * Default chunk level for section splitting (H2 equivalent)
 */
const DEFAULT_CHUNK_LEVEL = 2;

/**
 * Tree-sitter parser instance (lazily initialized)
 */
let treeSitterParser = null;
let rstLanguage = null;

/**
 * Initialize the tree-sitter parser for rST (lazy initialization)
 * @returns {Promise<Object>} The initialized parser
 */
const initTreeSitterRst = async () => {
  if (treeSitterParser && rstLanguage) {
    return { parser: treeSitterParser, language: rstLanguage };
  }

  const Parser = require("web-tree-sitter");
  await Parser.init();
  treeSitterParser = new Parser();

  // Load the RST language - tree-sitter-rst should provide a .wasm file
  // or we need to locate it in node_modules
  const rstPath = require.resolve("tree-sitter-rst");
  const rstDir = path.dirname(rstPath);
  const wasmPath = path.join(rstDir, "tree-sitter-rst.wasm");

  try {
    rstLanguage = await Parser.Language.load(wasmPath);
    treeSitterParser.setLanguage(rstLanguage);
  } catch (error) {
    // Fallback: try to find .wasm in different locations
    const altWasmPath = path.join(rstDir, "tree_sitter_rst.wasm");
    try {
      rstLanguage = await Parser.Language.load(altWasmPath);
      treeSitterParser.setLanguage(rstLanguage);
    } catch (innerError) {
      throw new Error(
        `Failed to load tree-sitter-rst WASM: ${error.message}. ` +
          `Tried paths: ${wasmPath}, ${altWasmPath}`
      );
    }
  }

  return { parser: treeSitterParser, language: rstLanguage };
};

/**
 * Convert AST position to sourceLocation object
 * @param {Object} position - AST position with line/column info
 * @param {string} content - Full document content
 * @returns {Object} Source location object
 */
const positionToSourceLocation = (position, content) => {
  const startLine = position.start?.line ?? 1;
  const endLine = position.end?.line ?? startLine;
  const startColumn = position.start?.column ?? 1;
  const endColumn = position.end?.column ?? 1;
  const startOffset = position.start?.offset ?? 0;
  const endOffset = position.end?.offset ?? content.length;

  return {
    startLine,
    endLine,
    startColumn,
    endColumn,
    startOffset,
    endOffset,
  };
};

/**
 * Calculate source location from line numbers
 * @param {number} startLine - 1-based start line
 * @param {number} endLine - 1-based end line
 * @param {string} content - Full document content
 * @returns {Object} Source location object
 */
const lineNumbersToSourceLocation = (startLine, endLine, content) => {
  const lines = content.split("\n");
  let startOffset = 0;
  let endOffset = content.length;

  // Calculate start offset
  for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
    startOffset += lines[i].length + 1; // +1 for newline
  }

  // Calculate end offset
  endOffset = 0;
  for (let i = 0; i < endLine && i < lines.length; i++) {
    endOffset += lines[i].length + 1;
  }
  endOffset = Math.min(endOffset, content.length);

  return {
    startLine,
    endLine,
    startColumn: 1,
    endColumn: lines[endLine - 1]?.length + 1 || 1,
    startOffset,
    endOffset,
  };
};

/**
 * Extract text content from mdast nodes
 * @param {Object} node - mdast node
 * @returns {string} Text content
 */
const extractMdastText = (node) => {
  if (node.type === "text") {
    return node.value;
  }
  if (node.children) {
    return node.children.map(extractMdastText).join("");
  }
  return "";
};

/**
 * Serialize mdast node back to markdown-ish text
 * @param {Object} node - mdast node
 * @param {string} content - Original content for fallback
 * @returns {string} Serialized content
 */
const serializeMdastNode = (node, content) => {
  if (node.position) {
    return content.slice(node.position.start.offset, node.position.end.offset);
  }
  return extractMdastText(node);
};

/**
 * Parse Markdown content into semantic chunks at H2 level
 * @param {string} content - Markdown content
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at (1-6)
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseMarkdown = async (content, options = {}) => {
  const chunkLevel = options.chunkLevel ?? DEFAULT_CHUNK_LEVEL;

  try {
    const processor = unified().use(remarkParse);
    const tree = processor.parse(content);

    const chunks = [];
    let currentChunk = null;
    let currentHeading = null;
    let currentNodes = [];

    const flushChunk = (endPosition) => {
      if (currentNodes.length > 0) {
        const startPos = currentNodes[0].position?.start || { line: 1, column: 1, offset: 0 };
        const endPos = endPosition || currentNodes[currentNodes.length - 1].position?.end || { line: 1, column: 1, offset: content.length };

        const chunkContent = content.slice(startPos.offset, endPos.offset);

        if (chunkContent.trim()) {
          chunks.push({
            content: chunkContent,
            heading: currentHeading,
            sourceLocation: {
              startLine: startPos.line,
              endLine: endPos.line,
              startColumn: startPos.column,
              endColumn: endPos.column,
              startOffset: startPos.offset,
              endOffset: endPos.offset,
            },
          });
        }
      }
      currentNodes = [];
      currentHeading = null;
    };

    for (const node of tree.children) {
      if (node.type === "heading" && node.depth <= chunkLevel) {
        // Flush previous chunk before starting new section
        if (currentNodes.length > 0) {
          flushChunk(node.position?.start);
        }
        currentHeading = extractMdastText(node);
        currentNodes = [node];
      } else {
        currentNodes.push(node);
      }
    }

    // Flush final chunk
    flushChunk();

    // If no chunks were created, return the whole document as one chunk
    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        content: content,
        heading: null,
        sourceLocation: {
          startLine: 1,
          endLine: content.split("\n").length,
          startColumn: 1,
          endColumn: content.split("\n").pop().length + 1,
          startOffset: 0,
          endOffset: content.length,
        },
      });
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Parse MDX content into semantic chunks at H2 level
 * @param {string} content - MDX content
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at (1-6)
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseMdx = async (content, options = {}) => {
  const chunkLevel = options.chunkLevel ?? DEFAULT_CHUNK_LEVEL;

  try {
    const processor = unified().use(remarkParse).use(remarkMdx);
    const tree = processor.parse(content);

    const chunks = [];
    let currentHeading = null;
    let currentNodes = [];

    const flushChunk = (endPosition) => {
      if (currentNodes.length > 0) {
        const startPos = currentNodes[0].position?.start || { line: 1, column: 1, offset: 0 };
        const endPos = endPosition || currentNodes[currentNodes.length - 1].position?.end || { line: 1, column: 1, offset: content.length };

        const chunkContent = content.slice(startPos.offset, endPos.offset);

        if (chunkContent.trim()) {
          chunks.push({
            content: chunkContent,
            heading: currentHeading,
            sourceLocation: {
              startLine: startPos.line,
              endLine: endPos.line,
              startColumn: startPos.column,
              endColumn: endPos.column,
              startOffset: startPos.offset,
              endOffset: endPos.offset,
            },
          });
        }
      }
      currentNodes = [];
      currentHeading = null;
    };

    for (const node of tree.children) {
      if (node.type === "heading" && node.depth <= chunkLevel) {
        if (currentNodes.length > 0) {
          flushChunk(node.position?.start);
        }
        currentHeading = extractMdastText(node);
        currentNodes = [node];
      } else {
        currentNodes.push(node);
      }
    }

    flushChunk();

    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        content: content,
        heading: null,
        sourceLocation: {
          startLine: 1,
          endLine: content.split("\n").length,
          startColumn: 1,
          endColumn: content.split("\n").pop().length + 1,
          startOffset: 0,
          endOffset: content.length,
        },
      });
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Parse reStructuredText content into semantic chunks using tree-sitter
 * @param {string} content - rST content
 * @param {Object} [options] - Parser options
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseRst = async (content, options = {}) => {
  try {
    const { parser } = await initTreeSitterRst();
    const tree = parser.parse(content);

    const chunks = [];
    const sections = [];

    // Collect all section nodes
    const collectSections = (node) => {
      if (node.type === "section") {
        const titleNode = node.children.find((c) => c.type === "title");
        sections.push({
          node,
          title: titleNode ? content.slice(titleNode.startIndex, titleNode.endIndex).trim() : null,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
        });
      }
      for (const child of node.children) {
        collectSections(child);
      }
    };

    collectSections(tree.rootNode);

    if (sections.length === 0) {
      // No sections found, return whole document
      if (content.trim()) {
        chunks.push({
          content: content,
          heading: null,
          sourceLocation: {
            startLine: 1,
            endLine: content.split("\n").length,
            startColumn: 1,
            endColumn: content.split("\n").pop().length + 1,
            startOffset: 0,
            endOffset: content.length,
          },
        });
      }
      return chunks;
    }

    // Calculate section boundaries
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];

      const endOffset = nextSection ? nextSection.startIndex : content.length;
      const chunkContent = content.slice(section.startIndex, endOffset);

      if (chunkContent.trim()) {
        chunks.push({
          content: chunkContent,
          heading: section.title,
          sourceLocation: {
            startLine: section.startPosition.row + 1,
            endLine: nextSection
              ? nextSection.startPosition.row
              : content.split("\n").length,
            startColumn: section.startPosition.column + 1,
            endColumn: 1,
            startOffset: section.startIndex,
            endOffset: endOffset,
          },
        });
      }
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Parse AsciiDoc content into semantic chunks
 * @param {string} content - AsciiDoc content
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Section level to chunk at (1-5)
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseAsciidoc = async (content, options = {}) => {
  const chunkLevel = options.chunkLevel ?? DEFAULT_CHUNK_LEVEL;

  try {
    const asciidoctor = require("asciidoctor")();
    const doc = asciidoctor.load(content, { sourcemap: true });

    const chunks = [];

    /**
     * Recursively process blocks to find sections
     * @param {Object} block - AsciiDoc block
     * @param {number} depth - Current depth
     */
    const processBlock = (block, depth = 0) => {
      const context = block.getContext ? block.getContext() : null;

      if (context === "section") {
        const level = block.getLevel ? block.getLevel() : 0;

        // Only chunk at the specified level or higher (lower number = higher in hierarchy)
        if (level > 0 && level <= chunkLevel) {
          const title = block.getTitle ? block.getTitle() : null;
          const sourceLocation = block.getSourceLocation
            ? block.getSourceLocation()
            : null;

          // Get the content of this section
          let sectionContent = "";
          if (sourceLocation) {
            const startLine = sourceLocation.getLineNumber
              ? sourceLocation.getLineNumber()
              : 1;
            const lines = content.split("\n");
            // Find where this section ends (next section at same or higher level, or end of doc)
            let endLine = lines.length;

            // Simple heuristic: look for next heading at same or higher level
            const headingPattern = new RegExp(`^={1,${level}}\\s+`);
            for (let i = startLine; i < lines.length; i++) {
              if (headingPattern.test(lines[i]) && i > startLine) {
                endLine = i;
                break;
              }
            }

            sectionContent = lines.slice(startLine - 1, endLine).join("\n");
            const loc = lineNumbersToSourceLocation(startLine, endLine, content);

            if (sectionContent.trim()) {
              chunks.push({
                content: sectionContent,
                heading: title,
                sourceLocation: loc,
              });
            }
          }
        }
      }

      // Process child blocks
      if (block.getBlocks) {
        const blocks = block.getBlocks();
        for (const child of blocks) {
          processBlock(child, depth + 1);
        }
      }
    };

    // Process sections from the document
    if (doc.getSections) {
      const sections = doc.getSections();
      for (const section of sections) {
        processBlock(section, 0);
      }
    }

    // If no chunks were created, return the whole document
    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        content: content,
        heading: doc.getTitle ? doc.getTitle() : null,
        sourceLocation: {
          startLine: 1,
          endLine: content.split("\n").length,
          startColumn: 1,
          endColumn: content.split("\n").pop().length + 1,
          startOffset: 0,
          endOffset: content.length,
        },
      });
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Parse DITA/XML content into semantic chunks
 * @param {string} content - DITA/XML content
 * @param {Object} [options] - Parser options
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseDitaXml = async (content, options = {}) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true,
      commentPropName: "#comment",
      trimValues: false,
    });

    const result = parser.parse(content);
    const chunks = [];

    /**
     * Find section-like elements in DITA/XML
     * DITA section elements: topic, concept, task, reference, section
     * Generic XML: section, div with id/class
     */
    const sectionElements = [
      "topic",
      "concept",
      "task",
      "reference",
      "troubleshooting",
      "section",
      "taskbody",
      "conbody",
      "refbody",
    ];

    /**
     * Extract text content from parsed XML node
     * @param {Object|Array} node - Parsed XML node
     * @returns {string} Text content
     */
    const extractText = (node) => {
      if (typeof node === "string") return node;
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (typeof node === "object") {
        let text = "";
        for (const [key, value] of Object.entries(node)) {
          if (key === "#text") {
            text += value;
          } else if (!key.startsWith("@_") && !key.startsWith("#")) {
            text += extractText(value);
          }
        }
        return text;
      }
      return "";
    };

    /**
     * Find title element in a DITA node
     * @param {Object|Array} node - Parsed XML node
     * @returns {string|null} Title text or null
     */
    const findTitle = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) {
          if (item.title) {
            return extractText(item.title);
          }
        }
      } else if (typeof node === "object" && node.title) {
        return extractText(node.title);
      }
      return null;
    };

    /**
     * Walk the XML tree to find sections
     * @param {Object|Array} node - Current node
     * @param {number} depth - Current depth
     */
    const walkXml = (node, depth = 0) => {
      if (Array.isArray(node)) {
        for (const item of node) {
          walkXml(item, depth);
        }
      } else if (typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (sectionElements.includes(key)) {
            const title = findTitle(value);
            const textContent = extractText(value);

            if (textContent.trim()) {
              // For XML, we estimate line numbers since fast-xml-parser doesn't provide them
              // This is a limitation - we'll use offset-based estimation
              chunks.push({
                content: textContent,
                heading: title,
                sourceLocation: {
                  startLine: 1,
                  endLine: 1,
                  startColumn: 1,
                  endColumn: 1,
                  startOffset: 0,
                  endOffset: content.length,
                },
              });
            }
          } else if (!key.startsWith("@_") && !key.startsWith("#")) {
            walkXml(value, depth + 1);
          }
        }
      }
    };

    walkXml(result, 0);

    // If no chunks were created, return the whole document
    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        content: content,
        heading: null,
        sourceLocation: {
          startLine: 1,
          endLine: content.split("\n").length,
          startColumn: 1,
          endColumn: content.split("\n").pop().length + 1,
          startOffset: 0,
          endOffset: content.length,
        },
      });
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Parse HTML content into semantic chunks
 * @param {string} content - HTML content
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at (1-6)
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseHtml = async (content, options = {}) => {
  const chunkLevel = options.chunkLevel ?? DEFAULT_CHUNK_LEVEL;

  try {
    const $ = cheerioLoad(content);
    const chunks = [];

    // Build selector for section boundaries
    const headingSelectors = [];
    for (let i = 1; i <= chunkLevel; i++) {
      headingSelectors.push(`h${i}`);
    }
    const sectionSelectors = ["section", "article", "main"];

    // Find all headings at or above chunk level
    const headings = $(headingSelectors.join(", ")).toArray();

    if (headings.length === 0) {
      // No headings found - try sections
      const sections = $(sectionSelectors.join(", ")).toArray();

      if (sections.length > 0) {
        for (const section of sections) {
          const $section = $(section);
          const title =
            $section.find("h1, h2, h3, h4, h5, h6").first().text() || null;
          const text = $section.text();

          if (text.trim()) {
            chunks.push({
              content: $.html(section),
              heading: title,
              sourceLocation: {
                startLine: 1,
                endLine: 1,
                startColumn: 1,
                endColumn: 1,
                startOffset: 0,
                endOffset: content.length,
              },
            });
          }
        }
      } else {
        // No sections either - return whole body
        const bodyContent = $("body").length ? $("body").html() : content;
        if (bodyContent && bodyContent.trim()) {
          chunks.push({
            content: bodyContent,
            heading: $("title").text() || null,
            sourceLocation: {
              startLine: 1,
              endLine: content.split("\n").length,
              startColumn: 1,
              endColumn: content.split("\n").pop().length + 1,
              startOffset: 0,
              endOffset: content.length,
            },
          });
        }
      }
    } else {
      // Process headings as section boundaries
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const $heading = $(heading);
        const title = $heading.text();

        // Collect content until next heading
        let sectionContent = $.html(heading);
        let current = $heading.next();

        while (current.length > 0) {
          const tagName = current.prop("tagName")?.toLowerCase();
          // Stop at next heading of same or higher level
          if (tagName && /^h[1-6]$/.test(tagName)) {
            const level = parseInt(tagName.charAt(1), 10);
            if (level <= chunkLevel) {
              break;
            }
          }
          sectionContent += $.html(current);
          current = current.next();
        }

        if (sectionContent.trim()) {
          chunks.push({
            content: sectionContent,
            heading: title,
            sourceLocation: {
              startLine: 1,
              endLine: 1,
              startColumn: 1,
              endColumn: 1,
              startOffset: 0,
              endOffset: content.length,
            },
          });
        }
      }
    }

    // If still no chunks, return whole document
    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        content: content,
        heading: null,
        sourceLocation: {
          startLine: 1,
          endLine: content.split("\n").length,
          startColumn: 1,
          endColumn: content.split("\n").pop().length + 1,
          startOffset: 0,
          endOffset: content.length,
        },
      });
    }

    return chunks;
  } catch (error) {
    // Fall back to naive parsing on error
    return parseNaive(content, options);
  }
};

/**
 * Naive parsing fallback - splits on heading patterns or blank lines
 * @param {string} content - Document content
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseNaive = async (content, options = {}) => {
  const chunkLevel = options.chunkLevel ?? DEFAULT_CHUNK_LEVEL;
  const chunks = [];

  // Try to detect heading patterns
  // Markdown: # Heading, ## Heading, etc.
  // rST: underlines with =, -, ~, etc.
  // AsciiDoc: = Heading, == Heading, etc.
  const lines = content.split("\n");

  // Markdown/AsciiDoc heading pattern (# or =)
  const mdHeadingPattern = new RegExp(`^#{1,${chunkLevel}}\\s+(.+)$`);
  const adocHeadingPattern = new RegExp(`^={1,${chunkLevel}}\\s+(.+)$`);

  // rST section detection (title followed by underline)
  const rstUnderlineChars = ["=", "-", "~", "^", '"', "'", "`", ":"];

  let currentChunkLines = [];
  let currentHeading = null;
  let chunkStartLine = 1;

  const flushChunk = (endLine) => {
    if (currentChunkLines.length > 0) {
      const chunkContent = currentChunkLines.join("\n");
      if (chunkContent.trim()) {
        const loc = lineNumbersToSourceLocation(
          chunkStartLine,
          endLine,
          content
        );
        chunks.push({
          content: chunkContent,
          heading: currentHeading,
          sourceLocation: loc,
        });
      }
    }
    currentChunkLines = [];
    currentHeading = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for Markdown heading
    const mdMatch = line.match(mdHeadingPattern);
    if (mdMatch) {
      flushChunk(lineNum - 1);
      chunkStartLine = lineNum;
      currentHeading = mdMatch[1];
      currentChunkLines.push(line);
      continue;
    }

    // Check for AsciiDoc heading
    const adocMatch = line.match(adocHeadingPattern);
    if (adocMatch) {
      flushChunk(lineNum - 1);
      chunkStartLine = lineNum;
      currentHeading = adocMatch[1];
      currentChunkLines.push(line);
      continue;
    }

    // Check for rST-style heading (previous line is title, current is underline)
    if (i > 0 && line.length > 0) {
      const underlineChar = line.charAt(0);
      if (
        rstUnderlineChars.includes(underlineChar) &&
        line === underlineChar.repeat(line.length) &&
        lines[i - 1].trim().length > 0 &&
        line.length >= lines[i - 1].trim().length
      ) {
        // This is an rST heading underline
        // Remove the title line from current chunk and start new chunk
        const titleLine = currentChunkLines.pop();
        flushChunk(lineNum - 2);
        chunkStartLine = lineNum - 1;
        currentHeading = titleLine?.trim() || null;
        currentChunkLines.push(titleLine || "");
        currentChunkLines.push(line);
        continue;
      }
    }

    currentChunkLines.push(line);
  }

  // Flush final chunk
  flushChunk(lines.length);

  // If no chunks were created, return whole document as one chunk
  if (chunks.length === 0 && content.trim()) {
    chunks.push({
      content: content,
      heading: null,
      sourceLocation: {
        startLine: 1,
        endLine: lines.length,
        startColumn: 1,
        endColumn: lines[lines.length - 1]?.length + 1 || 1,
        startOffset: 0,
        endOffset: content.length,
      },
    });
  }

  return chunks;
};

/**
 * Detect document format from file extension
 * @param {string} filePath - Path to the file
 * @returns {string} Format identifier: 'markdown', 'mdx', 'rst', 'asciidoc', 'dita', 'xml', 'html', or 'unknown'
 */
const detectFormat = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  const formatMap = {
    ".md": "markdown",
    ".markdown": "markdown",
    ".mdx": "mdx",
    ".rst": "rst",
    ".rest": "rst",
    ".adoc": "asciidoc",
    ".asciidoc": "asciidoc",
    ".asc": "asciidoc",
    ".dita": "dita",
    ".ditamap": "dita",
    ".xml": "xml",
    ".html": "html",
    ".htm": "html",
    ".xhtml": "html",
  };

  return formatMap[ext] || "unknown";
};

/**
 * Get the appropriate parser function for a format
 * @param {string} format - Format identifier from detectFormat()
 * @returns {Function} Parser function
 */
const getParser = (format) => {
  const parserMap = {
    markdown: parseMarkdown,
    mdx: parseMdx,
    rst: parseRst,
    asciidoc: parseAsciidoc,
    dita: parseDitaXml,
    xml: parseDitaXml,
    html: parseHtml,
    unknown: parseNaive,
  };

  return parserMap[format] || parseNaive;
};

/**
 * Parse a document into semantic chunks using the appropriate parser
 * @param {string} content - Document content
 * @param {string} filePath - Path to the file (used for format detection)
 * @param {Object} [options] - Parser options
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at
 * @returns {Promise<Chunk[]>} Array of chunks
 */
const parseDocument = async (content, filePath, options = {}) => {
  const format = detectFormat(filePath);
  const parser = getParser(format);
  return parser(content, options);
};

module.exports = {
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
};
