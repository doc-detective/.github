const { generate } = require("./ai");
const { schemas } = require("./schemas");
const { validate } = require("./validate");

const DEFAULT_MAX_CONTEXT_LENGTH = 50000;

/**
 * System prompt for refining Doc Detective steps.
 */
const REFINE_STEP_SYSTEM_PROMPT = `You are a Doc Detective step refinement expert. Your task is to revise a test step to make it pass based on the provided context.

When refining steps:
1. Analyze any failure messages to understand why the step failed
2. Use the provided context (DOM, CLI output, HTTP response, screenshots) to inform corrections
3. Maintain the original intent of the step while fixing issues
4. Prefer precise CSS selectors when fixing element-related steps
5. Ensure all required fields are present and valid
6. If the step type seems wrong for the context, suggest a more appropriate action type

Available action types:
- goTo: Navigate to a URL
- find: Locate an element on the page (can include click, type, moveTo, scroll actions)
- click: Click an element
- type: Type text or send keys
- checkLink: Verify a URL returns acceptable status codes
- httpRequest: Make an HTTP request and validate the response
- runShell: Execute a shell command
- runCode: Execute code in a supported language
- screenshot: Capture a screenshot
- wait: Wait for a specified duration
- saveCookie/loadCookie: Cookie management
- record/stopRecord: Video recording
- loadVariables: Load environment variables
- dragAndDrop: Drag and drop elements

Preserve the stepId and sourceLocation if provided. Return a complete, valid step object.`;

/**
 * Builds the refinement prompt from the provided step and context.
 * @param {Object} options
 * @param {Object} options.step - The step to refine
 * @param {string} [options.sourceContent] - Source documentation content
 * @param {Array} [options.previousSteps] - Previously executed steps
 * @param {string} [options.failureMessage] - Error message if step failed
 * @param {Object} [options.context] - Additional context (DOM, CLI output, HTTP response)
 * @param {number} [options.maxContextLength] - Maximum context length before truncation
 * @returns {string} The formatted prompt
 */
const buildRefinementPrompt = ({
  step,
  sourceContent,
  previousSteps,
  failureMessage,
  context,
  maxContextLength = DEFAULT_MAX_CONTEXT_LENGTH,
}) => {
  const sections = [];

  // Current step
  sections.push("## Step to Refine\n```json\n" + JSON.stringify(step, null, 2) + "\n```");

  // Failure message if present
  if (failureMessage) {
    sections.push("## Failure Message\n" + failureMessage);
  }

  // Source content if present
  if (sourceContent) {
    const truncatedSource = truncateContent(sourceContent, Math.floor(maxContextLength / 3));
    sections.push("## Source Documentation\n" + truncatedSource);
  }

  // Previous steps if present
  if (previousSteps && previousSteps.length > 0) {
    const stepsJson = JSON.stringify(previousSteps, null, 2);
    const truncatedSteps = truncateContent(stepsJson, Math.floor(maxContextLength / 4));
    sections.push("## Previously Executed Steps\n```json\n" + truncatedSteps + "\n```");
  }

  // Additional context
  if (context) {
    const contextSections = [];

    if (context.dom) {
      const truncatedDom = truncateContent(context.dom, Math.floor(maxContextLength / 3));
      contextSections.push("### Browser DOM\n```html\n" + truncatedDom + "\n```");
    }

    if (context.element) {
      const truncatedElement = truncateContent(
        typeof context.element === "string" ? context.element : JSON.stringify(context.element, null, 2),
        Math.floor(maxContextLength / 4)
      );
      contextSections.push("### Target Element\n```\n" + truncatedElement + "\n```");
    }

    if (context.cliOutput) {
      const truncatedCli = truncateContent(context.cliOutput, Math.floor(maxContextLength / 4));
      contextSections.push("### CLI Output\n```\n" + truncatedCli + "\n```");
    }

    if (context.httpResponse) {
      const responseStr = typeof context.httpResponse === "string" 
        ? context.httpResponse 
        : JSON.stringify(context.httpResponse, null, 2);
      const truncatedHttp = truncateContent(responseStr, Math.floor(maxContextLength / 4));
      contextSections.push("### HTTP Response\n```json\n" + truncatedHttp + "\n```");
    }

    if (context.accessibility) {
      const accessStr = typeof context.accessibility === "string"
        ? context.accessibility
        : JSON.stringify(context.accessibility, null, 2);
      const truncatedAccess = truncateContent(accessStr, Math.floor(maxContextLength / 4));
      contextSections.push("### Accessibility Tree\n```\n" + truncatedAccess + "\n```");
    }

    if (contextSections.length > 0) {
      sections.push("## Current Context\n" + contextSections.join("\n\n"));
    }
  }

  sections.push("## Task\nRefine the step above to make it pass based on the provided context. Return only the refined step object.");

  return sections.join("\n\n");
};

/**
 * Truncates content to a maximum length, adding an indicator if truncated.
 * @param {string} content - The content to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} The truncated content
 */
