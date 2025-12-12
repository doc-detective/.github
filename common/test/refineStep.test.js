// Import the refineStep module
const {
  refineStep,
  buildRefinementPrompt,
  truncateContent,
  REFINE_STEP_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTEXT_LENGTH,
} = require("../src/refineStep");
const { isOllamaAvailable } = require("../src/ai");
const { ensureOllamaRunning, MODEL_PULL_TIMEOUT_MS } = require("../src/ollama");

// Import chai using dynamic import (needed for ESM)
let expect;

describe("RefineStep Module", function () {
  // Increase timeout for real API calls and container setup
  this.timeout(MODEL_PULL_TIMEOUT_MS + 60000);

  before(async function () {
    // Dynamic import for chai ESM
    const chai = await import("chai");
    expect = chai.expect;
    
    console.log("  Setting up Ollama for tests...");
    await ensureOllamaRunning();
  });

    describe("truncateContent", function () {
      it("should return content unchanged if within limit", function () {
        const content = "Short content";
        const result = truncateContent(content, 100);
        expect(result).to.equal(content);
      });

      it("should truncate content exceeding limit", function () {
        const content = "x".repeat(200);
        const result = truncateContent(content, 100);
        expect(result).to.include("[Content truncated...]");
        expect(result.length).to.be.lessThan(200);
      });

      it("should handle null or undefined content", function () {
        expect(truncateContent(null, 100)).to.be.null;
        expect(truncateContent(undefined, 100)).to.be.undefined;
      });

      it("should handle empty string", function () {
        expect(truncateContent("", 100)).to.equal("");
      });
    });

    describe("buildRefinementPrompt", function () {
      it("should include step in prompt", function () {
        const step = { find: { selector: ".test-button" } };
        const prompt = buildRefinementPrompt({ step });

        expect(prompt).to.include("Step to Refine");
        expect(prompt).to.include(".test-button");
      });

      it("should include failure message when provided", function () {
        const step = { find: { selector: ".missing" } };
        const prompt = buildRefinementPrompt({
          step,
          failureMessage: "Element not found: .missing",
        });

        expect(prompt).to.include("Failure Message");
        expect(prompt).to.include("Element not found: .missing");
      });

      it("should include source content when provided", function () {
        const step = { goTo: { url: "https://example.com" } };
        const prompt = buildRefinementPrompt({
          step,
          sourceContent: "# Documentation\n\nVisit the homepage.",
        });

        expect(prompt).to.include("Source Documentation");
        expect(prompt).to.include("Visit the homepage");
      });

      it("should include previous steps when provided", function () {
        const step = { click: { selector: ".next" } };
        const previousSteps = [
          { goTo: { url: "https://example.com" } },
          { find: { selector: ".login-form" } },
        ];
        const prompt = buildRefinementPrompt({
          step,
          previousSteps,
        });

        expect(prompt).to.include("Previously Executed Steps");
        expect(prompt).to.include("https://example.com");
        expect(prompt).to.include(".login-form");
      });

      it("should include DOM context when provided", function () {
        const step = { find: { selector: ".button" } };
        const prompt = buildRefinementPrompt({
          step,
          context: {
            dom: "<html><body><button class='submit-btn'>Submit</button></body></html>",
          },
        });

        expect(prompt).to.include("Browser DOM");
        expect(prompt).to.include("submit-btn");
      });

      it("should include element context when provided", function () {
        const step = { click: { selector: ".btn" } };
        const prompt = buildRefinementPrompt({
          step,
          context: {
            element: { tagName: "button", className: "primary-btn", text: "Click me" },
          },
        });

        expect(prompt).to.include("Target Element");
        expect(prompt).to.include("primary-btn");
      });

      it("should include CLI output context when provided", function () {
        const step = { runShell: { command: "npm test" } };
        const prompt = buildRefinementPrompt({
          step,
          context: {
            cliOutput: "Error: Test failed with exit code 1",
          },
        });

        expect(prompt).to.include("CLI Output");
        expect(prompt).to.include("exit code 1");
      });

      it("should include HTTP response context when provided", function () {
        const step = { httpRequest: { url: "https://api.example.com/users" } };
        const prompt = buildRefinementPrompt({
          step,
          context: {
            httpResponse: { status: 404, body: { error: "Not found" } },
          },
        });

        expect(prompt).to.include("HTTP Response");
        expect(prompt).to.include("404");
        expect(prompt).to.include("Not found");
      });

      it("should include accessibility tree context when provided", function () {
        const step = { find: { selector: "[role='button']" } };
        const prompt = buildRefinementPrompt({
          step,
          context: {
            accessibility: "button 'Submit Form' focused",
          },
        });

        expect(prompt).to.include("Accessibility Tree");
        expect(prompt).to.include("Submit Form");
      });

      it("should truncate large context sections", function () {
        const step = { find: { selector: ".test" } };
        const largeDom = "<div>" + "x".repeat(100000) + "</div>";
        const prompt = buildRefinementPrompt({
          step,
          context: { dom: largeDom },
          maxContextLength: 1000,
        });

        expect(prompt).to.include("[Content truncated...]");
        expect(prompt.length).to.be.lessThan(largeDom.length);
      });
    });

    describe("REFINE_STEP_SYSTEM_PROMPT", function () {
      it("should contain step refinement context", function () {
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("step refinement expert");
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("failure messages");
      });

      it("should list available action types", function () {
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("goTo");
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("find");
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("click");
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("httpRequest");
        expect(REFINE_STEP_SYSTEM_PROMPT).to.include("runShell");
      });
    });

    describe("DEFAULT_MAX_CONTEXT_LENGTH", function () {
      it("should be 50000", function () {
        expect(DEFAULT_MAX_CONTEXT_LENGTH).to.equal(50000);
      });
    });

    describe("refineStep", function () {
      describe("input validation", function () {
        it("should throw error when step is not provided", async function () {
          try {
            await refineStep({});
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'step' is required and must be an object.");
          }
        });

        it("should throw error when step is not an object", async function () {
          try {
            await refineStep({ step: "not an object" });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'step' is required and must be an object.");
          }
        });

        it("should throw error when step is null", async function () {
          try {
            await refineStep({ step: null });
            expect.fail("Should have thrown an error");
          } catch (error) {
            expect(error.message).to.equal("'step' is required and must be an object.");
          }
        });
      });

      describe("step refinement", function () {
        it("should refine a step with failure context", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const originalStep = {
            stepId: "step-123",
            find: { selector: ".old-button-class" },
          };

          const refinedStep = await refineStep({
            step: originalStep,
            failureMessage: "Element not found: .old-button-class",
            context: {
              dom: `<html><body>
                <button class="new-submit-button" id="submit">Submit</button>
              </body></html>`,
            },
          });

          expect(refinedStep).to.be.an("object");
          expect(refinedStep.stepId).to.equal("step-123"); // Preserved
          // Should have a find action with updated selector
          expect(refinedStep.find || refinedStep.click).to.exist;
        });

        it("should preserve stepId from original step", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const originalStep = {
            stepId: "preserved-step-id",
            goTo: { url: "https://example.com" },
          };

          const refinedStep = await refineStep({
            step: originalStep,
            sourceContent: "Navigate to the example website.",
          });

          expect(refinedStep.stepId).to.equal("preserved-step-id");
        });

        it("should preserve sourceLocation from original step", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const originalStep = {
            stepId: "step-456",
            sourceLocation: {
              file: "/docs/test.md",
              startLine: 10,
              endLine: 12,
              startColumn: 1,
              endColumn: 50,
              startOffset: 100,
              endOffset: 150,
              originalText: "<!-- step goTo: https://example.com -->",
              isInline: true,
              isAutoDetected: false,
            },
            goTo: { url: "https://example.com" },
          };

          const refinedStep = await refineStep({
            step: originalStep,
          });

          expect(refinedStep.sourceLocation).to.deep.equal(originalStep.sourceLocation);
        });

        it("should use model from config when provided", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const refinedStep = await refineStep({
            step: { checkLink: { url: "https://example.com" } },
            config: {
              ai: {
                model: "anthropic/claude-haiku-4.5",
              },
            },
          });

          expect(refinedStep).to.be.an("object");
        });

        it("should override config model with explicit model parameter", async function () {
          // Skip if no API key is set
          if (!process.env.ANTHROPIC_API_KEY) {
            this.skip();
          }

          const refinedStep = await refineStep({
            step: { wait: { duration: 1000 } },
            config: {
              ai: {
                model: "anthropic/claude-opus-4.5",
              },
            },
            model: "anthropic/claude-haiku-4.5",
          });

          expect(refinedStep).to.be.an("object");
        });

        it("should handle previous steps context", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const previousSteps = [
            { goTo: { url: "https://example.com" } },
            { find: { selector: ".login-form" } },
          ];

          const refinedStep = await refineStep({
            step: { click: { selector: ".submit" } },
            previousSteps,
            failureMessage: "Cannot click element: page not fully loaded",
            context: {
              dom: "<html><body><form class='login-form'><button class='login-submit'>Login</button></form></body></html>",
            },
          });

          expect(refinedStep).to.be.an("object");
          // Should suggest a more specific selector or add a wait
          expect(refinedStep.click || refinedStep.find || refinedStep.wait).to.exist;
        });
      });

      describe("step validation", function () {
        it("should produce steps that pass schema validation", async function () {
          // Skip if no API key is set
          if (!(await isOllamaAvailable())) {
            this.skip();
          }

          const { validate } = require("../src/validate");

          const refinedStep = await refineStep({
            step: { find: { selector: ".test" } },
            failureMessage: "Element .test not found",
            context: {
              dom: "<html><body><div class='actual-element'>Content</div></body></html>",
            },
          });

          const validation = validate({schemaKey: "step_v3", object: refinedStep});
          expect(validation.valid).to.be.true;
        });
      });
    });
  });
