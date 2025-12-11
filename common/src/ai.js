const { generateText, generateObject, jsonSchema } = require("ai");
const { createOpenAI } = require("@ai-sdk/openai");
const { createAnthropic } = require("@ai-sdk/anthropic");
const { createOllama } = require("ollama-ai-provider-v2");
const { z } = require("zod");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const DEFAULT_MODEL = "ollama/qwen3-vl:2b";
const OLLAMA_AVAILABILITY_TIMEOUT_MS = 500;
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/api";
const MAX_SCHEMA_VALIDATION_RETRIES = 3;

/**
 * Maps our supported model enums to the model identifiers that platforms expect.
 */
const modelMap = {
  // Anthropic models
  "anthropic/claude-haiku-4.5": "claude-haiku-4-5",
  "anthropic/claude-sonnet-4.5": "claude-sonnet-4-5",
  "anthropic/claude-opus-4.5": "claude-opus-4-5",
  // OpenAI models
  "openai/gpt-5.1": "gpt-5.1",
  "openai/gpt-5-mini": "gpt-5-mini",
  "openai/gpt-5-nano": "gpt-5-nano",
  // Ollama models
  "ollama/qwen3-vl:2b": "qwen3-vl:2b",
  "ollama/qwen3-vl": "qwen3-vl",
};

/**
 * Checks if Ollama is available at localhost:11434.
 * @param {string} [baseUrl] - Optional base URL override.
 * @returns {Promise<boolean>} True if Ollama is available.
 */
