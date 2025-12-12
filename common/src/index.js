const { schemas } = require("./schemas");
const { validate, transformToSchemaKey } = require("./validate");
const { resolvePaths } = require("./resolvePaths");
const { readFile } = require("./files");
const { generate, detectProvider, getApiKey, isLocalLlmAvailable, DEFAULT_MODEL, MAX_SCHEMA_VALIDATION_RETRIES } = require("./ai");
const { refineStep } = require("./refineStep");
const {
  DEFAULT_LOCAL_MODEL,
  DEFAULT_LOCAL_MODEL_SMALL,
  MODEL_DOWNLOAD_TIMEOUT_MS,
  getModelsDir,
  ensureModelAvailable,
  loadModel,
  createLocalSession,
  generateWithLocalLlm,
  disposeLocalLlm,
} = require("./localLlm");

module.exports = {
  schemas,
  validate,
  resolvePaths,
  readFile,
  transformToSchemaKey,
  generate,
  detectProvider,
  getApiKey,
  isLocalLlmAvailable,
  DEFAULT_MODEL,
  MAX_SCHEMA_VALIDATION_RETRIES,
  refineStep,
  DEFAULT_LOCAL_MODEL,
  DEFAULT_LOCAL_MODEL_SMALL,
  MODEL_DOWNLOAD_TIMEOUT_MS,
  getModelsDir,
  ensureModelAvailable,
  loadModel,
  createLocalSession,
  generateWithLocalLlm,
  disposeLocalLlm,
};
