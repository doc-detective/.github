/**
 * Markdown parser adapter using unified + remark-parse.
 * Converts Markdown content to MDAST (Markdown Abstract Syntax Tree).
 */

const { unified } = require("unified");
const remarkParseModule = require("remark-parse");
const remarkParse = remarkParseModule.default || remarkParseModule;

/**
 * Parses Markdown content into an MDAST.
 * @param {string} content - The Markdown content to parse.
 * @returns {Object|null} The parsed MDAST, or null if parsing fails.
 */
function parse(content) {
  try {
    const processor = unified().use(remarkParse);
    const ast = processor.parse(content);
    return ast;
  } catch (error) {
    return null;
  }
}

module.exports = { parse };