const isOllamaAvailable = async (baseUrl) => {
  const url = baseUrl || "http://localhost:11434";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_AVAILABILITY_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const getDefaultProvider = async (config) => {
  // Try Ollama first (local, no API key needed)
  const ollamaBaseUrl = config.integrations?.ollama?.baseUrl;
  if (await isOllamaAvailable(ollamaBaseUrl)) {
    return {
      provider: "ollama",
      model: "qwen3-vl:2b",
      apiKey: null,
      baseURL: ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
    };
  }
  
  // Try to detect from environment variables if no model is provided
  if (process.env.ANTHROPIC_API_KEY || config.integrations?.anthropic) {
    return {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKey: process.env.ANTHROPIC_API_KEY || config.integrations.anthropic.apiKey,
    };
  } else if (process.env.OPENAI_API_KEY || config.integrations?.openAi) {
    return {
      provider: "openai",
      model: "gpt-5-mini",
      apiKey: process.env.OPENAI_API_KEY || config.integrations.openAi.apiKey,
    };
  } else {
    return { provider: null, model: null, apiKey: null };
  }
};

/**
 * Detects the provider, model, and API from a model string and environment variables.
 * @param {Object} config - The Doc Detective configuration object.
 * @param {string} model - The model identifier.
 * @returns {Promise<{ provider: "openai" | "anthropic" | "ollama" | null, model: string | null, apiKey: string | null, baseURL?: string }>} The detected provider, model, and API key.
 */
const detectProvider = async (config, model) => {
  const detectedModel = modelMap[model] || null;
  if (!detectedModel) return getDefaultProvider(config);

  if (model.startsWith("ollama/")) {
    const ollamaBaseUrl = config.integrations?.ollama?.baseUrl || DEFAULT_OLLAMA_BASE_URL;
    return { provider: "ollama", model: detectedModel, apiKey: null, baseURL: ollamaBaseUrl };
  }

  if (model.startsWith("anthropic/") && (process.env.ANTHROPIC_API_KEY || config.integrations?.anthropic)) {
    const apiKey = process.env.ANTHROPIC_API_KEY || config.integrations.anthropic.apiKey;
    return { provider: "anthropic", model: detectedModel, apiKey };
  }

  if (model.startsWith("openai/") && (process.env.OPENAI_API_KEY || config.integrations?.openAi)) {
    const apiKey = process.env.OPENAI_API_KEY || config.integrations.openAi.apiKey;
    return { provider: "openai", model: detectedModel, apiKey };
  }

  return { provider: null, model: null };
};

/**
 * Creates a provider instance based on the provider name.
 * @param {Object} options
 * @param {"openai" | "anthropic" | "ollama"} options.provider - The provider name.
 * @param {string} [options.apiKey] - Optional API key override.
 * @param {string} [options.baseURL] - Optional base URL override.
 * @returns {Function} The provider factory function.
 */
const createProvider = ({ provider, apiKey, baseURL }) => {
  if (provider === "ollama") {
    const options = {};
    if (baseURL) options.baseURL = baseURL;
    return createOllama(options);
  }

  if (provider === "openai") {
    const options = {};
    if (apiKey) options.apiKey = apiKey;
    if (baseURL) options.baseURL = baseURL;
    return createOpenAI(options);
  }

  if (provider === "anthropic") {
    const options = {};
    if (apiKey) options.apiKey = apiKey;
    if (baseURL) options.baseURL = baseURL;
    return createAnthropic(options);
  }

  throw new Error(`Unsupported provider: ${provider}`);
};

/**
 * Converts a file object to AI SDK image part format.
 * @param {Object} file - The file object.
 * @param {string} file.type - The file type (e.g., "image").
 * @param {string} file.data - Base64 data or URL.
 * @param {string} [file.mimeType] - The MIME type (e.g., "image/png").
 * @returns {Object} The AI SDK image part.
 */
const fileToImagePart = (file) => {
  if (file.type !== "image") {
    throw new Error(
      `Unsupported file type: ${file.type}. Only "image" is supported.`
    );
  }

  // Check if data is a URL
  const isUrl =
    file.data.startsWith("http://") || file.data.startsWith("https://");

  if (isUrl) {
    return {
      type: "image",
      image: new URL(file.data),
    };
  }

  // Base64 data
  return {
    type: "image",
    image: file.data,
    mimeType: file.mimeType,
  };
};

/**
 * Builds message content from prompt and files.
 * @param {Object} options
 * @param {string} options.prompt - The text prompt.
 * @param {Array} [options.files] - Optional array of file objects.
 * @returns {string | Array} The message content.
 */
const buildMessageContent = ({ prompt, files }) => {
  if (!files || files.length === 0) {
    return prompt;
  }

  const parts = [];

  // Add text part
  parts.push({ type: "text", text: prompt });

  // Add file parts
  for (const file of files) {
    parts.push(fileToImagePart(file));
  }

  return parts;
};

/**
 * Checks if a schema is a Zod schema.
 * @param {Object} schema - The schema to check.
 * @returns {boolean} True if the schema is a Zod schema.
 */
const isZodSchema = (schema) => {
  return schema && typeof schema.safeParse === "function";
};

/**
 * Validates an object against a Zod schema.
 * @param {Object} object - The object to validate.
 * @param {z.ZodSchema} schema - The Zod schema.
 * @returns {{ valid: boolean, errors: string | null, object: Object }} Validation result.
 */
const validateAgainstZodSchema = (object, schema) => {
  const result = schema.safeParse(object);

  if (result.success) {
    return { valid: true, errors: null, object: result.data };
  }

  const errors = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");

  return { valid: false, errors, object };
};

/**
 * Validates an object against a JSON schema.
 * @param {Object} object - The object to validate.
 * @param {Object} schema - The JSON schema.
 * @returns {{ valid: boolean, errors: string | null, object: Object }} Validation result.
 */
const validateAgainstJsonSchema = (object, schema) => {
  const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    coerceTypes: true,
    strict: false,
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(object);

  if (valid) {
    return { valid: true, errors: null, object };
  }

  const errors = validate.errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join(", ");

  return { valid: false, errors, object };
};

/**
 * Validates an object against a schema (Zod or JSON schema).
 * @param {Object} object - The object to validate.
 * @param {z.ZodSchema | Object} schema - The Zod or JSON schema.
 * @returns {{ valid: boolean, errors: string | null, object: Object }} Validation result.
 */
const validateAgainstSchema = (object, schema) => {
  if (isZodSchema(schema)) {
    return validateAgainstZodSchema(object, schema);
  }
  return validateAgainstJsonSchema(object, schema);
};

/**
 * Converts a schema to the format expected by the AI SDK.
 * Zod schemas are passed directly; JSON schemas are wrapped with jsonSchema().
 * @param {z.ZodSchema | Object} schema - The Zod or JSON schema.
 * @returns {Object} The schema in AI SDK format.
 */
const toAiSdkSchema = (schema) => {
  if (isZodSchema(schema)) {
    return schema;
  }
  return jsonSchema(schema);
};

/**
 * Extracts the API key for a provider from a Doc Detective config object.
 * @param {Object} config - The Doc Detective configuration object.
 * @param {"openai" | "anthropic"} provider - The provider name.
 * @returns {string | undefined} The API key if found.
 */
const getApiKey = (config, provider) => {
  if (!config || !config.integrations) return undefined;

  if (
    provider === "anthropic" &&
    (process.env.ANTHROPIC_API_KEY || config.integrations.anthropic)
  ) {
    return (
      process.env.ANTHROPIC_API_KEY || config.integrations.anthropic.apiKey
    );
  }

  if (
    provider === "openai" &&
    (process.env.OPENAI_API_KEY || config.integrations.openai)
  ) {
    return process.env.OPENAI_API_KEY || config.integrations.openai.apiKey;
  }

  return undefined;
};

/**
 * Generates text or structured output using an AI model.
 *
 * @param {Object} options - Generation options.
 * @param {string} [options.prompt] - The text prompt (required if messages not provided).
 * @param {Array} [options.messages] - Array of messages for multi-turn conversation.
 * @param {Array} [options.files] - Array of file objects to include (e.g., images).
 * @param {string} [options.files[].type] - File type ("image").
 * @param {string} [options.files[].data] - Base64 data or URL.
 * @param {string} [options.files[].mimeType] - MIME type (e.g., "image/png").
 * @param {string} [options.model] - Model identifier (default: "anthropic/claude-haiku-4.5").
 * @param {string} [options.system] - System message.
 * @param {z.ZodSchema | Object} [options.schema] - Zod schema or JSON schema for structured output.
 * @param {string} [options.schemaName] - Name for the schema (used in API calls).
 * @param {string} [options.schemaDescription] - Description for the schema.
 * @param {"openai" | "anthropic"} [options.provider] - Explicit provider override.
 * @param {Object} [options.config] - Doc Detective config object with integrations.anthropic/openai API keys.
 * @param {string} [options.apiKey] - API key override (takes precedence over config and env vars).
 * @param {string} [options.baseURL] - Base URL override for the provider.
 * @param {number} [options.temperature] - Temperature for generation.
 * @param {number} [options.maxTokens] - Maximum tokens to generate.
 * @returns {Promise<Object>} Generation result.
 * @returns {string} [result.text] - Generated text (when no schema provided).
 * @returns {Object} [result.object] - Generated object (when schema provided).
 * @returns {Object} result.usage - Token usage information.
 * @returns {string} result.finishReason - Why generation stopped.
 *
 * @throws {Error} If prompt/messages is missing or provider cannot be determined.
 */
const generate = async ({
  prompt,
  messages,
  files,
  model,
  system,
  schema,
  schemaName,
  schemaDescription,
  provider,
  config = {},
  apiKey,
  baseURL,
  temperature,
  maxTokens,
}) => {
  // Validate required input
  if (!prompt && (!messages || messages.length === 0)) {
    throw new Error("Either 'prompt' or 'messages' is required.");
  }

  // Determine provider, model, and API key
  const detected = await detectProvider(config, model);

  if (!detected.provider) {
    throw new Error(
      `Cannot determine provider for model "${model}". Please specify a 'provider' option ("openai" or "anthropic").`
    );
  }

  // Create provider instance
  const providerFactory = createProvider({
    provider: detected.provider,
    apiKey: detected.apiKey,
    baseURL,
  });

  // Get model instance
  const modelInstance = providerFactory(detected.model);

  // Build generation options
  const generationOptions = {
    model: modelInstance,
  };

  // Add system message if provided
  if (system) {
    generationOptions.system = system;
  }

  // Add temperature if provided
  if (temperature !== undefined) {
    generationOptions.temperature = temperature;
  }

  // Add maxTokens if provided
  if (maxTokens !== undefined) {
    generationOptions.maxTokens = maxTokens;
  }

  // Build messages or prompt
  if (messages && messages.length > 0) {
    // Find the index of the last user message
    const lastUserIndex = messages.findLastIndex((msg) => msg.role === "user");

    // Use messages array, attaching files only to the last user message
    generationOptions.messages = messages.map((msg, index) => {
      if (index === lastUserIndex && files && files.length > 0) {
        return {
          ...msg,
          content: buildMessageContent({ prompt: msg.content, files }),
        };
      }
      return msg;
    });
  } else if (files && files.length > 0) {
    // When files are provided, we must use messages format for multimodal content
    generationOptions.messages = [
      {
        role: "user",
        content: buildMessageContent({ prompt, files }),
      },
    ];
  } else {
    // Use simple prompt for text-only requests
    generationOptions.prompt = prompt;
  }

  // Handle structured output with schema
  if (schema) {
    return generateWithSchemaValidation({
      generationOptions,
      schema,
      schemaName,
      schemaDescription,
      prompt,
      messages,
    });
  }

  // Generate text
  const result = await generateText(generationOptions);

  return {
    text: result.text,
    usage: result.usage,
    finishReason: result.finishReason,
  };
};

/**
 * Generates structured output with schema validation and retry logic.
 * @param {Object} options
 * @param {Object} options.generationOptions - AI SDK generation options.
 * @param {z.ZodSchema | Object} options.schema - Zod schema or JSON schema for validation.
 * @param {string} [options.schemaName] - Name for the schema.
 * @param {string} [options.schemaDescription] - Description for the schema.
 * @param {string} [options.prompt] - Original prompt for retry context.
 * @param {Array} [options.messages] - Original messages for retry context.
 * @returns {Promise<Object>} Generation result with validated object.
 */
const generateWithSchemaValidation = async ({
  generationOptions,
  schema,
  schemaName,
  schemaDescription,
  prompt,
  messages,
}) => {
  let lastError = null;
  let lastObject = null;
  let wrappedSchema = false;

  // If JSON schema with allOf/anyOf/oneOf at the top level, wrap it in an object
  if (!isZodSchema(schema) && (schema.allOf || schema.anyOf || schema.oneOf)) {
    schema = {
      type: "object",
      properties: {
        object: schema,
      },
      required: ["object"],
      additionalProperties: false,
    };
    wrappedSchema = true;
  }

  // Convert schema to AI SDK format (wraps JSON schemas with jsonSchema())
  const aiSdkSchema = toAiSdkSchema(schema);

  for (let attempt = 1; attempt <= MAX_SCHEMA_VALIDATION_RETRIES; attempt++) {
    const objectOptions = {
      ...generationOptions,
      schema: aiSdkSchema,
    };

    if (schemaName) {
      objectOptions.schemaName = schemaName;
    }

    if (schemaDescription) {
      objectOptions.schemaDescription = schemaDescription;
    }

    // Add retry context if this is a retry attempt
    if (attempt > 1 && lastError) {
      const retryMessage = `Previous attempt failed schema validation with errors: ${lastError}. Please fix these issues and try again.`;

      if (objectOptions.messages) {
        // Add retry context to messages
        objectOptions.messages = [
          ...objectOptions.messages,
          { role: "assistant", content: JSON.stringify(lastObject) },
          { role: "user", content: retryMessage },
        ];
      } else if (typeof objectOptions.prompt === "string") {
        // Add retry context to prompt
        objectOptions.prompt = `${objectOptions.prompt}\n\n${retryMessage}`;
      }
    }

    try {
      const result = await generateObject(objectOptions);

      const validationObject = wrappedSchema
        ? result.object.object
        : result.object;
      const validationSchema = wrappedSchema
        ? schema.properties.object
        : schema;

      // Validate the generated object against the schema ourselves
      const validation = validateAgainstSchema(
        validationObject,
        validationSchema
      );

      if (validation.valid) {
        return {
          object: validationObject,
          usage: result.usage,
          finishReason: result.finishReason,
        };
      }

      // Schema validation failed, store error for retry
      lastError = validation.errors;
      lastObject = result.object;

      if (attempt === MAX_SCHEMA_VALIDATION_RETRIES) {
        throw new Error(
          `Schema validation failed after ${MAX_SCHEMA_VALIDATION_RETRIES} attempts. Last errors: ${validation.errors}`
        );
      }
    } catch (error) {
      // If it's our validation error and we have retries left, continue
      if (
        error.message.includes("Schema validation failed after") ||
        attempt === MAX_SCHEMA_VALIDATION_RETRIES
      ) {
        throw error;
      }

      // Store the error and retry
      lastError = error.message;
      lastObject = null;
    }
  }

  throw new Error(
    `Schema validation failed after ${MAX_SCHEMA_VALIDATION_RETRIES} attempts. Last errors: ${lastError}`
  );
};

module.exports = {
  generate,
  detectProvider,
  getApiKey,
  isOllamaAvailable,
  modelMap,
  DEFAULT_MODEL,
  MAX_SCHEMA_VALIDATION_RETRIES,
};
