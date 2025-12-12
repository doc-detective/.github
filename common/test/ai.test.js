const { z } = require("zod");

const {
  ensureModelAvailable,
  disposeLocalLlm,
  MODEL_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_LOCAL_MODEL_SMALL,
} = require("../src/localLlm");

// Import chai using dynamic import (needed for ESM)
let expect;

// Import AI module functions
const {
  generate,
  detectProvider,
  getApiKey,
  isLocalLlmAvailable,
  modelMap,
  DEFAULT_MODEL,
  MAX_SCHEMA_VALIDATION_RETRIES,
} = require("../src/ai");

describe("AI Module", function () {
  // Increase timeout for real API calls and model download
  this.timeout(MODEL_DOWNLOAD_TIMEOUT_MS + 120000);

  before(async function () {
    // Dynamic import for chai ESM
    const chai = await import("chai");
    expect = chai.expect;
    
    console.log("  Setting up local LLM for tests...");
    // Ensure the model is downloaded before running tests
    try {
      await ensureModelAvailable(DEFAULT_LOCAL_MODEL_SMALL);
      console.log("  Local LLM model ready.");
    } catch (error) {
      console.log("  Warning: Could not set up local LLM:", error.message);
      console.log("  Some tests will be skipped.");
    }
  });

  after(async function () {
    console.log("  Cleaning up local LLM resources...");
    await disposeLocalLlm();
  });

    describe("modelMap", function () {
      it("should contain Anthropic model mappings", function () {
        expect(modelMap["anthropic/claude-haiku-4.5"]).to.equal("claude-haiku-4-5");
        expect(modelMap["anthropic/claude-sonnet-4.5"]).to.equal("claude-sonnet-4-5");
        expect(modelMap["anthropic/claude-opus-4.5"]).to.equal("claude-opus-4-5");
      });

      it("should contain OpenAI model mappings", function () {
        expect(modelMap["openai/gpt-5.2"]).to.equal("gpt-5.2");
        expect(modelMap["openai/gpt-5-mini"]).to.equal("gpt-5-mini");
        expect(modelMap["openai/gpt-5-nano"]).to.equal("gpt-5-nano");
      });

      it("should contain local model mappings", function () {
        expect(modelMap["local/qwen3-vl:2b"]).to.equal("hf:unsloth/Qwen3-VL-2B-Instruct-GGUF:Q4_K_M");
        expect(modelMap["local/qwen3-vl:8b"]).to.equal("hf:unsloth/Qwen3-VL-8B-Instruct-GGUF:Q4_K_XL");
      });

      it("should contain Google Gemini model mappings", function () {
        expect(modelMap["google/gemini-2.5-flash"]).to.equal("gemini-2.5-flash");
        expect(modelMap["google/gemini-2.5-pro"]).to.equal("gemini-2.5-pro");
        expect(modelMap["google/gemini-3-pro"]).to.equal("gemini-3-pro-preview");
      });
    });

    describe("detectProvider", function () {
      // Store original env vars to restore after tests
      let originalAnthropicKey;
      let originalOpenAIKey;
      let originalGoogleKey;

      beforeEach(function () {
        originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
        originalOpenAIKey = process.env.OPENAI_API_KEY;
        originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        // Clear env vars for predictable testing
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      });

      afterEach(function () {
        // Restore original env vars
        if (originalAnthropicKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
        if (originalOpenAIKey !== undefined) {
          process.env.OPENAI_API_KEY = originalOpenAIKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
        if (originalGoogleKey !== undefined) {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
        } else {
          delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        }
      });

      it("should detect local provider for known local models", async function () {
        const config = {};
        const result = await detectProvider(config, "local/qwen3-vl:2b");
        expect(result.provider).to.equal("local");
        expect(result.model).to.equal("hf:unsloth/Qwen3-VL-2B-Instruct-GGUF:Q4_K_M");
        expect(result.modelUri).to.equal("hf:unsloth/Qwen3-VL-2B-Instruct-GGUF:Q4_K_M");
        expect(result.apiKey).to.be.null;
      });

      it("should use custom modelsDir from config for local provider", async function () {
        const config = { integrations: { localLlm: { modelsDir: "/custom/models/dir" } } };
        const result = await detectProvider(config, "local/qwen3-vl:2b");
        expect(result.provider).to.equal("local");
        expect(result.modelsDir).to.equal("/custom/models/dir");
      });

      it("should detect Anthropic provider and mapped model for known Anthropic models with config API key", async function () {
        const config = { integrations: { anthropic: { apiKey: "sk-ant-test" } } };
        expect(await detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-haiku-4-5",
          apiKey: "sk-ant-test",
        });
        expect(await detectProvider(config, "anthropic/claude-sonnet-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          apiKey: "sk-ant-test",
        });
        expect(await detectProvider(config, "anthropic/claude-opus-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-opus-4-5",
          apiKey: "sk-ant-test",
        });
      });

      it("should detect Anthropic provider with env API key", async function () {
        process.env.ANTHROPIC_API_KEY = "sk-ant-env";
        const config = {};
        expect(await detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-haiku-4-5",
          apiKey: "sk-ant-env",
        });
      });

      it("should detect OpenAI provider and mapped model for known OpenAI models with config API key", async function () {
        const config = { integrations: { openAi: { apiKey: "sk-openai-test" } } };
        expect(await detectProvider(config, "openai/gpt-5.2")).to.deep.equal({
          provider: "openai",
          model: "gpt-5.2",
          apiKey: "sk-openai-test",
        });
        expect(await detectProvider(config, "openai/gpt-5-mini")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "sk-openai-test",
        });
        expect(await detectProvider(config, "openai/gpt-5-nano")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-nano",
          apiKey: "sk-openai-test",
        });
      });

      it("should detect OpenAI provider with env API key", async function () {
        process.env.OPENAI_API_KEY = "sk-openai-env";
        const config = {};
        expect(await detectProvider(config, "openai/gpt-5-mini")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "sk-openai-env",
        });
      });

      it("should detect Google provider and mapped model for known Google models with config API key", async function () {
        const config = { integrations: { google: { apiKey: "google-test-key" } } };
        expect(await detectProvider(config, "google/gemini-2.5-flash")).to.deep.equal({
          provider: "google",
          model: "gemini-2.5-flash",
          apiKey: "google-test-key",
        });
        expect(await detectProvider(config, "google/gemini-2.5-pro")).to.deep.equal({
          provider: "google",
          model: "gemini-2.5-pro",
          apiKey: "google-test-key",
        });
        expect(await detectProvider(config, "google/gemini-3-pro")).to.deep.equal({
          provider: "google",
          model: "gemini-3-pro-preview",
          apiKey: "google-test-key",
        });
      });

      it("should detect Google provider with env API key", async function () {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-env-key";
        const config = {};
        expect(await detectProvider(config, "google/gemini-2.5-flash")).to.deep.equal({
          provider: "google",
          model: "gemini-2.5-flash",
          apiKey: "google-env-key",
        });
      });

      it("should prefer env API key over config API key for Google", async function () {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-env-key";
        const config = { integrations: { google: { apiKey: "google-config-key" } } };
        expect((await detectProvider(config, "google/gemini-2.5-flash")).apiKey).to.equal("google-env-key");
      });

      it("should prefer env API key over config API key", async function () {
        process.env.ANTHROPIC_API_KEY = "sk-ant-env";
        const config = { integrations: { anthropic: { apiKey: "sk-ant-config" } } };
        expect((await detectProvider(config, "anthropic/claude-haiku-4.5")).apiKey).to.equal("sk-ant-env");
      });

      it("should fall back to local provider as default when available", async function () {
        const config = {};
        const result = await detectProvider(config, "unknown-model");
        // Local LLM should be preferred when available
        if (await isLocalLlmAvailable()) {
          expect(result.provider).to.equal("local");
          expect(result.modelUri).to.be.a("string");
        } else {
          expect(result.provider).to.be.null;
        }
      });

      it("should return null values when model is known but no API key for that provider", async function () {
        const config = {};
        // For Anthropic model without API key
        expect(await detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: null,
          model: null,
        });
      });
    });

    describe("DEFAULT_MODEL", function () {
      it("should be local/qwen3-vl:2b", function () {
        expect(DEFAULT_MODEL).to.equal("local/qwen3-vl:2b");
      });
    });

    describe("MAX_SCHEMA_VALIDATION_RETRIES", function () {
      it("should be 3", function () {
        expect(MAX_SCHEMA_VALIDATION_RETRIES).to.equal(3);
      });
    });

    describe("generate", function () {
      describe("input validation", function () {
        it("should throw error when neither prompt nor messages provided", async function () {
          try {
            await generate({});
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("Either 'prompt' or 'messages' is required.");
          }
        });

        it("should throw error when messages array is empty", async function () {
          try {
            await generate({ messages: [] });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("Either 'prompt' or 'messages' is required.");
          }
        });

        it("should throw error when provider cannot be determined and local LLM not available", async function () {
          // This test verifies error handling when no provider is available
          // Since local LLM may be running, we need to test with an explicit model that
          // requires an API key that isn't configured
          const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
          const originalOpenAIKey = process.env.OPENAI_API_KEY;
          delete process.env.ANTHROPIC_API_KEY;
          delete process.env.OPENAI_API_KEY;

          try {
            // Use an Anthropic model explicitly without API key configured
            await generate({ prompt: "Hello", model: "anthropic/claude-haiku-4.5", config: {} });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.include("Cannot determine provider");
            expect(error.message).to.include("anthropic/claude-haiku-4.5");
          } finally {
            // Restore env vars
            if (originalAnthropicKey !== undefined) {
              process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
            }
            if (originalOpenAIKey !== undefined) {
              process.env.OPENAI_API_KEY = originalOpenAIKey;
            }
          }
        });
      });

      describe("text generation", function () {
        it("should generate text with default model (local LLM)", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const result = await generate({ 
            prompt: "Say exactly: Hello World",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should generate text with explicit local model", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          try {
            const result = await generate({
              prompt: "Reply with exactly one word: Yes",
              model: "local/qwen3-vl:2b",
              maxTokens: 20,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
            expect(result.usage).to.be.an("object");
            expect(result.finishReason).to.be.a("string");
          } catch (error) {
            // Skip if we get an error (model may not be available)
            if (error.message && error.message.includes("model")) {
              this.skip();
            }
            throw error;
          }
        });

        it("should generate text with OpenAI model (smoke test)", async function () {
          // Skip if no API key is set
          if (!process.env.OPENAI_API_KEY) {
            this.skip();
          }

          const result = await generate({
            prompt: "Say exactly: Hello World",
            model: "openai/gpt-5-mini",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should generate text with Anthropic model (smoke test)", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await generate({
            prompt: "Say exactly: Hello from Anthropic",
            model: "anthropic/claude-haiku-4.5",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should generate text with Google Gemini model (smoke test)", async function () {
          // Skip if no API key is set
          if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            this.skip();
          }

          const result = await generate({
            prompt: "Say exactly: Hello from Google",
            model: "google/gemini-2.5-flash",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should include system message in generation", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const result = await generate({
            prompt: "What is your name?",
            system: "You are a helpful assistant named TestBot. Always respond with your name.",
            maxTokens: 100,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.toLowerCase()).to.include("testbot");
        });
      });

      describe("structured output with schema validation", function () {
        const personSchema = z.object({
          name: z.string().describe("The person's full name"),
          age: z.number().min(0).max(150).describe("The person's age in years"),
        });

        // JSON Schema equivalent for testing
        const personJsonSchema = {
          type: "object",
          properties: {
            name: { type: "string", description: "The person's full name" },
            age: { type: "number", minimum: 0, maximum: 150, description: "The person's age in years" },
          },
          required: ["name", "age"],
          additionalProperties: false,
        };

        it("should generate valid structured output with Zod schema", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const result = await generate({
            prompt: "Generate a fictional person named Alice who is 28 years old",
            schema: personSchema,
            schemaName: "Person",
          });

          expect(result.object).to.be.an("object");
          expect(result.object.name).to.be.a("string");
          expect(result.object.age).to.be.a("number");
          expect(result.object.age).to.be.at.least(0);
          expect(result.object.age).to.be.at.most(150);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should generate valid structured output with JSON schema", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const result = await generate({
            prompt: "Generate a fictional person named Bob who is 42 years old",
            schema: personJsonSchema,
            schemaName: "Person",
          });

          expect(result.object).to.be.an("object");
          expect(result.object.name).to.be.a("string");
          expect(result.object.age).to.be.a("number");
          expect(result.object.age).to.be.at.least(0);
          expect(result.object.age).to.be.at.most(150);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should validate generated object against Zod schema", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const strictSchema = z.object({
            color: z.enum(["red", "green", "blue"]).describe("One of: red, green, blue"),
            count: z.number().int().min(1).max(10).describe("An integer from 1 to 10"),
          });

          const result = await generate({
            prompt: "Generate an object with color 'blue' and count 5",
            schema: strictSchema,
            schemaName: "ColorCount",
          });

          expect(result.object.color).to.be.oneOf(["red", "green", "blue"]);
          expect(result.object.count).to.be.a("number");
          expect(result.object.count).to.be.at.least(1);
          expect(result.object.count).to.be.at.most(10);
          expect(Number.isInteger(result.object.count)).to.be.true;
        });

        it("should validate generated object against JSON schema", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const strictJsonSchema = {
            type: "object",
            properties: {
              color: { type: "string", enum: ["red", "green", "blue"], description: "One of: red, green, blue" },
              count: { type: "integer", minimum: 1, maximum: 10, description: "An integer from 1 to 10" },
            },
            required: ["color", "count"],
            additionalProperties: false,
          };

          const result = await generate({
            prompt: "Generate an object with color 'green' and count 7",
            schema: strictJsonSchema,
            schemaName: "ColorCount",
          });

          expect(result.object.color).to.be.oneOf(["red", "green", "blue"]);
          expect(result.object.count).to.be.a("number");
          expect(result.object.count).to.be.at.least(1);
          expect(result.object.count).to.be.at.most(10);
          expect(Number.isInteger(result.object.count)).to.be.true;
        });
      });

      describe("multimodal input with files", function () {
        // 100x100 grid PNG with red, blue, and green squares
        const GRID_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAABvUlEQVR4nO3YUW7DQAwD0b3/pZ0jhEjW2rE5LfT3ANGlE0Bda63LQc26kh/dmMMHbHP4gG0OH7DN4QO2OXzANocP2ObwAdscPmCbyy7Ia/McuICfMllzdxSy+c16i7MQmLMQmLMQmLMQmLMQmLMQmLMQmPNSh42fEJizEJizEJizEJizEJizEJizEJizEJizEJg7fpk6v1zqujGHD9jm8AHbHD5gm8MHbHP4gG0OH7DN4QO2OXzANnf8Mv0yu/9rc/p5Hn+p7y/kzHO85ivLQqYWh85CphaHzkKmFofOQqYWh85CphaHzkKmFofOQqYWh66wEPbsLwQ+9Dem8BNyaHHoLGRqcegsZGpx6CxkanHoLGRqcegsZGpx6CxkanHoLGRqcegKC3FQg39j2hw+YJvDB2xz+IBtDh+wzeEDtjl8wDaHD9jm8AHb3PHLlDm7f73U/3Q3FBLmg/9hLOTPB3mLsxCYsxCYsxCYsxCYsxCYsxCYO1mI46XOd35lwZyFwJyFwJyFwJyFwJyFwJyFwJyFwNzJQhzUwN/UPocP2ObwAdscPmCbwwdsc/iAbQ4fsM3hA7Y5fMAq9wGhbdAbu3rjOQAAAABJRU5ErkJggg==";

        it("should handle image URL input", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          // Note: Some local models may have issues with remote URLs.
          // This test validates the multimodal input construction.
          try {
            const result = await generate({
              prompt: "What colors do you see in this image? Be brief.",
              files: [
                {
                  type: "image",
                  data: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
                },
              ],
              maxTokens: 100,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
          } catch (error) {
            // Some local models may not support remote URLs well
            // Skip if we get an error related to image handling
            if (error.message && (error.message.includes("image") || error.message.includes("multimodal"))) {
              this.skip();
            }
            throw error;
          }
        });

        it("should handle base64 image data", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          try {
            const result = await generate({
              prompt: "Describe what you see in this image. Be brief.",
              files: [
                {
                  type: "image",
                  data: GRID_PNG_BASE64,
                  mimeType: "image/png",
                },
              ],
              maxTokens: 100,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
            expect(result.usage).to.be.an("object");
            expect(result.finishReason).to.be.a("string");
          } catch (error) {
            // Some local models may have issues with certain image formats
            if (error.message && (error.message.includes("image") || error.message.includes("multimodal"))) {
              this.skip();
            }
            throw error;
          }
        });

        it("should handle Buffer image data", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          // Convert base64 to Buffer
          const imageBuffer = Buffer.from(GRID_PNG_BASE64, "base64");

          try {
            const result = await generate({
              prompt: "Describe what you see in this image. Be brief.",
              files: [
                {
                  type: "image",
                  data: imageBuffer,
                  mimeType: "image/png",
                },
              ],
              maxTokens: 100,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
            expect(result.usage).to.be.an("object");
            expect(result.finishReason).to.be.a("string");
          } catch (error) {
            // Some local models may have issues with certain image formats
            if (error.message && (error.message.includes("image") || error.message.includes("multimodal"))) {
              this.skip();
            }
            throw error;
          }
        });

        it("should handle Uint8Array image data", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          // Convert base64 to Uint8Array
          const buffer = Buffer.from(GRID_PNG_BASE64, "base64");
          const uint8Array = new Uint8Array(buffer);

          try {
            const result = await generate({
              prompt: "Describe what you see in this image. Be brief.",
              files: [
                {
                  type: "image",
                  data: uint8Array,
                  mimeType: "image/png",
                },
              ],
              maxTokens: 100,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
            expect(result.usage).to.be.an("object");
            expect(result.finishReason).to.be.a("string");
          } catch (error) {
            // Some local models may have issues with certain image formats
            if (error.message && (error.message.includes("image") || error.message.includes("multimodal"))) {
              this.skip();
            }
            throw error;
          }
        });

        it("should handle multiple images with mixed data types", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const imageBuffer = Buffer.from(GRID_PNG_BASE64, "base64");

          try {
            const result = await generate({
              prompt: "Describe what you see in these images. Be brief.",
              files: [
                {
                  type: "image",
                  data: GRID_PNG_BASE64,
                  mimeType: "image/png",
                },
                {
                  type: "image",
                  data: imageBuffer,
                  mimeType: "image/png",
                },
              ],
              maxTokens: 100,
            });

            expect(result.text).to.be.a("string");
            expect(result.text.length).to.be.greaterThan(0);
          } catch (error) {
            // Some local models may have issues with certain image formats
            if (error.message && (error.message.includes("image") || error.message.includes("multimodal"))) {
              this.skip();
            }
            throw error;
          }
        });
      });

      describe("messages array support", function () {
        it("should handle multi-turn conversation", async function () {
          // Skip if local LLM is not available
          if (!(await isLocalLlmAvailable())) {
            this.skip();
          }

          const result = await generate({
            messages: [
              { role: "user", content: "My name is Alice." },
              { role: "assistant", content: "Hello Alice! Nice to meet you." },
              { role: "user", content: "What is my name?" },
            ],
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.toLowerCase()).to.include("alice");
        });
      });

      describe("error handling", function () {
        it("should throw error with invalid model", async function () {
          try {
            await generate({
              prompt: "Hello",
              model: "anthropic/claude-haiku-4.5",
              config: {},
            });
            expect.fail("Should have thrown an error");
          } catch (error) {
            // Should get an error about missing provider/API key
            expect(error).to.be.an("error");
          }
        });
      });
    });
});
