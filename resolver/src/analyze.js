const { generate, schemas, validate } = require("doc-detective-common");
const crypto = require("crypto");
const { parseDocument, detectFormat } = require("./parsers");

const DEFAULT_MAX_CONTENT_LENGTH = 100000;

/**
 * Schema for actionability classification.
 * Used to determine if a chunk contains instructions for users to perform testable actions.
 */
const ACTIONABILITY_SCHEMA = {
  type: "object",
  properties: {
    isActionable: {
      type: "boolean",
      description:
        "Whether this content instructs the user to perform testable actions",
    },
    reason: {
      type: "string",
      description:
        "Brief explanation of why the content is or is not actionable",
    },
  },
  required: ["isActionable", "reason"],
};

/**
 * System prompt for classifying content actionability.
 */
const ACTIONABILITY_SYSTEM_PROMPT = `You are a documentation analysis expert. Your task is to determine if a piece of documentation content instructs users to perform testable actions.

Content is ACTIONABLE if it contains instructions for users to:
- Navigate to URLs or web pages
- Click buttons, links, or UI elements
- Type or enter text into forms or fields
- Run shell/terminal commands
- Make HTTP/API requests
- Execute code examples
- Perform specific interactions with a user interface
- Follow step-by-step procedures that can be automated

Content is NOT ACTIONABLE if it:
- Only provides conceptual explanations or background information
- Contains only reference material without procedures
- Discusses features without showing how to use them
- Contains only code snippets shown for illustration without execution instructions
- Is purely descriptive text about architecture or design

Be conservative - only mark content as actionable if there are clear, specific actions a user would perform that can be tested automatically.`;

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

When a partial test is provided:
1. Use it as a starting point for your generated test
2. Fill in any missing required fields (especially steps if empty or incomplete)
3. Expand incomplete steps with appropriate action details based on the documentation
4. Preserve any existing field values from the partial test unless they conflict with the documentation
5. Let the documentation guide what steps should be generated, but respect the partial test's structure

