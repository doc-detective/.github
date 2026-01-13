const { schemas } = require("./schemas");
const { validate, transformToSchemaKey } = require("./validate");
const { resolvePaths } = require("./resolvePaths");
const { readFile } = require("./files");
const { generate, detectProvider, getApiKey, DEFAULT_MODEL, MAX_SCHEMA_VALIDATION_RETRIES } = require("./ai");
const { refineStep } = require("./refineStep");
const {
  DEFAULT_OLLAMA_MODEL,
  MODEL_PULL_TIMEOUT_MS,
  OLLAMA_STARTUP_TIMEOUT_MS,
  detectGpuType,
  startOllamaContainer,
  waitForOllama,
  stopOllamaContainer,
  ensureOllamaRunning,
  isOllamaAvailable,
  ensureModelAvailable,
} = require("./ollama");

module.exports = {
  schemas,
  validate,
  resolvePaths,
  readFile,
  transformToSchemaKey,
  generate,
  detectProvider,
  getApiKey,
  isOllamaAvailable,
  DEFAULT_MODEL,
  MAX_SCHEMA_VALIDATION_RETRIES,
  refineStep,
  DEFAULT_OLLAMA_MODEL,
  MODEL_PULL_TIMEOUT_MS,
  OLLAMA_STARTUP_TIMEOUT_MS,
  detectGpuType,
  startOllamaContainer,
  waitForOllama,
  ensureModelAvailable,
  stopOllamaContainer,
  ensureOllamaRunning,
};
