/**
 * DocAnalyzer - Parse documentation and generate tests using AI
 * Integrates with resolver's analyze() function for AI-powered test generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse a document into testable chunks
 * @param {Object} options
 * @param {string} options.filePath - Absolute path to document
 * @param {string} [options.content] - File content (optional, read if not provided)
 * @param {Object} options.config - Doc Detective config
 * @param {boolean} [options.applyHybridRules=true] - Apply chunking optimization rules
 * @returns {Promise<Array<Chunk>>} Parsed chunks
 */
export async function parseDocument({ filePath, content, config, applyHybridRules = true }) {
  // Read file if content not provided
  if (!content) {
    content = fs.readFileSync(filePath, 'utf8');
  }

  // Detect format from extension
  const ext = path.extname(filePath).toLowerCase();

  // Delegate to appropriate parser
  let chunks;
  if (ext === '.md' || ext === '.markdown') {
    chunks = splitMarkdownByHeadings(content, filePath);
  } else if (ext === '.dita' || ext === '.xml') {
    chunks = splitDitaByTopics(content, filePath);
  } else {
    throw new Error(`Unsupported format: ${ext}`);
  }

  // Apply hybrid rules if requested
  if (applyHybridRules) {
    chunks = applyHybridRulesFunc(chunks);
  }

  return chunks;
}

/**
 * Split markdown content by ## and ### headings
 * @param {string} content - Markdown content
 * @param {string} filePath - Source file path
 * @returns {Array<Chunk>} Chunks with heading context (no hybrid rules applied)
 */
export function splitMarkdownByHeadings(content, filePath) {
  const chunks = [];
  // Split on newlines and remove carriage returns (handle Windows line endings)
  const lines = content.split('\n').map(line => line.replace(/\r$/, ''));

  // Find all ## and ### headings
  const headingRegex = /^(#{2,3})\s+(.+)$/;
  const headings = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex);
    if (match) {
      headings.push({
        level: match[1].length, // 2 or 3
        text: match[2].trim(),
        lineIndex: i,
      });
    }
  }

  // Extract content between headings
  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const next = headings[i + 1];
    const endIndex = next ? next.lineIndex - 1 : lines.length - 1;

    const chunkContent = lines.slice(current.lineIndex, endIndex + 1).join('\n');

    // Find parent heading (level 2 for level 3 headings)
    let parentHeading = null;
    if (current.level === 3) {
      for (let j = i - 1; j >= 0; j--) {
        if (headings[j].level === 2) {
          parentHeading = headings[j].text;
          break;
        }
      }
    }

    chunks.push({
      content: chunkContent,
      heading: current.text,
      startLine: current.lineIndex + 1, // 1-based
      endLine: endIndex + 1, // 1-based
      filePath: path.resolve(filePath),
      type: 'markdown',
      context: {
        parentHeading,
      },
    });
  }

  return chunks;
}

/**
 * Apply hybrid chunking rules:
 * - Combine short chunks (<500 chars)
 * - Split long chunks (>5000 chars)
 * @param {Array<Chunk>} chunks - Raw chunks
 * @returns {Array<Chunk>} Processed chunks
 */
function applyHybridRulesFunc(chunks) {
  const result = [];
  let pendingMerge = null;

  for (const chunk of chunks) {
    if (chunk.content.length < 500 && pendingMerge && pendingMerge.content.length < 500) {
      // Merge with previous short chunk (only if both are small)
      pendingMerge.content += '\n\n' + chunk.content;
      pendingMerge.endLine = chunk.endLine;
      pendingMerge.heading += ' + ' + chunk.heading;
    } else if (chunk.content.length > 5000) {
      // Split long chunk at paragraph boundaries
      if (pendingMerge) {
        result.push(pendingMerge);
        pendingMerge = null;
      }
      result.push(...splitLongChunk(chunk));
    } else {
      // Normal size chunk
      if (pendingMerge) {
        result.push(pendingMerge);
      }
      pendingMerge = chunk;
    }
  }

  if (pendingMerge) {
    result.push(pendingMerge);
  }

  return result;
}

/**
 * Split a long chunk at paragraph boundaries
 * @param {Chunk} chunk - Long chunk to split
 * @returns {Array<Chunk>} Split chunks
 */