const truncateContent = (content, maxLength) => {
  if (!content || content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + "\n\n[Content truncated...]";
};

/**
 * Refines a Doc Detective step using AI to make it pass the current context.
 *
 * @param {Object} options - Refinement options
 * @param {Object} options.step - The step to refine (required)
 * @param {string} [options.sourceContent] - Source documentation content (recommended)
 * @param {Array} [options.previousSteps] - Previously executed steps for context
 * @param {string} [options.failureMessage] - Error message if the step failed previously
 * @param {Object} [options.context] - Additional context object
 * @param {string} [options.context.dom] - Browser DOM snapshot
 * @param {string|Object} [options.context.element] - Specific element information
 * @param {string} [options.context.cliOutput] - CLI command output
 * @param {string|Object} [options.context.httpResponse] - HTTP response data
 * @param {string|Object} [options.context.accessibility] - Accessibility tree snapshot
 * @param {Object} [options.config] - Doc Detective configuration object
 * @param {Object} [options.config.integrations] - Integration configurations
 * @param {Object} [options.config.integrations.anthropic] - Anthropic configuration
 * @param {string} [options.config.integrations.anthropic.apiKey] - Anthropic API key
 * @param {Object} [options.config.integrations.openai] - OpenAI configuration
 * @param {string} [options.config.integrations.openai.apiKey] - OpenAI API key
 * @param {Object} [options.config.ai] - Legacy AI configuration (deprecated, use integrations)
 * @param {string} [options.config.ai.model] - LLM model to use
 * @param {string} [options.config.ai.apiKey] - API key for the LLM provider (deprecated)
 * @param {string} [options.config.ai.baseURL] - Base URL for the LLM provider
 * @param {string} [options.model] - LLM model override (takes precedence over config)
 * @param {Array} [options.files] - Screenshots or images for multimodal analysis
 * @param {number} [options.maxContextLength] - Maximum context length before truncation (default: 50000)
 * @returns {Promise<Object>} A promise that resolves to a refined step_v3 compatible step
 * @throws {Error} If step is not provided or refinement fails
 *
 * @example
 * const refinedStep = await refineStep({
 *   step: { find: { selector: ".old-class" } },
 *   failureMessage: "Element not found: .old-class",
 *   context: { dom: "<html>...</html>" },
 *   config: { integrations: { anthropic: { apiKey: "sk-..." } } }
 * });
 */
const refineStep = async ({
  step,
  sourceContent,
  previousSteps,
  failureMessage,
  context,
  config = {},
  model,
  files,
  maxContextLength = DEFAULT_MAX_CONTEXT_LENGTH,
}) => {
  // Validate required input
  if (!step || typeof step !== "object") {
    throw new Error("'step' is required and must be an object.");
  }

  // Extract AI configuration (support both legacy config.ai and new config.integrations)
  const aiConfig = {};
  const resolvedModel = model || aiConfig.model;
  const baseURL = aiConfig.baseURL;

  // Build the prompt
  const prompt = buildRefinementPrompt({
    step,
    sourceContent,
    previousSteps,
    failureMessage,
    context,
    maxContextLength,
  });

  // Get the step schema for structured output
  // Wrap the step schema in an object to move anyOf/oneOf down a level
  // This is required because Anthropic's API doesn't support anyOf/oneOf/allOf at the top level
  const stepSchema = schemas.step_v3;

  // Generate the refined step using AI
  // Pass config for integrations API keys, generate() will extract the right one
  const result = await generate({
    prompt,
    system: REFINE_STEP_SYSTEM_PROMPT,
    schema: stepSchema,
    schemaName: "step",
    schemaDescription: "An object containing a Doc Detective test step",
    model: resolvedModel,
    config,
    baseURL,
    files,
  });

  // Extract the step from the wrapper and post-process
  const refinedStep = postProcessStep(result.object, step);

  // Validate the step against the schema
  const validation = validate({schemaKey: "step_v3", object: refinedStep});
  if (!validation.valid) {
    throw new Error(`Refined step failed validation: ${JSON.stringify(validation.errors)}`);
  }

  return refinedStep;
};

/**
 * Post-processes the refined step to preserve original metadata.
 * @param {Object} refinedStep - The AI-generated refined step
 * @param {Object} originalStep - The original step
 * @returns {Object} The post-processed step
 */
const postProcessStep = (refinedStep, originalStep) => {
  // Preserve stepId from original if present and not in refined
  if (originalStep?.stepId && !refinedStep?.stepId) {
    refinedStep.stepId = originalStep.stepId;
  }

  // Preserve sourceLocation from original if present
  if (originalStep?.sourceLocation && !refinedStep?.sourceLocation) {
    refinedStep.sourceLocation = originalStep.sourceLocation;
  }

  return refinedStep;
};

module.exports = {
  refineStep,
  buildRefinementPrompt,
  truncateContent,
  REFINE_STEP_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTEXT_LENGTH,
};
