const { z } = require("zod");

(async () => {
  const { expect } = await import("chai");
  
  // Import AI module functions
  const {
    generate,
    detectProvider,
    detectModel,
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
    });

    describe("detectModel", function () {
      it("should return mapped model for known models", function () {
        expect(detectModel("anthropic/claude-haiku-4.5")).to.equal("claude-haiku-4-5");
        expect(detectModel("anthropic/claude-sonnet-4.5")).to.equal("claude-sonnet-4-5");
        expect(detectModel("anthropic/claude-opus-4.5")).to.equal("claude-opus-4-5");
      });

      it("should return null for unknown models", function () {
        expect(detectModel("unknown-model")).to.be.null;
        expect(detectModel("openai/gpt-4")).to.be.null;
      });

      it("should return null for empty or null input", function () {
        expect(detectModel("")).to.be.null;
        expect(detectModel(null)).to.be.null;
        expect(detectModel(undefined)).to.be.null;
      });
    });

    describe("detectProvider", function () {
      it("should detect OpenAI for gpt- models", function () {
        expect(detectProvider("openai/gpt-4")).to.deep.equal({ provider: "openai", model: null });
        expect(detectProvider("openai/gpt-3.5-turbo")).to.deep.equal({ provider: "openai", model: null });
        expect(detectProvider("openai/gpt-4o")).to.deep.equal({ provider: "openai", model: null });
      });

      it("should detect OpenAI for o1/o3 models", function () {
        expect(detectProvider("openai/o1-preview")).to.deep.equal({ provider: "openai", model: null });
        expect(detectProvider("openai/o1-mini")).to.deep.equal({ provider: "openai", model: null });
        expect(detectProvider("openai/o3-mini")).to.deep.equal({ provider: "openai", model: null });
      });

      it("should detect Anthropic for claude- models", function () {
        expect(detectProvider("anthropic/claude-3-5-haiku-latest")).to.deep.equal({ provider: "anthropic", model: null });
        expect(detectProvider("anthropic/claude-3-opus-20240229")).to.deep.equal({ provider: "anthropic", model: null });
        expect(detectProvider("anthropic/claude-3-sonnet-20240229")).to.deep.equal({ provider: "anthropic", model: null });
      });

      it("should detect Anthropic and return mapped model for known models", function () {
        expect(detectProvider("anthropic/claude-haiku-4.5")).to.deep.equal({ provider: "anthropic", model: "claude-haiku-4-5" });
        expect(detectProvider("anthropic/claude-sonnet-4.5")).to.deep.equal({ provider: "anthropic", model: "claude-sonnet-4-5" });
        expect(detectProvider("anthropic/claude-opus-4.5")).to.deep.equal({ provider: "anthropic", model: "claude-opus-4-5" });
      });

      it("should return null provider and model for unknown models", function () {
        expect(detectProvider("unknown-model")).to.deep.equal({ provider: null, model: null });
        expect(detectProvider("gemini-pro")).to.deep.equal({ provider: null, model: null });
        expect(detectProvider("llama-2")).to.deep.equal({ provider: null, model: null });
      });

      it("should return null provider and model for empty or null input", function () {
        expect(detectProvider("")).to.deep.equal({ provider: null, model: null });
        expect(detectProvider(null)).to.deep.equal({ provider: null, model: null });
        expect(detectProvider(undefined)).to.deep.equal({ provider: null, model: null });
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
          try {
            await generate({ prompt: "Hello", model: "unknown-model" });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.include("Cannot determine provider");
            expect(error.message).to.include("unknown-model");
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
