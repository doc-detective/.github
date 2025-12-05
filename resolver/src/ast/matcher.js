/**
 * AST node matching engine for Doc Detective.
 * Provides functions to match nodes in an AST based on configuration.
 */

/**
 * Checks if a value matches a pattern.
 * Supports: exact string, regex (string starting with /), array (any-of), boolean (exists-check).
 * 
 * @param {*} value - The value to check.
 * @param {*} pattern - The pattern to match against.
 * @returns {boolean} True if the value matches the pattern.
 */
function matchesPattern(value, pattern) {
  // Boolean: exists-check
  if (pattern === true) {
    return value !== undefined && value !== null;
  }
  if (pattern === false) {
    return value === undefined || value === null;
  }

  // Array: any-of matching
  if (Array.isArray(pattern)) {
    return pattern.some(p => matchesPattern(value, p));
  }

  // Regex pattern (string starting and ending with /)
  if (typeof pattern === "string" && pattern.startsWith("/") && pattern.endsWith("/")) {
    const regexStr = pattern.slice(1, -1);
    try {
      const regex = new RegExp(regexStr);
      return regex.test(String(value || ""));
    } catch (e) {
      return false;
    }
  }

  // Regex pattern with flags (e.g., /pattern/i)
  if (typeof pattern === "string" && pattern.startsWith("/")) {
    const lastSlash = pattern.lastIndexOf("/");
    if (lastSlash > 0) {
      const regexStr = pattern.slice(1, lastSlash);
      const flags = pattern.slice(lastSlash + 1);
      try {
        const regex = new RegExp(regexStr, flags);
        return regex.test(String(value || ""));
      } catch (e) {
        return false;
      }
    }
  }

  // Exact match
  return value === pattern;
}

/**
 * Gets a nested value from an object using a dot-separated path.
 * 
 * @param {Object} obj - The object to extract from.
 * @param {string} path - The dot-separated path (e.g., "attributes.lang").
 * @returns {*} The value at the path, or undefined if not found.
 */
function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;
  
  const parts = path.split(".");
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Checks if a node matches the AST configuration.
 * 
 * @param {Object} node - The AST node to check.
 * @param {Object} astConfig - The AST matching configuration.
 * @returns {boolean} True if the node matches.
 */
function nodeMatches(node, astConfig) {
  if (!node || !astConfig) return false;

  // Check nodeType
  if (astConfig.nodeType) {
    const nodeType = node.type || node.tagName;
    if (!matchesPattern(nodeType, astConfig.nodeType)) {
      return false;
    }
  }

  // Check attributes
  if (astConfig.attributes) {
    for (const [attrName, attrPattern] of Object.entries(astConfig.attributes)) {
      // Handle special attribute names
      let value;
      if (attrName === "tagName") {
        value = node.tagName || node.name;
      } else if (attrName === "lang" || attrName === "language") {
        // For code blocks, check both lang and language
        value = node.lang || node.language || 
                (node.attributes && (node.attributes.lang || node.attributes.language));
      } else if (attrName === "className" || attrName === "class") {
        value = node.className || (node.attributes && (node.attributes.className || node.attributes.class));
      } else {
        // Check in attributes object first, then directly on node
        value = (node.attributes && node.attributes[attrName]) || node[attrName];
      }

      if (!matchesPattern(value, attrPattern)) {
        return false;
      }
    }
  }

  // Check content
  if (astConfig.content !== undefined) {
    const nodeContent = node.value || node.content || node.text || "";
    if (!matchesPattern(nodeContent, astConfig.content)) {
      return false;
    }
  }

  // Check children (all child matchers must match at least one child)
  if (astConfig.children && Array.isArray(astConfig.children)) {
    const nodeChildren = node.children || [];
    for (const childMatcher of astConfig.children) {
      const hasMatchingChild = nodeChildren.some(child => nodeMatches(child, childMatcher));
      if (!hasMatchingChild) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Extracts values from a node based on the extract configuration.
 * 
 * @param {Object} node - The AST node.
 * @param {Object} extractConfig - Mapping of variable names to paths (e.g., { "$1": "attributes.lang" }).
 * @returns {Object} Object mapping variable names to extracted values.
 */
function extractValues(node, extractConfig) {
  if (!node || !extractConfig) return {};

  const extracted = {};
  for (const [varName, path] of Object.entries(extractConfig)) {
    // Handle special paths
    let value;
    if (path === "value" || path === "content") {
      value = node.value || node.content || node.text || "";
    } else if (path === "tagName" || path === "type") {
      value = node.tagName || node.type || node.name || "";
    } else {
      value = getValueByPath(node, path);
    }
    
    // Convert the variable name to match expected format ($1 -> 1)
    const key = varName.replace(/^\$/, "");
    extracted[key] = value;
  }

  return extracted;
}

/**
 * Gets the position of a node in the source content.
 * 
 * @param {Object} node - The AST node.
 * @returns {Object|null} Position object with start offset, or null if unavailable.
 */
function getNodePosition(node) {
  if (!node) return null;

  // MDAST/HAST position format
  if (node.position && typeof node.position.start === "object") {
    return {
      offset: node.position.start.offset,
      line: node.position.start.line,
      column: node.position.start.column,
    };
  }

  // Direct position properties
  if (typeof node.offset === "number") {
    return { offset: node.offset };
  }

  // Line-based position
  if (typeof node.line === "number") {
    return { line: node.line };
  }

  return null;
}

/**
 * Recursively finds all nodes in an AST that match the configuration.
 * 
 * @param {Object} ast - The AST root node.
 * @param {Object} astConfig - The AST matching configuration.
 * @returns {Array<Object>} Array of matching results with node, position, and extracted values.
 */
function matchNodes(ast, astConfig) {
  if (!ast || !astConfig) return [];

  const results = [];

  function traverse(node, index = 0) {
    if (!node) return;

    // Check if this node matches
    if (nodeMatches(node, astConfig)) {
      const position = getNodePosition(node);
      const extracted = astConfig.extract ? extractValues(node, astConfig.extract) : {};
      
      results.push({
        node,
        position,
        extracted,
        sortIndex: position ? (position.offset || position.line * 1000 || index) : index,
      });
    }

    // Traverse children
    const children = node.children || node.blocks || [];
    if (Array.isArray(children)) {
      children.forEach((child, childIndex) => traverse(child, childIndex));
    }
  }

  traverse(ast);
  return results;
}

/**
 * Gets the text content from a matched node.
 * 
 * @param {Object} node - The AST node.
 * @returns {string} The text content of the node.
 */
function getNodeContent(node) {
  if (!node) return "";

  // Direct content properties
  if (node.value) return node.value;
  if (node.content) return node.content;
  if (node.text) return node.text;

  // For element nodes, concatenate text children
  if (node.children && Array.isArray(node.children)) {
    return node.children
      .filter(child => child.type === "text" || child.value)
      .map(child => child.value || child.text || "")
      .join("");
  }

  return "";
}

module.exports = {
  matchNodes,
  nodeMatches,
  extractValues,
  getNodeContent,
  getNodePosition,
  matchesPattern,
  getValueByPath,
};