Output a valid Doc Detective test containing steps that verify the documentation.`;

/**
 * Builds the analysis prompt from the provided content and context.
 * @param {Object} options
 * @param {string} options.content - The documentation content to analyze
 * @param {string} [options.filePath] - Path to the source file for context
 * @param {number} [options.maxContentLength] - Maximum content length before truncation
 * @param {Object} [options.test] - Optional partial test to use as starting point
 * @returns {string} The formatted prompt
 */
const buildAnalysisPrompt = ({
  content,
  filePath,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  test,
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

  if (test) {
    prompt += `--- Partial Test (use as starting point) ---\n${JSON.stringify(test, null, 2)}\n--- End Partial Test ---\n\n`;
    prompt +=
      "Complete and expand the partial test above based on the documentation. Fill in missing fields, expand incomplete steps, and add any additional steps needed to verify the documented behavior.";
  } else {
    prompt +=
      "Generate a Doc Detective specification with tests that verify the documented behavior. Include appropriate steps for each testable assertion found in the documentation.";
  }

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
 * Post-processes the AI-generated test to preserve fields from the original partial test.
 * @param {Object} generatedTest - The test generated by the AI
 * @param {Object} [partialTest] - The original partial test provided by the user
 * @returns {Object} The merged test with preserved fields from the partial test
 */
const postProcessTest = (generatedTest, partialTest) => {
  if (!partialTest) {
    return generatedTest;
  }

  const result = { ...generatedTest };

  // Preserve explicitly provided fields from the partial test
  if (partialTest.testId && !result.testId) {
    result.testId = partialTest.testId;
  }
  if (partialTest.sourceLocation) {
    result.sourceLocation = partialTest.sourceLocation;
  }
  if (partialTest.description) {
    result.description = partialTest.description;
  }
  if (partialTest.contentPath) {
    result.contentPath = partialTest.contentPath;
  }
  if (partialTest.detectSteps !== undefined) {
    result.detectSteps = partialTest.detectSteps;
  }
  if (partialTest.runOn) {
    result.runOn = partialTest.runOn;
  }
  if (partialTest.openApi) {
    result.openApi = partialTest.openApi;
  }
  if (partialTest.setup) {
    result.setup = partialTest.setup;
  }
  if (partialTest.cleanup) {
    result.cleanup = partialTest.cleanup;
  }

  return result;
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
 * @param {Object} [options.test] - Optional partial test to use as starting point for generation
 * @returns {Promise<Object>} A promise that resolves to a spec_v3 compatible specification
 * @throws {Error} If content is not provided or generation fails
 *
 * @example
 * const spec = await analyze({
 *   content: "# Getting Started\n\nNavigate to https://example.com...",
 *   filePath: "docs/getting-started.md",
 *   config: { integrations: { anthropic: { apiKey: "sk-..." } } }
 * });
 *
 * @example
 * // With a partial test
 * const spec = await analyze({
 *   content: "# Getting Started\n\nNavigate to https://example.com...",
 *   test: { testId: "my-test", description: "Verify getting started guide" }
 * });
 */
const analyze = async ({
  content,
  filePath,
  config = {},
  model,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  files,
  test,
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
    test,
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

  // Post-process to preserve fields from the partial test
  const finalTest = postProcessTest(result.object, test);

  return finalTest;
};

/**
 * Check if a content chunk is actionable (contains testable instructions).
 *
 * @param {Object} options - Options
 * @param {string} options.content - The chunk content to check
 * @param {string} [options.heading] - The heading of this chunk for context
 * @param {Object} [options.config] - Doc Detective configuration object
 * @returns {Promise<{isActionable: boolean, reason: string}>} Actionability result
 */
const checkActionability = async ({ content, heading, config = {} }) => {
  const prompt = heading
    ? `Analyze the following documentation section titled "${heading}":\n\n${content}`
    : `Analyze the following documentation content:\n\n${content}`;

  try {
    const result = await generate({
      prompt,
      system: ACTIONABILITY_SYSTEM_PROMPT,
      schema: ACTIONABILITY_SCHEMA,
      schemaName: "actionability",
      schemaDescription: "Classification of whether content is actionable",
      config,
    });

    return result.object;
  } catch (error) {
    // On error, assume not actionable to be conservative
    return {
      isActionable: false,
      reason: `Failed to check actionability: ${error.message}`,
    };
  }
};

/**
 * Analyzes a document by breaking it into semantic chunks, identifying actionable content,
 * and generating test specifications for each actionable chunk.
 *
 * @param {Object} options - Analysis options
 * @param {string} options.content - Raw document content to analyze (required)
 * @param {string} options.filePath - Path to the source file (required for format detection)
 * @param {Object} [options.config] - Doc Detective configuration object
 * @param {number} [options.chunkLevel=2] - Heading level to chunk at (1-6, default H2)
 * @param {number} [options.maxContentLength] - Maximum content length per chunk before truncation
 * @param {Array} [options.files] - Optional images/screenshots to include for multimodal analysis
 * @returns {Promise<Object>} A promise that resolves to a spec_v3 compatible specification
 * @throws {Error} If content or filePath is not provided
 *
 * @example
 * const spec = await analyzeDocument({
 *   content: fs.readFileSync('docs/guide.md', 'utf8'),
 *   filePath: 'docs/guide.md',
 *   config: { integrations: { anthropic: { apiKey: "sk-..." } } }
 * });
 */
const analyzeDocument = async ({
  content,
  filePath,
  config = {},
  chunkLevel = 2,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  files,
}) => {
  // Validate required inputs
  if (!content || typeof content !== "string") {
    throw new Error("'content' is required and must be a string.");
  }
  if (!filePath || typeof filePath !== "string") {
    throw new Error("'filePath' is required and must be a string.");
  }

  // Simple logging helper
  const log = (level, message) => {
    const logLevel = config.logLevel || "info";
    const levels = ["error", "warning", "info", "debug"];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);
    if (messageLevelIndex <= currentLevelIndex) {
      console.log(`(${level.toUpperCase()}) ${message}`);
    }
  };

  // Parse document into semantic chunks
  log("info", `Parsing document: ${filePath}`);
  const format = detectFormat(filePath);
  log("debug", `Detected format: ${format}`);

  const chunks = await parseDocument(content, filePath, { chunkLevel });
  log("info", `Found ${chunks.length} chunk(s) in document`);

  if (chunks.length === 0) {
    log("info", "No chunks found in document, returning empty spec");
    const emptySpec = {
      specId: generateId("spec"),
      description: `Generated from ${filePath}`,
      contentPath: filePath,
      tests: [],
    };

    const validation = validate({
      schemaKey: "spec_v3",
      object: emptySpec,
      addDefaults: false,
    });

    // If empty tests array is not valid, we need at least one test
    // But per spec_v3 schema, tests requires minItems: 1
    // Return the spec anyway with a warning
    log("info", "Document produced no actionable chunks");
    return emptySpec;
  }

  // Check actionability for all chunks in parallel
  log("info", "Checking chunk actionability in parallel...");
  const actionabilityResults = await Promise.all(
    chunks.map(async (chunk, index) => {
      try {
        const result = await checkActionability({
          content: chunk.content,
          heading: chunk.heading,
          config,
        });
        return { index, chunk, ...result };
      } catch (error) {
        log(
          "info",
          `Skipping chunk ${index + 1} (actionability check failed): ${error.message}`
        );
        return { index, chunk, isActionable: false, reason: error.message };
      }
    })
  );

  // Filter to actionable chunks
  const actionableChunks = actionabilityResults.filter((r) => r.isActionable);
  log(
    "info",
    `${actionableChunks.length} of ${chunks.length} chunk(s) are actionable`
  );

  if (actionableChunks.length === 0) {
    log("info", "No actionable chunks found, returning spec with empty tests");
    const emptySpec = {
      specId: generateId("spec"),
      description: `Generated from ${filePath}`,
      contentPath: filePath,
      tests: [],
    };
    return emptySpec;
  }

  // Analyze actionable chunks in parallel to generate tests
  log("info", "Generating tests for actionable chunks...");
  const testResults = await Promise.all(
    actionableChunks.map(async ({ index, chunk }) => {
      try {
        // Build description from heading if available
        const description = chunk.heading
          ? `${chunk.heading} - Generated from ${filePath}`
          : `Chunk ${index + 1} - Generated from ${filePath}`;

        const test = await analyze({
          content: chunk.content,
          filePath,
          config,
          maxContentLength,
          files,
          test: {
            description,
            sourceLocation: {
              file: filePath,
              ...chunk.sourceLocation,
              isInline: false,
              isAutoDetected: true,
            },
          },
        });

        return { success: true, test, index };
      } catch (error) {
        log(
          "info",
          `Skipping chunk ${index + 1} (test generation failed): ${error.message}`
        );
        return { success: false, error: error.message, index };
      }
    })
  );

  // Collect successful tests
  const tests = testResults
    .filter((r) => r.success)
    .map((r) => r.test);

  log("info", `Successfully generated ${tests.length} test(s)`);

  // Build the spec
  const spec = {
    specId: generateId("spec"),
    description: `Generated from ${filePath}`,
    contentPath: filePath,
    tests,
  };

  // Validate if we have tests
  if (tests.length > 0) {
    const validation = validate({
      schemaKey: "spec_v3",
      object: spec,
      addDefaults: false,
    });

    if (!validation.valid) {
      log(
        "warning",
        `Generated spec failed validation: ${JSON.stringify(validation.errors)}`
      );
      // Return anyway - caller can decide what to do
    }
  }

  return spec;
};


module.exports = {
  analyze,
  analyzeDocument,
  checkActionability,
  buildAnalysisPrompt,
  postProcessTest,
  ANALYSIS_SYSTEM_PROMPT,
  ACTIONABILITY_SCHEMA,
  ACTIONABILITY_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTENT_LENGTH,
};
