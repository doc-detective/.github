const fs = require("fs");
const os = require("os");
const path = require("path");

/** Default local model URI (Qwen3-VL 8B for multimodal support) */
const DEFAULT_LOCAL_MODEL = "hf:unsloth/Qwen3-VL-8B-Instruct-GGUF:Q4_K_XL";

/** Smaller model for testing */
const DEFAULT_LOCAL_MODEL_SMALL = "hf:unsloth/Qwen3-VL-2B-Instruct-GGUF:Q4_K_M";

/** Maximum time to wait for model download (15 minutes) */
const MODEL_DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

/** Cached llama instance for reuse */
let cachedLlama = null;

/** Cached model instances by path */
const cachedModels = new Map();

/** Cached sessions by model path */
const cachedSessions = new Map();

/**
 * Gets the models directory path, creating it if it doesn't exist.
 * @param {string} [customDir] - Optional custom directory override.
 * @returns {string} The models directory path.
 */
const getModelsDir = (customDir) => {
  const modelsDir = customDir || path.join(os.tmpdir(), "doc-detective", "models");
  
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  
  return modelsDir;
};

/**
 * Dynamically imports node-llama-cpp (ESM module).
 * @returns {Promise<Object>} The node-llama-cpp module.
 */
const importNodeLlamaCpp = async () => {
  return import("node-llama-cpp");
};

/**
 * Gets or creates a cached Llama instance.
 * @returns {Promise<Object>} The Llama instance.
 */
const getLlamaInstance = async () => {
  if (cachedLlama) {
    return cachedLlama;
  }
  
  const { getLlama } = await importNodeLlamaCpp();
  cachedLlama = await getLlama();
  return cachedLlama;
};

/**
 * Checks if the local LLM is available (node-llama-cpp can initialize).
 * @returns {Promise<boolean>} True if local LLM is available.
 */
const isLocalLlmAvailable = async () => {
  try {
    await getLlamaInstance();
    return true;
  } catch {
    return false;
  }
};

/**
 * Ensures a model is available locally, downloading if necessary.
 * @param {string} [modelUri=DEFAULT_LOCAL_MODEL] - The model URI (e.g., "hf:user/model:quant").
 * @param {string} [modelsDir] - Optional custom models directory.
 * @returns {Promise<string>} The local path to the model file.
 */
const ensureModelAvailable = async (modelUri = DEFAULT_LOCAL_MODEL, modelsDir) => {
  const { resolveModelFile } = await importNodeLlamaCpp();
  const dir = getModelsDir(modelsDir);
  
  console.log(`    Ensuring model available: ${modelUri}`);
  console.log(`    Models directory: ${dir}`);
  
  const modelPath = await resolveModelFile(modelUri, dir, {
    cli: true, // Show download progress in console
  });
  
  console.log(`    Model ready at: ${modelPath}`);
  return modelPath;
};

/**
 * Loads a model from the given path, using cache if available.
 * @param {string} modelPath - The path to the model file.
 * @returns {Promise<Object>} The loaded model instance.
 */
const loadModel = async (modelPath) => {
  if (cachedModels.has(modelPath)) {
    return cachedModels.get(modelPath);
  }
  
  const llama = await getLlamaInstance();
  const model = await llama.loadModel({ modelPath });
  cachedModels.set(modelPath, model);
  return model;
};

/**
 * Creates a chat session for the given model.
 * @param {string} modelPath - The path to the model file.
 * @returns {Promise<Object>} An object with session and related utilities.
 */
const createLocalSession = async (modelPath) => {
  if (cachedSessions.has(modelPath)) {
    return cachedSessions.get(modelPath);
  }
  
  const { LlamaChatSession } = await importNodeLlamaCpp();
  const model = await loadModel(modelPath);
  const context = await model.createContext();
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  });
  
  const sessionData = { model, context, session };
  cachedSessions.set(modelPath, sessionData);
  return sessionData;
};

/**
 * Converts a file object to the format expected by node-llama-cpp for multimodal input.
 * @param {Object} llama - The Llama instance.
 * @param {Object} file - The file object.
 * @param {string} file.type - The file type (e.g., "image").
 * @param {string | Buffer | Uint8Array} file.data - Base64 string, URL, Buffer, or Uint8Array.
 * @param {string} [file.mimeType] - The MIME type (e.g., "image/png").
 * @returns {Promise<Object>} The image object for node-llama-cpp.
 */
const fileToLlamaImage = async (llama, file) => {
  if (file.type !== "image") {
    throw new Error(`Unsupported file type: ${file.type}. Only "image" is supported.`);
  }

  // Convert data to Buffer if needed
  let imageBuffer;
  if (Buffer.isBuffer(file.data)) {
    imageBuffer = file.data;
  } else if (file.data instanceof Uint8Array) {
    imageBuffer = Buffer.from(file.data);
  } else if (typeof file.data === "string") {
    if (file.data.startsWith("http://") || file.data.startsWith("https://")) {
      // URL - fetch and convert to buffer
      const response = await fetch(file.data);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      // Assume base64
      imageBuffer = Buffer.from(file.data, "base64");
    }
  } else {
    throw new Error("Unsupported image data format");
  }

  // Create image using llama's createImage helper if available
  // For now, return buffer that can be used with vision models
  return { type: "image", data: imageBuffer };
};

