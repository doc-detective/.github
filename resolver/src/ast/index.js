/**
 * AST parsing module for Doc Detective.
 * Provides unified interface for parsing various document formats into ASTs.
 */

const markdownParser = require("./parsers/markdown");
const htmlParser = require("./parsers/html");
const asciidocParser = require("./parsers/asciidoc");
const rstParser = require("./parsers/rst");
const xmlParser = require("./parsers/xml");

/**
 * Map of format names to their respective parsers.
 */
const parsers = {
  markdown: markdownParser,
  md: markdownParser,
  mdx: markdownParser,
  html: htmlParser,
  htm: htmlParser,
  asciidoc: asciidocParser,
  adoc: asciidocParser,
  asc: asciidocParser,
  rst: rstParser,
  restructuredtext: rstParser,
  xml: xmlParser,
  dita: xmlParser,
  ditamap: xmlParser,
};

/**
 * Parses content into an AST based on the specified format.
 * 
 * @param {string} content - The content to parse.
 * @param {string} format - The format of the content (e.g., 'markdown', 'html', 'dita').
 * @returns {Object|null} The parsed AST, or null if parsing fails or format is unsupported.
 */
function parseToAst(content, format) {
  if (!content || typeof content !== "string") {
    return null;
  }

  const formatLower = (format || "").toLowerCase();
  const parser = parsers[formatLower];

  if (!parser) {
    return null;
  }

  try {
    return parser.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Gets the parser for a given file extension.
 * 
 * @param {string} extension - The file extension (without leading dot).
 * @returns {Object|null} The parser module, or null if unsupported.
 */
function getParserForExtension(extension) {
  const extLower = (extension || "").toLowerCase().replace(/^\./, "");
  return parsers[extLower] || null;
}

/**
 * Checks if a format is supported for AST parsing.
 * 
 * @param {string} format - The format to check.
 * @returns {boolean} True if the format is supported.
 */
function isFormatSupported(format) {
  const formatLower = (format || "").toLowerCase();
  return formatLower in parsers;
}

module.exports = {
  parseToAst,
  getParserForExtension,
  isFormatSupported,
};
