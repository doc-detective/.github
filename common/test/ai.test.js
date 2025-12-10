const { z } = require("zod");

(async () => {
  const { expect } = await import("chai");
  
  // Import AI module functions
  const {
    generate,
    detectProvider,
    getApiKey,
    modelMap,
    DEFAULT_MODEL,
    MAX_SCHEMA_VALIDATION_RETRIES,
  } = require("../src/ai");

  describe("AI Module", function () {
    // Increase timeout for real API calls
    this.timeout(60000);

    describe("modelMap", function () {
      it("should contain Anthropic model mappings", function () {
        expect(modelMap["anthropic/claude-haiku-4.5"]).to.equal("claude-haiku-4-5");
        expect(modelMap["anthropic/claude-sonnet-4.5"]).to.equal("claude-sonnet-4-5");
        expect(modelMap["anthropic/claude-opus-4.5"]).to.equal("claude-opus-4-5");
      });

      it("should contain OpenAI model mappings", function () {
        expect(modelMap["openai/gpt-5.1"]).to.equal("gpt-5.1");
        expect(modelMap["openai/gpt-5-mini"]).to.equal("gpt-5-mini");
        expect(modelMap["openai/gpt-5-nano"]).to.equal("gpt-5-nano");
      });
    });

    describe("detectProvider", function () {
      // Store original env vars to restore after tests
      let originalAnthropicKey;
      let originalOpenAIKey;

      beforeEach(function () {
        originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
        originalOpenAIKey = process.env.OPENAI_API_KEY;
        // Clear env vars for predictable testing
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENAI_API_KEY;
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
      });

      it("should detect Anthropic provider and mapped model for known Anthropic models with config API key", function () {
        const config = { integrations: { anthropic: { apiKey: "sk-ant-test" } } };
        expect(detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-haiku-4-5",
          apiKey: "sk-ant-test",
        });
        expect(detectProvider(config, "anthropic/claude-sonnet-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          apiKey: "sk-ant-test",
        });
        expect(detectProvider(config, "anthropic/claude-opus-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-opus-4-5",
          apiKey: "sk-ant-test",
        });
      });

      it("should detect Anthropic provider with env API key", function () {
        process.env.ANTHROPIC_API_KEY = "sk-ant-env";
        const config = {};
        expect(detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: "anthropic",
          model: "claude-haiku-4-5",
          apiKey: "sk-ant-env",
        });
      });

      it("should detect OpenAI provider and mapped model for known OpenAI models with config API key", function () {
        const config = { integrations: { openAi: { apiKey: "sk-openai-test" } } };
        expect(detectProvider(config, "openai/gpt-5.1")).to.deep.equal({
          provider: "openai",
          model: "gpt-5.1",
          apiKey: "sk-openai-test",
        });
        expect(detectProvider(config, "openai/gpt-5-mini")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "sk-openai-test",
        });
        expect(detectProvider(config, "openai/gpt-5-nano")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-nano",
          apiKey: "sk-openai-test",
        });
      });

      it("should detect OpenAI provider with env API key", function () {
        process.env.OPENAI_API_KEY = "sk-openai-env";
        const config = {};
        expect(detectProvider(config, "openai/gpt-5-mini")).to.deep.equal({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "sk-openai-env",
        });
      });

      it("should prefer env API key over config API key", function () {
        process.env.ANTHROPIC_API_KEY = "sk-ant-env";
        const config = { integrations: { anthropic: { apiKey: "sk-ant-config" } } };
        expect(detectProvider(config, "anthropic/claude-haiku-4.5").apiKey).to.equal("sk-ant-env");
      });

      it("should fall back to default provider when model is not in modelMap", function () {
        process.env.ANTHROPIC_API_KEY = "sk-ant-env";
        const config = {};
        const result = detectProvider(config, "unknown-model");
        expect(result.provider).to.equal("anthropic");
        expect(result.model).to.equal("claude-haiku-4-5");
        expect(result.apiKey).to.equal("sk-ant-env");
      });

      it("should return null values when no API key is available and model is unknown", function () {
        const config = {};
        expect(detectProvider(config, "unknown-model")).to.deep.equal({
          provider: null,
          model: null,
          apiKey: null,
        });
      });

      it("should return null values when model is known but no API key for that provider", function () {
        const config = {};
        expect(detectProvider(config, "anthropic/claude-haiku-4.5")).to.deep.equal({
          provider: null,
          model: null,
        });
      });
    });

    describe("DEFAULT_MODEL", function () {
      it("should be anthropic/claude-haiku-4.5", function () {
        expect(DEFAULT_MODEL).to.equal("anthropic/claude-haiku-4.5");
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

        it("should throw error when provider cannot be determined", async function () {
          // Save and clear env vars to ensure no fallback provider
          const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
          const originalOpenAIKey = process.env.OPENAI_API_KEY;
          delete process.env.ANTHROPIC_API_KEY;
          delete process.env.OPENAI_API_KEY;

          try {
            await generate({ prompt: "Hello", model: "unknown-model", config: {} });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.include("Cannot determine provider");
            expect(error.message).to.include("unknown-model");
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
        it("should generate text with default model (Anthropic)", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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

        it("should generate text with OpenAI model", async function () {
          // Skip if no API key is set
          if (!process.env.OPENAI_API_KEY) {
            this.skip();
          }

          const result = await generate({
            prompt: "Say exactly: Hello World",
            model: "openai/gpt-4o-mini",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
          expect(result.usage).to.be.an("object");
          expect(result.finishReason).to.be.a("string");
        });

        it("should generate text with explicit provider override", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await generate({
            prompt: "Say exactly: Test",
            model: "anthropic/claude-haiku-4.5",
            provider: "anthropic",
            maxTokens: 50,
          });

          expect(result.text).to.be.a("string");
          expect(result.text.length).to.be.greaterThan(0);
        });

        it("should include system message in generation", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
        it("should handle image URL input", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

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
        });
      });

      describe("messages array support", function () {
        it("should handle multi-turn conversation", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
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
        it("should throw error with invalid API key", async function () {
          try {
            await generate({
              prompt: "Hello",
              apiKey: "invalid-api-key",
            });
            expect.fail("Should have thrown an error");
          } catch (error) {
            // Should get an authentication error
            expect(error).to.be.an("error");
          }
        });
      });
    });
  });
})();
