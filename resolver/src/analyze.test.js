const crypto = require("crypto");

(async () => {
  const { expect } = await import("chai");
  const sinon = await import("sinon");

  // Import the analyze module
  const {
    analyze,
    buildAnalysisPrompt,
    ANALYSIS_SYSTEM_PROMPT,
    DEFAULT_MAX_CONTENT_LENGTH,
  } = require("./analyze");

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
    });

    describe("DEFAULT_MAX_CONTENT_LENGTH", function () {
      it("should be 100000", function () {
        expect(DEFAULT_MAX_CONTENT_LENGTH).to.equal(100000);
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
    });
  });
})();
