/**
 * Source file update utilities for inline test editing
 * 
 * This module provides functions to:
 * - Serialize steps to inline comment format
 * - Update/insert content at specific positions in source files
 * - Handle different comment formats (HTML, JSX, link reference)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Serialize a step to inline comment format based on the detected or default comment format.
 * 
 * @param {Object} options - Options for serialization
 * @param {Object} options.step - The step object to serialize
 * @param {string} options.commentFormat - Comment format: 'htmlComment', 'jsxComment', or 'linkReference'
 * @param {string} options.fileExtension - File extension (e.g., '.md', '.jsx') for fallback format detection
 * @returns {string} The serialized inline step comment
 */
function serializeStepToInline({ step, commentFormat, fileExtension }) {
  // Determine the comment format to use
  const format = commentFormat || getDefaultCommentFormat(fileExtension);
  
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
    // Full format: JSON object
    stepContent = JSON.stringify(stepToSerialize);
  }
  
  // Wrap in appropriate comment format
  switch (format) {
    case 'jsxComment':
      return `{/* step ${stepContent} */}`;
    case 'linkReference':
      // Link reference format doesn't support arbitrary step content
      // Fall back to HTML comment
      return `<!-- step ${stepContent} -->`;
    case 'htmlComment':
    default:
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
 * @returns {string} The serialized inline test comment
 */
function serializeTestToInline({ test, commentFormat, fileExtension }) {
  const format = commentFormat || getDefaultCommentFormat(fileExtension);
  
  // Clone test and remove non-serializable properties
  const testToSerialize = {};
  if (test.testId) testToSerialize.testId = test.testId;
  if (test.description) testToSerialize.description = test.description;
  if (test.detectSteps !== undefined) testToSerialize.detectSteps = test.detectSteps;
  if (test.runOn) testToSerialize.runOn = test.runOn;
  if (test.before) testToSerialize.before = test.before;
  if (test.after) testToSerialize.after = test.after;
  
  // Check if we need the full object or can use simple attributes
  const needsFullObject = test.runOn || test.before || test.after;
  
  let testContent;
  if (needsFullObject) {
    testContent = JSON.stringify(testToSerialize);
  } else {
    // Use XML-style attributes for simple cases
    const attrs = [];
    if (testToSerialize.testId) attrs.push(`testId="${testToSerialize.testId}"`);
    if (testToSerialize.description) attrs.push(`description="${testToSerialize.description}"`);
    if (testToSerialize.detectSteps !== undefined) attrs.push(`detectSteps=${testToSerialize.detectSteps}`);
    testContent = attrs.join(' ');
  }
  
  switch (format) {
    case 'jsxComment':
      return `{/* test ${testContent} */}`;
    case 'htmlComment':
    default:
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
      const { startOffset, endOffset, newContent } = update;
      
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
 * Prepare updates for saving inline steps to source files.
 * Handles both explicit inline steps (update in place) and auto-detected steps
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
        // Auto-detected step: insert new explicit comment AFTER the original content
        // The original markup (code block, link, etc.) remains intact
        const newContent = serializeStepToInline({
          step,
          commentFormat: loc.commentFormat || 'htmlComment',
          fileExtension: path.extname(loc.file),
        });
        
        // Insert after the original content (at endOffset)
        // Add a newline before the comment for readability
        fileUpdates.push({
          startOffset: loc.endOffset,
          endOffset: loc.endOffset,
          newContent: '\n' + newContent,
          isInsertion: true,
          isAutoDetectedConversion: true,
        });
      } else {
        // Explicit inline step: update in place
        const newContent = serializeStepToInline({
          step,
          commentFormat: loc.commentFormat,
          fileExtension: path.extname(loc.file),
        });
        
        fileUpdates.push({
          startOffset: loc.startOffset,
          endOffset: loc.endOffset,
          newContent,
          isInsertion: false,
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
  getDefaultCommentFormat,
  canSerializeAsSimple,
  getFileContentHash,
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