function splitLongChunk(chunk) {
  const paragraphs = chunk.content.split(/\n\n+/);
  const subChunks = [];
  let currentContent = '';
  let currentStartLine = chunk.startLine;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    if (currentContent.length + para.length > 5000 && currentContent.length > 0) {
      // Create sub-chunk
      const lineCount = currentContent.split('\n').length;
      subChunks.push({
        content: currentContent,
        heading: `${chunk.heading} (part ${subChunks.length + 1})`,
        startLine: currentStartLine,
        endLine: currentStartLine + lineCount - 1,
        filePath: chunk.filePath,
        type: chunk.type,
        context: chunk.context,
      });
      currentContent = para;
      currentStartLine += lineCount;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

  // Add remaining content
  if (currentContent) {
    const lineCount = currentContent.split('\n').length;
    subChunks.push({
      content: currentContent,
      heading: `${chunk.heading} (part ${subChunks.length + 1})`,
      startLine: currentStartLine,
      endLine: currentStartLine + lineCount - 1,
      filePath: chunk.filePath,
      type: chunk.type,
      context: chunk.context,
    });
  }

  return subChunks;
}

/**
 * Split DITA content by topics
 * @param {string} content - DITA XML content
 * @param {string} filePath - Source file path
 * @returns {Array<Chunk>} DITA chunks
 */
export function splitDitaByTopics(content, filePath) {
  // For now, treat entire DITA document as single chunk
  // TODO: Implement XML parsing to extract <task>, <concept>, <reference> elements
  const lines = content.split('\n').map(line => line.replace(/\r$/, ''));

  return [
    {
      content,
      heading: 'DITA Document',
      startLine: 1,
      endLine: lines.length,
      filePath: path.resolve(filePath),
      type: 'dita-task',
      context: {},
    },
  ];
}

/**
 * Generate tests for a chunk using AI
 * @param {Object} options
 * @param {Chunk} options.chunk - Document chunk
 * @param {Array<Test>} options.existingTests - Detected inline tests
 * @param {Object} options.config - Doc Detective config
 * @param {number} [options.attemptNumber=0] - Regeneration attempt
 * @returns {Promise<GeneratedTests>} Generated tests
 */
export async function generateTestsForChunk({
  chunk,
  existingTests,
  config,
  attemptNumber = 0,
}) {
  try {
    // Dynamically import analyze function from resolver
    const { analyze } = await import('doc-detective-resolver');

    // Build context-aware content
    let content = chunk.content;
    if (chunk.context.parentHeading) {
      content = `Parent section: ${chunk.context.parentHeading}\n\n${content}`;
    }

    // Add attempt number to vary results on regeneration
    if (attemptNumber > 0) {
      content += `\n\n[Generation attempt ${attemptNumber + 1}]`;
    }

    // Call analyzer
    const result = await analyze({
      content,
      filePath: chunk.filePath,
      config,
    });

    // Extract generated test
    let generatedTest = null;
    if (result && result.tests && result.tests.length > 0) {
      generatedTest = result.tests[0];
    } else if (result && result.steps) {
      // If analyze returns a test object directly
      generatedTest = result;
    }

    // Add sourceLocation metadata
    if (generatedTest) {
      generatedTest.sourceLocation = {
        file: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        isGenerated: true,
        generatedFrom: 'doc-import',
        originalHeading: chunk.heading,
      };
    }

    // Extract confidence score if present
    // The AI might include a confidence field in the test metadata
    let confidence = 70; // Default confidence for successful generation
    if (generatedTest && generatedTest.confidence !== undefined) {
      confidence = generatedTest.confidence;
      // Clean up - don't keep confidence in the actual test object
      delete generatedTest.confidence;
    } else if (generatedTest && generatedTest.description) {
      // Try to parse confidence from description if mentioned
      const confidenceMatch = generatedTest.description.match(/\b(\d{1,3})%?\s*confidence\b/i);
      if (confidenceMatch) {
        confidence = parseInt(confidenceMatch[1], 10);
      }
    }

    // Clamp confidence to 0-100 range
    confidence = Math.max(0, Math.min(100, confidence));

    return {
      tests: generatedTest ? [generatedTest] : [],
      preservedTests: existingTests || [],
      chunk,
      hasErrors: false,
      confidence,
    };
  } catch (error) {
    return {
      tests: [],
      preservedTests: existingTests || [],
      chunk,
      hasErrors: true,
      errorMessage: error.message || String(error),
      confidence: 0, // No confidence for failed generation
    };
  }
}
