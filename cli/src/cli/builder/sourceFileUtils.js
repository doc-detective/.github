/**
 * Source file update utilities for inline test editing
 * 
 * This module provides functions to:
 * - Serialize steps to inline comment format
 * - Update/insert content at specific positions in source files
 * - Handle different comment formats (HTML, JSX, link reference)
 * - Detect and preserve syntax formats (JSON, YAML, XML)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Detect the syntax format used in an inline statement's original text.
 * 
 * @param {string} originalText - The original inline statement text
 * @returns {'json'|'yaml'|'xml'|null} The detected syntax format, or null if unknown
 */
function detectSyntaxFormat(originalText) {
  if (!originalText) return null;
  
  // Remove comment wrappers to get the content
  let content = originalText.trim();
  
  // Remove HTML comment wrapper: <!-- test/step ... -->
  const htmlMatch = content.match(/<!--\s*(?:test|step)\s+([\s\S]*?)\s*-->/);
  if (htmlMatch) {
    content = htmlMatch[1].trim();
  }
  
  // Remove JSX comment wrapper: {/* test/step ... */}
  const jsxMatch = content.match(/\{\s*\/\*\s*(?:test|step)\s+([\s\S]*?)\s*\*\/\s*\}/);
  if (jsxMatch) {
    content = jsxMatch[1].trim();
  }
  
  // Remove link reference wrapper: [comment]: # (test/step ...)
  const linkMatch = content.match(/\[comment\]:\s*#\s*\((?:test|step)\s+([\s\S]*?)\s*\)/);
  if (linkMatch) {
    content = linkMatch[1].trim();
  }
  
  // Now detect the syntax format of the content
  
  // JSON: starts with { or contains "key": pattern
  if (content.startsWith('{') || /^"?\w+"?\s*:\s*[{\["']/.test(content)) {
    return 'json';
  }
  
  // XML-style attributes: key="value" or key=value patterns without JSON structure
  if (/^\w+\s*=\s*["']?[^{]/.test(content) || /^\w+\s*=\s*(?:true|false|\d+)/.test(content)) {
    return 'xml';
  }
  
  // YAML: contains key: value patterns with newlines or indentation
  if (/^\w+:\s*\n/.test(content) || /\n\s+\w+:/.test(content)) {
    return 'yaml';
  }
  
  // YAML: simple key: value without JSON braces
  if (/^\w+:\s+[^{]/.test(content) && !content.includes('{')) {
    return 'yaml';
  }
  
  // Default to JSON if we can't detect
  return 'json';
}

/**
 * Serialize content to the specified syntax format.
 * 
 * @param {Object} obj - The object to serialize
 * @param {'json'|'yaml'|'xml'} syntaxFormat - The syntax format to use
 * @param {'test'|'step'} type - Whether this is a test or step
 * @returns {string} The serialized content (without comment wrappers)
 */
function serializeToSyntax(obj, syntaxFormat, type) {
  switch (syntaxFormat) {
    case 'xml':
      // XML-style attributes: key="value" key=boolean
      const attrs = [];
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          attrs.push(`${key}="${value}"`);
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          attrs.push(`${key}=${value}`);
        } else {
          // Complex values fall back to JSON
          attrs.push(`${key}=${JSON.stringify(value)}`);
        }
      }
      return attrs.join(' ');
    
    case 'yaml':
      // Multiline YAML format
      const yamlLines = [];
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Quote strings that contain special characters
          if (/[:#\[\]{}|>!&*?'"]/.test(value) || value.includes('\n')) {
            yamlLines.push(`${key}: "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
          } else {
            yamlLines.push(`${key}: ${value}`);
          }
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          yamlLines.push(`${key}: ${value}`);
        } else if (Array.isArray(value)) {
          // Arrays use YAML flow style
          yamlLines.push(`${key}: ${JSON.stringify(value)}`);
        } else if (typeof value === 'object' && value !== null) {
          // Nested objects use indented YAML
          yamlLines.push(`${key}:`);
          for (const [subKey, subValue] of Object.entries(value)) {
            if (typeof subValue === 'string') {
              if (/[:#\[\]{}|>!&*?'"]/.test(subValue) || subValue.includes('\n')) {
                yamlLines.push(`  ${subKey}: "${subValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
              } else {
                yamlLines.push(`  ${subKey}: ${subValue}`);
              }
            } else {
              yamlLines.push(`  ${subKey}: ${JSON.stringify(subValue)}`);
            }
          }
        } else {
          yamlLines.push(`${key}: ${JSON.stringify(value)}`);
        }
      }
      return yamlLines.join('\n');
    
    case 'json':
    default:
      return JSON.stringify(obj);
  }
}

/**
 * Serialize a step to inline comment format based on the detected or default comment format.
 * 
 * @param {Object} options - Options for serialization
 * @param {Object} options.step - The step object to serialize
 * @param {string} options.commentFormat - Comment format: 'htmlComment', 'jsxComment', or 'linkReference'
 * @param {string} options.fileExtension - File extension (e.g., '.md', '.jsx') for fallback format detection
 * @param {string} options.originalText - Original text of the inline statement (for syntax detection)
 * @param {'json'|'yaml'|'xml'} options.syntaxFormat - Explicit syntax format override
 * @returns {string} The serialized inline step comment
 */
function serializeStepToInline({ step, commentFormat, fileExtension, originalText, syntaxFormat }) {
  // Determine the comment format to use
  const format = commentFormat || getDefaultCommentFormat(fileExtension);
  
  // Detect or use provided syntax format
  const syntax = syntaxFormat || detectSyntaxFormat(originalText) || 'json';
  
  // Clone step and remove sourceLocation (it's read-only metadata, not serializable content)
  const stepToSerialize = { ...step };
  delete stepToSerialize.sourceLocation;
  
  // Determine the step type (action key)
  const actionKey = Object.keys(stepToSerialize).find(key => 
    !['stepId', 'description', 'unsafe', 'outputs', 'variables', 'breakpoint', '$schema'].includes(key)
  );
  
  if (!actionKey) {
    throw new Error('Cannot serialize step: no action found');
  }
  
  // Check if we can use simple format (just the action value)
  const canUseSimpleFormat = canSerializeAsSimple(stepToSerialize, actionKey);
  
  let stepContent;
  if (canUseSimpleFormat) {
    // Simple format: just the action and its value
    const actionValue = stepToSerialize[actionKey];
    if (typeof actionValue === 'string') {
      stepContent = `${actionKey}: "${actionValue}"`;
    } else if (typeof actionValue === 'boolean' || typeof actionValue === 'number') {
      stepContent = `${actionKey}: ${actionValue}`;
    } else {
      stepContent = `${actionKey}: ${JSON.stringify(actionValue)}`;
    }
  } else {
    // Full format: use detected/specified syntax
    stepContent = serializeToSyntax(stepToSerialize, syntax, 'step');
  }
  
  // Check if content is multiline
  const isMultiline = stepContent.includes('\n');
  
  // Wrap in appropriate comment format
  switch (format) {
    case 'jsxComment':
      if (isMultiline) {
        return `{/* step\n${stepContent}\n*/}`;
      }
      return `{/* step ${stepContent} */}`;
    case 'linkReference':
      // Link reference format doesn't support multiline well, fall back to JSON
      if (isMultiline) {
        return `[comment]: # (step ${JSON.stringify(stepToSerialize)})`;
      }
      return `[comment]: # (step ${stepContent})`;
    case 'htmlComment':
    default:
      if (isMultiline) {
        return `<!-- step\n${stepContent}\n-->`;
      }
      return `<!-- step ${stepContent} -->`;
  }
}

/**
 * Serialize a test declaration to inline comment format.
 * 
 * @param {Object} options - Options for serialization
 * @param {Object} options.test - The test object to serialize (only metadata, not steps)
 * @param {string} options.commentFormat - Comment format to use
 * @param {string} options.fileExtension - File extension for fallback format detection
 * @param {string} options.originalText - Original text of the inline statement (for syntax detection)
 * @param {'json'|'yaml'|'xml'} options.syntaxFormat - Explicit syntax format override
 * @returns {string} The serialized inline test comment
 */
function serializeTestToInline({ test, commentFormat, fileExtension, originalText, syntaxFormat }) {
  const format = commentFormat || getDefaultCommentFormat(fileExtension);
  
  // Detect or use provided syntax format
  const syntax = syntaxFormat || detectSyntaxFormat(originalText) || 'json';
  
  // Clone test and remove non-serializable properties
  const testToSerialize = {};
  if (test.testId) testToSerialize.testId = test.testId;
  if (test.description) testToSerialize.description = test.description;
  if (test.detectSteps !== undefined) testToSerialize.detectSteps = test.detectSteps;
  if (test.runOn) testToSerialize.runOn = test.runOn;
  if (test.before) testToSerialize.before = test.before;
  if (test.after) testToSerialize.after = test.after;
  
  // Use detected/specified syntax format
  const testContent = serializeToSyntax(testToSerialize, syntax, 'test');
  
  // Check if content is multiline
  const isMultiline = testContent.includes('\n');
  
  switch (format) {
    case 'jsxComment':
      if (isMultiline) {
        return `{/* test\n${testContent}\n*/}`;
      }
      return `{/* test ${testContent} */}`;
    case 'htmlComment':
    default:
      if (isMultiline) {
        return `<!-- test\n${testContent}\n-->`;
      }
      return `<!-- test ${testContent} -->`;
  }
}

/**
 * Determine the default comment format based on file extension.
 * 
 * @param {string} fileExtension - File extension (e.g., '.md', '.jsx')
 * @returns {string} Default comment format for the file type
 */
function getDefaultCommentFormat(fileExtension) {
  const ext = (fileExtension || '').toLowerCase();
  
  // JSX/TSX/MDX files use JSX comments
  if (['.jsx', '.tsx', '.mdx'].includes(ext)) {
    return 'jsxComment';
  }
  
  // All other files (including .md, .html) use HTML comments
  return 'htmlComment';
}

/**
 * Check if a test has metadata worth saving (testId, description, detectSteps, runOn, etc.).
 * This is used to determine if a new test declaration should be inserted.
 * 
 * @param {Object} test - The test object
 * @returns {boolean} True if the test has saveable metadata
 */
function hasTestMetadata(test) {
  if (!test) return false;
  
  // Check for any test-level properties that should be persisted
  return !!(
    test.testId ||
    test.description ||
    test.detectSteps !== undefined ||
    test.runOn ||
    test.before ||
    test.after
  );
}

/**
 * Check if a step can be serialized in simple format (just action: value).
 * 
 * @param {Object} step - The step object
 * @param {string} actionKey - The action key
 * @returns {boolean} True if simple format can be used
 */
function canSerializeAsSimple(step, actionKey) {
  // Count properties that aren't the action or common step properties
  const nonActionKeys = Object.keys(step).filter(key => 
    key !== actionKey && 
    !['stepId', 'description', 'unsafe', 'outputs', 'variables', 'breakpoint', '$schema'].includes(key)
  );
  
  // If there are other non-common properties, can't use simple format
  if (nonActionKeys.length > 0) {
    return false;
  }
  
  // Check if step has any common properties set (other than default values)
  const hasCommonProps = 
    step.stepId ||
    step.description ||
    step.unsafe === true ||
    (step.outputs && Object.keys(step.outputs).length > 0) ||
    (step.variables && Object.keys(step.variables).length > 0) ||
    step.breakpoint === true;
  
  if (hasCommonProps) {
    return false;
  }
  
  // Check if the action value is simple (string, number, boolean)
  const actionValue = step[actionKey];
  return typeof actionValue === 'string' || 
         typeof actionValue === 'number' || 
         typeof actionValue === 'boolean';
}

/**
 * Calculate the hash of a file's content for change detection.
 * 
 * @param {string} filePath - Path to the file
 * @returns {string|null} MD5 hash of the file content, or null if file doesn't exist
 */
function getFileContentHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Find the start of the line containing the given offset.
 * 
 * @param {string} content - The file content
 * @param {number} offset - The offset within the content
 * @returns {number} The offset of the start of the line
 */
function findLineStart(content, offset) {
  // Search backwards for newline
  let pos = offset - 1;
  while (pos >= 0 && content[pos] !== '\n') {
    pos--;
  }
  // Return position after the newline (or 0 if at start of file)
  return pos + 1;
}

/**
 * Find the end of the line containing the given offset (including the newline if present).
 * 
 * @param {string} content - The file content
 * @param {number} offset - The offset within the content
 * @returns {number} The offset after the end of the line (after newline if present)
 */
function findLineEnd(content, offset) {
  // Search forwards for newline
  let pos = offset;
  while (pos < content.length && content[pos] !== '\n') {
    pos++;
  }
  // Include the newline character if present
  if (pos < content.length && content[pos] === '\n') {
    pos++;
  }
  return pos;
}

/**
 * Get the indentation of a line (leading whitespace).
 * 
 * @param {string} content - The file content
 * @param {number} lineStart - The offset of the start of the line
 * @returns {string} The indentation string (spaces/tabs)
 */
function getLineIndentation(content, lineStart) {
  let indent = '';
  let pos = lineStart;
  while (pos < content.length && (content[pos] === ' ' || content[pos] === '\t')) {
    indent += content[pos];
    pos++;
  }
  return indent;
}

/**
 * Check if a source file has changed since it was detected.
 * 
 * @param {string} filePath - Path to the source file
 * @param {string} originalContent - Original content (or hash) from detection time
 * @returns {boolean} True if the file has changed
 */
function hasSourceFileChanged(filePath, originalContent) {
  try {
    const currentContent = fs.readFileSync(filePath, 'utf8');
    
    // If originalContent is a hash, compare hashes
    if (originalContent.length === 32 && /^[a-f0-9]+$/i.test(originalContent)) {
      const currentHash = crypto.createHash('md5').update(currentContent).digest('hex');
      return currentHash !== originalContent;
    }
    
    // Otherwise compare content directly
    return currentContent !== originalContent;
  } catch (error) {
    // If file doesn't exist or can't be read, it has changed
    return true;
  }
}

/**
 * Update content at a specific position in a file.
 * 
 * @param {Object} options - Options for the update
 * @param {string} options.filePath - Path to the file to update
 * @param {number} options.startOffset - Start offset for replacement
 * @param {number} options.endOffset - End offset for replacement
 * @param {string} options.newContent - New content to insert
 * @returns {Object} Result with success status and any error message
 */
function updateSourceContent({ filePath, startOffset, endOffset, newContent }) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Validate offsets
    if (startOffset < 0 || endOffset > content.length || startOffset > endOffset) {
      return {
        success: false,
        error: `Invalid offsets: start=${startOffset}, end=${endOffset}, fileLength=${content.length}`,
      };
    }
    
    // Perform replacement
    const before = content.substring(0, startOffset);
    const after = content.substring(endOffset);
    const updatedContent = before + newContent + after;
    
    // Write back to file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    return {
      success: true,
      offsetDelta: newContent.length - (endOffset - startOffset),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Insert content at a specific position in a file.
 * 
 * @param {Object} options - Options for the insertion
 * @param {string} options.filePath - Path to the file
 * @param {number} options.offset - Offset where to insert
 * @param {string} options.content - Content to insert
 * @param {boolean} options.insertBefore - If true, insert before the offset position
 * @returns {Object} Result with success status
 */
function insertSourceContent({ filePath, offset, content, insertBefore = false }) {
  return updateSourceContent({
    filePath,
    startOffset: insertBefore ? offset : offset,
    endOffset: insertBefore ? offset : offset,
    newContent: content,
  });
}

/**
 * Apply multiple source location updates to a file.
 * Updates are applied in reverse order (from end to start) to maintain offset validity.
 * 
 * Supports line-based operations:
 * - replaceEntireLine: Replace the entire line containing the offset range
 * - insertLineBefore: Insert new content as a new line before the target line
 * - insertLineAfter: Insert new content as a new line after the target line
 * 
 * @param {Object} options - Options for batch updates
 * @param {string} options.filePath - Path to the file
 * @param {Array} options.updates - Array of update objects with startOffset, endOffset, newContent
 * @returns {Object} Result with success status and array of individual results
 */
function batchUpdateSourceContent({ filePath, updates }) {
  if (!updates || updates.length === 0) {
    return { success: true, results: [] };
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Sort updates by startOffset in descending order to maintain offset validity
    const sortedUpdates = [...updates].sort((a, b) => b.startOffset - a.startOffset);
    
    const results = [];
    
    for (const update of sortedUpdates) {
      let { startOffset, endOffset, newContent } = update;
      
      // Handle line-based operations
      if (update.replaceEntireLine) {
        // Find the start and end of the line containing this range
        const lineStart = findLineStart(content, startOffset);
        const lineEnd = findLineEnd(content, endOffset);
        
        // Get the original indentation
        const indent = getLineIndentation(content, lineStart);
        
        // Replace entire line with indented new content + newline
        startOffset = lineStart;
        endOffset = lineEnd;
        newContent = indent + newContent + '\n';
      } else if (update.insertLineBefore) {
        // Insert as a new line before the line containing startOffset
        const lineStart = findLineStart(content, startOffset);
        
        // Get the indentation of the target line
        const indent = getLineIndentation(content, lineStart);
        
        // Insert before the line start
        startOffset = lineStart;
        endOffset = lineStart;
        newContent = indent + newContent + '\n';
      } else if (update.insertLineAfter) {
        // Insert as a new line after the line containing endOffset
        const lineEnd = findLineEnd(content, endOffset);
        
        // Get the indentation of the original line
        const lineStart = findLineStart(content, startOffset);
        const indent = getLineIndentation(content, lineStart);
        
        // Insert after the line end
        startOffset = lineEnd;
        endOffset = lineEnd;
        newContent = indent + newContent + '\n';
      }
      
      // Validate offsets
      if (startOffset < 0 || endOffset > content.length || startOffset > endOffset) {
        results.push({
          success: false,
          error: `Invalid offsets: start=${startOffset}, end=${endOffset}`,
          update,
        });
        continue;
      }
      
      // Perform replacement
      const before = content.substring(0, startOffset);
      const after = content.substring(endOffset);
      content = before + newContent + after;
      
      results.push({
        success: true,
        offsetDelta: newContent.length - (endOffset - startOffset),
        update,
      });
    }
    
    // Write the final content
    fs.writeFileSync(filePath, content, 'utf8');
    
    return {
      success: results.every(r => r.success),
      results,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      results: [],
    };
  }
}

/**
 * Check if a spec or any of its tests/steps have inline source locations.
 * 
 * @param {Object} spec - The spec object to check
 * @returns {boolean} True if any inline source locations exist
 */
function hasInlineSourceLocations(spec) {
  if (!spec) return false;
  
  for (const test of (spec.tests || [])) {
    // Check test sourceLocation
    if (test.sourceLocation?.isInline) {
      return true;
    }
    
    // Check step sourceLocations
    for (const step of (test.steps || [])) {
      if (step.sourceLocation?.isInline) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get all inline source files referenced by a spec.
 * 
 * @param {Object} spec - The spec object
 * @returns {Set<string>} Set of unique file paths
 */
function getInlineSourceFiles(spec) {
  const files = new Set();
  
  if (!spec) return files;
  
  for (const test of (spec.tests || [])) {
    if (test.sourceLocation?.isInline && test.sourceLocation.file) {
      files.add(test.sourceLocation.file);
    }
    
    for (const step of (test.steps || [])) {
      if (step.sourceLocation?.isInline && step.sourceLocation.file) {
        files.add(step.sourceLocation.file);
      }
    }
  }
  
  return files;
}

/**
 * Check if a step is auto-detected (from markup patterns like code blocks or links).
 * Auto-detected steps need special handling when edited - they should be converted
 * to explicit inline comments rather than replacing the original markup.
 * 
 * @param {Object} step - The step object to check
 * @returns {boolean} True if the step was auto-detected
 */
function isAutoDetectedStep(step) {
  return step?.sourceLocation?.isAutoDetected === true;
}

/**
 * Prepare updates for saving inline tests and steps to source files.
 * Handles both explicit inline tests/steps (update in place) and auto-detected steps
 * (insert new explicit comment after the original content).
 * 
 * @param {Object} options - Options for preparing updates
 * @param {Object} options.spec - The spec object containing tests and steps
 * @param {Object} options.originalSpec - The original spec before editing (for comparison)
 * @returns {Map<string, Array>} Map of file paths to arrays of update operations
*/
function prepareSourceUpdates({ spec, originalSpec }) {
  const updatesByFile = new Map();
  
  if (!spec?.tests) return updatesByFile;
  
  for (let testIndex = 0; testIndex < spec.tests.length; testIndex++) {
    const test = spec.tests[testIndex];
    const originalTest = originalSpec?.tests?.[testIndex];
    
    // Handle test-level sourceLocation (inline test declarations)
    const testLoc = test.sourceLocation;
    if (testLoc?.isInline && testLoc.file) {
      // Check if test metadata was modified by comparing with original (excluding steps and sourceLocation)
      const testMetadata = JSON.stringify(test, (key, value) => 
        key === 'sourceLocation' || key === 'steps' ? undefined : value
      );
      const originalMetadata = originalTest ? JSON.stringify(originalTest, (key, value) => 
        key === 'sourceLocation' || key === 'steps' ? undefined : value
      ) : null;
      
      const wasModified = testMetadata !== originalMetadata;
      
      if (wasModified) {
        const fileUpdates = updatesByFile.get(testLoc.file) || [];
        
        // Serialize the test declaration (without steps), preserving original syntax format
        const newContent = serializeTestToInline({
          test,
          commentFormat: testLoc.commentFormat || 'htmlComment',
          fileExtension: path.extname(testLoc.file),
          originalText: testLoc.originalText,
        });
        
        // Replace the ENTIRE LINE containing the test declaration
        fileUpdates.push({
          startOffset: testLoc.startOffset,
          endOffset: testLoc.endOffset,
          newContent,
          replaceEntireLine: true,
          isTestDeclaration: true,
        });
        
        updatesByFile.set(testLoc.file, fileUpdates);
      }
    } else if (!testLoc && hasTestMetadata(test)) {
      // No test-level sourceLocation, but test has metadata that should be saved.
      // Find the first inline step to determine where to insert the test declaration.
      const firstInlineStep = (test.steps || []).find(s => s.sourceLocation?.isInline && s.sourceLocation.file);
      
      if (firstInlineStep) {
        const stepLoc = firstInlineStep.sourceLocation;
        const fileUpdates = updatesByFile.get(stepLoc.file) || [];
        
        // Serialize the test declaration, using the first step's syntax format as a hint
        const newContent = serializeTestToInline({
          test,
          commentFormat: stepLoc.commentFormat || 'htmlComment',
          fileExtension: path.extname(stepLoc.file),
          originalText: stepLoc.originalText,  // Use first step's format as hint
        });
        
        // Insert on the LINE BEFORE the first step
        fileUpdates.push({
          startOffset: stepLoc.startOffset,
          endOffset: stepLoc.startOffset,
          newContent,
          insertLineBefore: true,
          isTestDeclaration: true,
          isNewTestDeclaration: true,
        });
        
        updatesByFile.set(stepLoc.file, fileUpdates);
      }
    }
    
    // Handle step-level sourceLocations
    for (let stepIndex = 0; stepIndex < (test.steps || []).length; stepIndex++) {
      const step = test.steps[stepIndex];
      const originalStep = originalTest?.steps?.[stepIndex];
      const loc = step.sourceLocation;
      
      // Skip if no inline source location
      if (!loc?.isInline || !loc.file) continue;
      
      // Check if step was modified by comparing with original
      const stepContent = JSON.stringify(step, (key, value) => 
        key === 'sourceLocation' ? undefined : value
      );
      const originalContent = originalStep ? JSON.stringify(originalStep, (key, value) => 
        key === 'sourceLocation' ? undefined : value
      ) : null;
      
      const wasModified = stepContent !== originalContent;
      
      // Skip if not modified
      if (!wasModified) continue;
      
      const fileUpdates = updatesByFile.get(loc.file) || [];
      
      if (loc.isAutoDetected) {
        // Auto-detected step: insert new explicit comment on the LINE AFTER the original content
        // The original markup (code block, link, etc.) remains intact
        const newContent = serializeStepToInline({
          step,
          commentFormat: loc.commentFormat || 'htmlComment',
          fileExtension: path.extname(loc.file),
          // No originalText for auto-detected - use default JSON format
        });
        
        // Insert on the line after the original content
        fileUpdates.push({
          startOffset: loc.startOffset,
          endOffset: loc.endOffset,
          newContent,
          insertLineAfter: true,
          isAutoDetectedConversion: true,
        });
      } else {
        // Explicit inline step: replace the ENTIRE LINE, preserving original syntax format
        const newContent = serializeStepToInline({
          step,
          commentFormat: loc.commentFormat,
          fileExtension: path.extname(loc.file),
          originalText: loc.originalText,
        });
        
        fileUpdates.push({
          startOffset: loc.startOffset,
          endOffset: loc.endOffset,
          newContent,
          replaceEntireLine: true,
        });
      }
      
      updatesByFile.set(loc.file, fileUpdates);
    }
  }
  
  return updatesByFile;
}

/**
 * Check if a spec has any auto-detected steps.
 * 
 * @param {Object} spec - The spec object to check
 * @returns {boolean} True if any steps are auto-detected
 */
function hasAutoDetectedSteps(spec) {
  if (!spec?.tests) return false;
  
  for (const test of spec.tests) {
    for (const step of (test.steps || [])) {
      if (isAutoDetectedStep(step)) {
        return true;
      }
    }
  }
  
  return false;
}

module.exports = {
  serializeStepToInline,
  serializeTestToInline,
  detectSyntaxFormat,
  serializeToSyntax,
  getDefaultCommentFormat,
  canSerializeAsSimple,
  hasTestMetadata,
  getFileContentHash,
  findLineStart,
  findLineEnd,
  getLineIndentation,
  hasSourceFileChanged,
  updateSourceContent,
  insertSourceContent,
  batchUpdateSourceContent,
  hasInlineSourceLocations,
  getInlineSourceFiles,
  isAutoDetectedStep,
  prepareSourceUpdates,
  hasAutoDetectedSteps,
};
