/**
 * reStructuredText parser adapter using restructured.
 * Converts RST content to RST tree.
 */

const restructured = require("restructured");

/**
 * Parses RST content into an AST.
 * @param {string} content - The RST content to parse.
 * @returns {Object|null} The parsed AST, or null if parsing fails.
 */
function parse(content) {
  try {
    const ast = restructured.parse(content);
    return ast;
  } catch (error) {
    return null;
  }
}

module.exports = { parse };
