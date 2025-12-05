/**
 * HTML parser adapter using unified + rehype-parse.
 * Converts HTML content to HAST (HTML Abstract Syntax Tree).
 */

const { unified } = require("unified");
const rehypeParseModule = require("rehype-parse");
const rehypeParse = rehypeParseModule.default || rehypeParseModule;

/**
 * Parses HTML content into a HAST.
 * @param {string} content - The HTML content to parse.
 * @returns {Object|null} The parsed HAST, or null if parsing fails.
 */
function parse(content) {
  try {
    const processor = unified().use(rehypeParse, { fragment: true });
    const ast = processor.parse(content);
    return ast;
  } catch (error) {
    return null;
  }
}

module.exports = { parse };
