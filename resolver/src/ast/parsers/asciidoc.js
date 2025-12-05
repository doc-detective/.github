/**
 * AsciiDoc parser adapter using asciidoctor.js.
 * Converts AsciiDoc content to Asciidoctor AST.
 */

const Asciidoctor = require("asciidoctor");

// Create singleton asciidoctor processor
const asciidoctor = Asciidoctor();

/**
 * Converts Asciidoctor document/block to a normalized AST node.
 * @param {Object} node - Asciidoctor node.
 * @returns {Object} Normalized AST node.
 */
function normalizeNode(node) {
  const normalized = {
    type: node.getNodeName ? node.getNodeName() : "unknown",
    attributes: {},
    children: [],
    content: null,
    position: null,
  };

  // Extract attributes
  if (node.getAttributes) {
    const attrs = node.getAttributes();
    if (attrs && typeof attrs === "object") {
      normalized.attributes = { ...attrs };
    }
  }

  // Extract specific attributes
  if (node.getRole) {
    normalized.attributes.role = node.getRole();
  }
  if (node.getStyle) {
    normalized.attributes.style = node.getStyle();
  }
  if (node.getId) {
    normalized.attributes.id = node.getId();
  }

  // Extract content based on node type
  if (node.getSource) {
    normalized.content = node.getSource();
  } else if (node.getContent) {
    const content = node.getContent();
    if (typeof content === "string") {
      normalized.content = content;
    }
  } else if (node.getText) {
    normalized.content = node.getText();
  }

  // Get source location if available
  if (node.getSourceLocation) {
    const loc = node.getSourceLocation();
    if (loc) {
      normalized.position = {
        start: { line: loc.getLineNumber ? loc.getLineNumber() : null },
      };
    }
  }

  // Process children
  if (node.getBlocks) {
    const blocks = node.getBlocks();
    if (blocks && blocks.length > 0) {
      normalized.children = blocks.map(normalizeNode);
    }
  }

  return normalized;
}

/**
 * Parses AsciiDoc content into a normalized AST.
 * @param {string} content - The AsciiDoc content to parse.
 * @returns {Object|null} The parsed AST, or null if parsing fails.
 */
function parse(content) {
  try {
    const doc = asciidoctor.load(content, { safe: "safe" });
    return normalizeNode(doc);
  } catch (error) {
    return null;
  }
}

module.exports = { parse };
