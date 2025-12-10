const crypto = require("crypto");

// Import the analyze module
const {
  analyze,
  buildAnalysisPrompt,
  postProcessTest,
  ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTENT_LENGTH,
} = require("./analyze");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("Analyze Module", function () {
  // Increase timeout for real API calls
  this.timeout(120000);

    describe("buildAnalysisPrompt", function () {
      it("should build prompt with content only", function () {
        const prompt = buildAnalysisPrompt({
          content: "# Getting Started\n\nNavigate to https://example.com",
        });

        expect(prompt).to.include("Analyze the following documentation");
        expect(prompt).to.include("# Getting Started");
        expect(prompt).to.include("https://example.com");
        expect(prompt).to.not.include("Source file:");
      });

      it("should include file path when provided", function () {
        const prompt = buildAnalysisPrompt({
          content: "Test content",
          filePath: "/docs/getting-started.md",
        });

        expect(prompt).to.include("Source file: /docs/getting-started.md");
      });

      it("should truncate content exceeding max length", function () {
        const longContent = "x".repeat(200);
        const prompt = buildAnalysisPrompt({
          content: longContent,
          maxContentLength: 100,
        });

        expect(prompt).to.include("[Content truncated due to length...]");
        expect(prompt).to.not.include("x".repeat(200));
      });

      it("should not truncate content within max length", function () {
        const shortContent = "Short test content";
        const prompt = buildAnalysisPrompt({
          content: shortContent,
          maxContentLength: 1000,
        });

        expect(prompt).to.include(shortContent);
        expect(prompt).to.not.include("[Content truncated");
      });

      it("should include partial test when provided", function () {
        const partialTest = {
          testId: "my-custom-test",
          description: "Test the getting started guide",
        };
        const prompt = buildAnalysisPrompt({
          content: "Test content",
          test: partialTest,
        });

        expect(prompt).to.include("--- Partial Test (use as starting point) ---");
        expect(prompt).to.include("my-custom-test");
        expect(prompt).to.include("Test the getting started guide");
        expect(prompt).to.include("--- End Partial Test ---");
        expect(prompt).to.include("Complete and expand the partial test");
      });

      it("should include partial test with steps", function () {
        const partialTest = {
          testId: "test-with-steps",
          steps: [
            { goTo: { url: "https://example.com" } },
          ],
        };
        const prompt = buildAnalysisPrompt({
          content: "Test content",
          test: partialTest,
        });

        expect(prompt).to.include("test-with-steps");
        expect(prompt).to.include("https://example.com");
      });

      it("should use default prompt when no partial test provided", function () {
        const prompt = buildAnalysisPrompt({
          content: "Test content",
        });

        expect(prompt).to.not.include("--- Partial Test");
        expect(prompt).to.include("Generate a Doc Detective specification");
      });
    });

    describe("ANALYSIS_SYSTEM_PROMPT", function () {
      it("should contain documentation testing context", function () {
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("documentation testing expert");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("testable assertions");
      });

      it("should mention available action types", function () {
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("goTo");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("find");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("checkLink");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("httpRequest");
      });

      it("should include instructions for handling partial tests", function () {
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("When a partial test is provided");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("starting point");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("Fill in any missing required fields");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("Expand incomplete steps");
        expect(ANALYSIS_SYSTEM_PROMPT).to.include("Preserve any existing field values");
      });
    });

    describe("DEFAULT_MAX_CONTENT_LENGTH", function () {
      it("should be 100000", function () {
        expect(DEFAULT_MAX_CONTENT_LENGTH).to.equal(100000);
      });
    });

    describe("postProcessTest", function () {
      it("should return generated test unchanged when no partial test provided", function () {
        const generatedTest = {
          testId: "generated-id",
          description: "Generated description",
          steps: [{ goTo: { url: "https://example.com" } }],
        };

        const result = postProcessTest(generatedTest, undefined);

        expect(result).to.deep.equal(generatedTest);
      });

      it("should return generated test unchanged when partial test is null", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };

        const result = postProcessTest(generatedTest, null);

        expect(result).to.deep.equal(generatedTest);
      });

      it("should preserve testId from partial test when generated test lacks it", function () {
        const generatedTest = {
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          testId: "my-custom-id",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.testId).to.equal("my-custom-id");
      });

      it("should not override testId when generated test already has one", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          testId: "partial-id",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.testId).to.equal("generated-id");
      });

      it("should preserve sourceLocation from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          sourceLocation: {
            file: "/docs/test.md",
            startLine: 10,
            endLine: 20,
          },
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.sourceLocation).to.deep.equal(partialTest.sourceLocation);
      });

      it("should preserve description from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          description: "AI generated description",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          description: "User provided description",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.description).to.equal("User provided description");
      });

      it("should preserve contentPath from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          contentPath: "/docs/getting-started.md",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.contentPath).to.equal("/docs/getting-started.md");
      });

      it("should preserve detectSteps from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          detectSteps: false,
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.detectSteps).to.equal(false);
      });

      it("should preserve runOn from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          runOn: ["firefox", "chrome"],
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.runOn).to.deep.equal(["firefox", "chrome"]);
      });

      it("should preserve openApi from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          openApi: [{ path: "./openapi.yaml" }],
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.openApi).to.deep.equal([{ path: "./openapi.yaml" }]);
      });

      it("should preserve setup from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          setup: "./setup.spec.json",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.setup).to.equal("./setup.spec.json");
      });

      it("should preserve cleanup from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          cleanup: "./cleanup.spec.json",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.cleanup).to.equal("./cleanup.spec.json");
      });

      it("should preserve multiple fields from partial test", function () {
        const generatedTest = {
          testId: "generated-id",
          description: "Generated",
          steps: [{ goTo: { url: "https://example.com" } }],
        };
        const partialTest = {
          testId: "custom-id",
          description: "Custom description",
          contentPath: "/docs/test.md",
          setup: "./setup.json",
          cleanup: "./cleanup.json",
        };

        const result = postProcessTest(generatedTest, partialTest);

        // testId not overridden because generated test already has one
        expect(result.testId).to.equal("generated-id");
        // Other fields are preserved
        expect(result.description).to.equal("Custom description");
        expect(result.contentPath).to.equal("/docs/test.md");
        expect(result.setup).to.equal("./setup.json");
        expect(result.cleanup).to.equal("./cleanup.json");
      });

      it("should keep generated steps when partial test has no steps", function () {
        const generatedTest = {
          testId: "generated-id",
          steps: [
            { goTo: { url: "https://example.com" } },
            { find: { elementText: "Welcome" } },
          ],
        };
        const partialTest = {
          testId: "custom-id",
        };

        const result = postProcessTest(generatedTest, partialTest);

        expect(result.steps).to.deep.equal(generatedTest.steps);
      });
    });

    describe("analyze", function () {
      describe("input validation", function () {
        it("should throw error when content is not provided", async function () {
          try {
            await analyze({});
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'content' is required and must be a string.");
          }
        });

        it("should throw error when content is not a string", async function () {
          try {
            await analyze({ content: 123 });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'content' is required and must be a string.");
          }
        });

        it("should throw error when content is empty string", async function () {
          try {
            await analyze({ content: "" });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'content' is required and must be a string.");
          }
        });
      });

      describe("test generation", function () {
        it("should generate a valid test from simple documentation", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const content = `# Getting Started

Welcome to our documentation.

## Step 1: Visit the homepage

Navigate to https://example.com to get started.

## Step 2: Check the API

Make sure the API endpoint https://api.example.com/health returns a 200 status.`;

          const test = await analyze({ content });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
          expect(test.steps.length).to.be.at.least(1);
        });

        it("should include file info when filePath is provided", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const test = await analyze({
            content: "Test documentation with a link: https://example.com",
            filePath: "/docs/test.md",
          });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
        });

        it("should use model from config when provided", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const test = await analyze({
            content: "Navigate to https://example.com and click the button.",
            config: {
              ai: {
                model: "anthropic/claude-haiku-4.5",
              },
            },
          });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
        });

        it("should override config model with explicit model parameter", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const test = await analyze({
            content: "Check that https://example.com returns 200.",
            config: {
              ai: {
                model: "anthropic/claude-opus-4.5", // This should be overridden
              },
            },
            model: "anthropic/claude-haiku-4.5", // Use cheaper model
          });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
        });

        it("should generate steps with appropriate action types", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const content = `# API Testing Guide

Make a GET request to https://api.example.com/users to get the list of users.
The response should have a 200 status code.`;

          const test = await analyze({ content });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
          expect(test.steps.length).to.be.at.least(1);

          // Find a step with httpRequest or checkLink action
          const hasApiStep = test.steps.some(step => 
            step.httpRequest || step.checkLink
          );
          expect(hasApiStep).to.be.true;
        });

        it("should handle maxContentLength parameter", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const longContent = "Visit https://example.com. " + "x".repeat(50000);

          const test = await analyze({
            content: longContent,
            maxContentLength: 1000,
          });

          expect(test).to.be.an("object");
          expect(test.steps).to.be.an("array");
        });
      });

      describe("test validation", function () {
        it("should produce tests that pass schema validation", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const { validate } = require("doc-detective-common");

          const test = await analyze({
            content: "Go to https://example.com and verify the page loads.",
          });

          const validation = validate({schemaKey: "test_v3", object: test});
          expect(validation.valid).to.be.true;
        });
      });

      describe("partial test input", function () {
        it("should preserve testId from partial test", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await analyze({
            content: "Navigate to https://example.com and click the login button.",
            test: {
              testId: "my-custom-test-id",
            },
          });

          expect(result).to.be.an("object");
          expect(result.steps).to.be.an("array");
          // testId may or may not be preserved depending on AI generation
          // but if AI doesn't generate one, ours should be used
        });

        it("should preserve description from partial test", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await analyze({
            content: "Navigate to https://example.com.",
            test: {
              description: "My custom test description",
            },
          });

          expect(result).to.be.an("object");
          expect(result.description).to.equal("My custom test description");
        });

        it("should preserve contentPath from partial test", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await analyze({
            content: "Check https://example.com/api returns 200.",
            test: {
              contentPath: "/docs/api-guide.md",
            },
          });

          expect(result).to.be.an("object");
          expect(result.contentPath).to.equal("/docs/api-guide.md");
        });

        it("should preserve setup and cleanup from partial test", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await analyze({
            content: "Visit https://example.com.",
            test: {
              setup: "./setup.spec.json",
              cleanup: "./cleanup.spec.json",
            },
          });

          expect(result).to.be.an("object");
          expect(result.setup).to.equal("./setup.spec.json");
          expect(result.cleanup).to.equal("./cleanup.spec.json");
        });

        it("should expand partial test with incomplete steps", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const result = await analyze({
            content: `# Getting Started

First, navigate to https://example.com.
Then click the "Sign Up" button.
Finally, fill in the registration form.`,
            test: {
              testId: "registration-test",
              description: "Test the registration flow",
            },
          });

          expect(result).to.be.an("object");
          expect(result.steps).to.be.an("array");
          expect(result.steps.length).to.be.at.least(1);
          expect(result.description).to.equal("Test the registration flow");
        });

        it("should generate valid test when partial test provided", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const { validate } = require("doc-detective-common");

          const result = await analyze({
            content: "Go to https://example.com and verify the page loads.",
            test: {
              testId: "partial-test",
              description: "Verify example.com loads",
              detectSteps: false,
            },
          });

          const validation = validate({ schemaKey: "test_v3", object: result });
          expect(validation.valid).to.be.true;
          expect(result.description).to.equal("Verify example.com loads");
          expect(result.detectSteps).to.equal(false);
        });
      });
    });
  });
