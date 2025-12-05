/**
 * XML/DITA parser adapter using @xmldom/xmldom.
 * Converts XML content to a normalized AST-like structure.
 */

const { DOMParser } = require("@xmldom/xmldom");

/**
 * Converts array-like object to array.
 * @param {Object} nodeList - DOM NodeList or similar.
 * @returns {Array} Array of nodes.
 */
function toArray(nodeList) {
  if (!nodeList) return [];
  const result = [];
  for (let i = 0; i < nodeList.length; i++) {
    result.push(nodeList[i]);
  }
  return result;
}

/**
 * Recursively converts DOM node to normalized AST structure.
 * @param {Node} node - DOM node.
 * @returns {Object|null} Normalized AST node.
 */
function domToAst(node) {
  if (!node) return null;

  // Skip text nodes that are only whitespace
  if (node.nodeType === 3) {
    const text = node.textContent || node.data || "";
    if (text.trim() === "") return null;
    return {
      type: "text",
      value: text,
      attributes: {},
      children: [],
    };
  }

  // Handle comment nodes
  if (node.nodeType === 8) {
    return {
      type: "comment",
      value: node.textContent || node.data || "",
      attributes: {},
      children: [],
    };
  }

  // Handle processing instructions
  if (node.nodeType === 7) {
    return {
      type: "processingInstruction",
      target: node.target,
      value: node.data || "",
      attributes: {},
      children: [],
    };
  }

  // Handle element nodes
  if (node.nodeType === 1) {
    const astNode = {
      type: "element",
      tagName: node.tagName ? node.tagName.toLowerCase() : node.nodeName.toLowerCase(),
      attributes: {},
      children: [],
    };

    // Extract attributes
    if (node.attributes) {
      const attrs = toArray(node.attributes);
      for (const attr of attrs) {
        if (attr && attr.name) {
          astNode.attributes[attr.name] = attr.value;
        }
      }
    }

    // Process child nodes
    const children = toArray(node.childNodes);
    for (const childNode of children) {
      const child = domToAst(childNode);
      if (child) {
        astNode.children.push(child);
      }
    }

    // Extract text content (direct text without children elements)
    const textContent = children
      .filter(n => n && n.nodeType === 3)
      .map(n => n.textContent || n.data || "")
      .join("")
      .trim();
    if (textContent) {
      astNode.content = textContent;
    }

    return astNode;
  }

  // Handle document nodes
  if (node.nodeType === 9) {
    const astNode = {
      type: "document",
      attributes: {},
      children: [],
    };

    const children = toArray(node.childNodes);
    for (const childNode of children) {
      const child = domToAst(childNode);
      if (child) {
        astNode.children.push(child);
      }
    }

    return astNode;
  }

  return null;
}

/**
 * Parses XML/DITA content into a normalized AST.
 * @param {string} content - The XML content to parse.
 * @returns {Object|null} The parsed AST, or null if parsing fails.
 */
function parse(content) {
  try {
    const parser = new DOMParser({
      onError: () => {},
    });
    const doc = parser.parseFromString(content, "text/xml");
    if (!doc || !doc.documentElement) {
      return null;
    }
    return domToAst(doc);
  } catch (error) {
    return null;
  }
}

module.exports = { parse };
