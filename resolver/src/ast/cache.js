/**
 * AST cache module for Doc Detective.
 * Caches parsed ASTs by file path and content hash to avoid redundant parsing.
 */

const crypto = require("crypto");
const { parseToAst } = require("./index");

/**
 * In-memory cache for parsed ASTs.
 * Key: filePath, Value: { hash: string, ast: Object }
 */
const cache = new Map();

/**
 * Computes a hash of the content for cache invalidation.
 * 
 * @param {string} content - The content to hash.
 * @returns {string} The MD5 hash of the content.
 */
function computeHash(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Gets a cached AST or parses and caches the content.
 * 
 * @param {string} content - The content to parse.
 * @param {string} format - The format of the content.
 * @param {string} filePath - The file path for caching purposes.
 * @returns {Object|null} The parsed AST, or null if parsing fails.
 */
function getOrParse(content, format, filePath) {
  if (!content || !format) {
    return null;
  }

  const hash = computeHash(content);
  
  // Check cache
  if (filePath && cache.has(filePath)) {
    const cached = cache.get(filePath);
    if (cached.hash === hash) {
      return cached.ast;
    }
    // Content changed, invalidate cache
    cache.delete(filePath);
  }

  // Parse content
  const ast = parseToAst(content, format);
  
  // Cache result if we have a file path
  if (filePath && ast) {
    cache.set(filePath, { hash, ast });
  }

  return ast;
}

/**
 * Clears the entire AST cache.
 */
function clearCache() {
  cache.clear();
}

/**
 * Removes a specific entry from the cache.
 * 
 * @param {string} filePath - The file path to remove from cache.
 */
function invalidate(filePath) {
  cache.delete(filePath);
}

/**
 * Gets the current size of the cache.
 * 
 * @returns {number} The number of entries in the cache.
 */
function size() {
  return cache.size;
}

module.exports = {
  getOrParse,
  clearCache,
  invalidate,
  size,
};