/**
 * Generates text or structured output using a local LLM.
 * @param {Object} options - Generation options.
 * @param {string} [options.prompt] - The text prompt.
 * @param {Array} [options.messages] - Array of messages for conversation.
 * @param {Array} [options.files] - Array of file objects (e.g., images for multimodal).
 * @param {string} [options.modelPath] - Path to the model file.
 * @param {string} [options.modelUri] - Model URI to download if modelPath not provided.
 * @param {string} [options.system] - System message.
 * @param {Object} [options.schema] - JSON schema for structured output.
 * @param {string} [options.modelsDir] - Custom models directory.
 * @param {number} [options.temperature] - Temperature for generation.
 * @param {number} [options.maxTokens] - Maximum tokens to generate.
 * @returns {Promise<Object>} Generation result with text or object.
 */
const generateWithLocalLlm = async ({
  prompt,
  messages,
  files,
  modelPath,
  modelUri = DEFAULT_LOCAL_MODEL,
  system,
  schema,
  modelsDir,
  temperature,
  maxTokens,
}) => {
  // Ensure model is available
  const resolvedModelPath = modelPath || await ensureModelAvailable(modelUri, modelsDir);
  
  // Create session
  const { session, model } = await createLocalSession(resolvedModelPath);
  const llama = await getLlamaInstance();
  
  // Build the prompt from messages if provided
  let finalPrompt = prompt || "";
  if (messages && messages.length > 0) {
    // Extract the last user message as the prompt
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      finalPrompt = lastUserMessage.content;
    }
  }
  
  // Add system message prefix if provided
  if (system && finalPrompt) {
    finalPrompt = `${system}\n\n${finalPrompt}`;
  }
  
  // Build prompt options
  const promptOptions = {};
  
  if (temperature !== undefined) {
    promptOptions.temperature = temperature;
  }
  
  if (maxTokens !== undefined) {
    promptOptions.maxTokens = maxTokens;
  }
  
  // Handle multimodal input (images)
  if (files && files.length > 0) {
    const images = [];
    for (const file of files) {
      if (file.type === "image") {
        const llamaImage = await fileToLlamaImage(llama, file);
        images.push(llamaImage);
      }
    }
    if (images.length > 0) {
      // Note: The exact API for passing images may vary based on node-llama-cpp version
      // This is a placeholder for the multimodal handling
      promptOptions.images = images;
    }
  }
  
  // Handle structured output with JSON schema
  if (schema) {
    try {
      const grammar = await llama.createGrammarForJsonSchema(schema);
      promptOptions.grammar = grammar;
      
      const response = await session.prompt(finalPrompt, promptOptions);
      const parsedObject = grammar.parse(response);
      
      return {
        object: parsedObject,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // Token tracking not easily available
        finishReason: "stop",
      };
    } catch (grammarError) {
      // If grammar creation fails, try without grammar and parse manually
      console.warn("Grammar creation failed, attempting without structured output:", grammarError.message);
      const response = await session.prompt(finalPrompt, promptOptions);
      
      try {
        const parsedObject = JSON.parse(response);
        return {
          object: parsedObject,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      } catch {
        throw new Error(`Failed to generate structured output: ${grammarError.message}`);
      }
    }
  }
  
  // Generate text response
  const response = await session.prompt(finalPrompt, promptOptions);
  
  return {
    text: response,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "stop",
  };
};

/**
 * Disposes of cached resources (models, sessions, llama instance).
 * Call this when done with local LLM to free memory.
 * @returns {Promise<void>}
 */
const disposeLocalLlm = async () => {
  // Dispose sessions
  for (const [, { session, context }] of cachedSessions) {
    try {
      if (context && typeof context.dispose === "function") {
        await context.dispose();
      }
    } catch {
      // Ignore disposal errors
    }
  }
  cachedSessions.clear();
  
  // Dispose models
  for (const [, model] of cachedModels) {
    try {
      if (model && typeof model.dispose === "function") {
        await model.dispose();
      }
    } catch {
      // Ignore disposal errors
    }
  }
  cachedModels.clear();
  
  // Dispose llama instance
  if (cachedLlama && typeof cachedLlama.dispose === "function") {
    try {
      await cachedLlama.dispose();
    } catch {
      // Ignore disposal errors
    }
  }
  cachedLlama = null;
};

module.exports = {
  DEFAULT_LOCAL_MODEL,
  DEFAULT_LOCAL_MODEL_SMALL,
  MODEL_DOWNLOAD_TIMEOUT_MS,
  getModelsDir,
  isLocalLlmAvailable,
  ensureModelAvailable,
  loadModel,
  createLocalSession,
  generateWithLocalLlm,
  disposeLocalLlm,
};
