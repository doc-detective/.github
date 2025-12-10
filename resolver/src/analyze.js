const { generate, schemas, validate } = require("doc-detective-common");
const crypto = require("crypto");

const DEFAULT_MAX_CONTENT_LENGTH = 100000;

/**
 * System prompt for analyzing documentation and generating test specifications.
 */
const ANALYSIS_SYSTEM_PROMPT = `You are a documentation testing expert. Your task is to analyze documentation content and generate tests that verify the documented behavior is accurate.

When analyzing documentation:
1. Identify testable assertions - URLs, UI interactions, API calls, shell commands, code examples
2. Generate appropriate test steps for each assertion
3. Maintain the logical order of operations as described in the documentation
4. Use appropriate action types: goTo, find, click, type, checkLink, httpRequest, runShell, runCode, screenshot, wait
5. For UI interactions, prefer element* properties when specific elements are mentioned, using the following priority: elementText, elementAria, elementClass, elementAttributes, selector
6. For links, use checkLink to verify they return acceptable status codes
7. Generate descriptive test and step IDs based on the content

Output a valid Doc Detective test containing steps that verify the documentation.`;

/**
 * Builds the analysis prompt from the provided content and context.
 * @param {Object} options
 * @param {string} options.content - The documentation content to analyze
 * @param {string} [options.filePath] - Path to the source file for context
 * @param {number} [options.maxContentLength] - Maximum content length before truncation
 * @returns {string} The formatted prompt
 */
const buildAnalysisPrompt = ({
  content,
  filePath,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
}) => {
  // Truncate content if it exceeds the maximum length
  const truncatedContent =
    content.length > maxContentLength
      ? content.substring(0, maxContentLength) +
        "\n\n[Content truncated due to length...]"
      : content;

  let prompt =
    "Analyze the following documentation and generate a test specification:\n\n";

  if (filePath) {
    prompt += `Source file: ${filePath}\n\n`;
  }

  prompt += `--- Documentation Content ---\n${truncatedContent}\n--- End Content ---\n\n`;
  prompt +=
    "Generate a Doc Detective specification with tests that verify the documented behavior. Include appropriate steps for each testable assertion found in the documentation.";

  return prompt;
};

/**
 * Generates a unique ID for specs and tests.
 * @param {string} [prefix] - Optional prefix for the ID
 * @returns {string} A unique ID
 */
const generateId = (prefix = "") => {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
};

/**
 * Analyzes document content using AI to generate test specifications.
 *
 * @param {Object} options - Analysis options
 * @param {string} options.content - Raw document content to analyze (required)
 * @param {string} [options.filePath] - Path to the source file for context
 * @param {Object} [options.config] - Doc Detective configuration object
 * @param {string} [options.model] - LLM model override (takes precedence over defaults)
 * @param {number} [options.maxContentLength] - Maximum content length before truncation (default: 100000)
 * @param {Array} [options.files] - Optional images/screenshots to include for multimodal analysis
 * @returns {Promise<Object>} A promise that resolves to a spec_v3 compatible specification
 * @throws {Error} If content is not provided or generation fails
 *
 * @example
 * const spec = await analyze({
 *   content: "# Getting Started\n\nNavigate to https://example.com...",
 *   filePath: "docs/getting-started.md",
 *   config: { integrations: { anthropic: { apiKey: "sk-..." } } }
 * });
 */
const analyze = async ({
  content,
  filePath,
  config = {},
  model,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  files,
}) => {
  // Validate required input
  if (!content || typeof content !== "string") {
    throw new Error("'content' is required and must be a string.");
  }

  // Build the prompt
  const prompt = buildAnalysisPrompt({
    content,
    filePath,
    maxContentLength,
  });

  // Get the test schema for structured output
  const testSchema = schemas.test_v3;

  // Generate the specification using AI
  // Pass config for integrations API keys, generate() will extract the right one
  let result;
  try {
    result = await generate({
      prompt,
      system: ANALYSIS_SYSTEM_PROMPT,
      schema: testSchema,
      schemaName: "test",
      schemaDescription: "A Doc Detective test",
      config,
      files,
    });
  } catch (error) {
    throw new Error(`Failed to generate test specification: ${error.message}`);
  }

  // Validate the spec against the schema
  const validation = validate({ schemaKey: "test_v3", object: result.object });
  if (!validation.valid) {
    throw new Error(
      `Generated test failed validation: ${JSON.stringify(validation.errors)}`
    );
  }

  return result.object;
};


module.exports = {
  analyze,
  buildAnalysisPrompt,
  ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTENT_LENGTH,
};
