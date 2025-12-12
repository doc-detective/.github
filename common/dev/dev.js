const { validate, schemas, refineStep } = require("../src/index");
const { detectProvider, generate, modelMap } = require("../src/ai");

const testRefineStep = async (model) => {
    const originalStep = {
    stepId: "step-123",
    find: { selector: ".old-button-class" },
  };

  const startTime = performance.now();
  const refinedStep = await refineStep({
    step: originalStep,
    failureMessage: "Element not found: .old-button-class",
    context: {
      dom: `<html><body>
                <button class="new-submit-button" id="submit">Submit</button>
              </body></html>`,
    },
  });
  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log("Refined Step:", refinedStep);
  return { model, duration };
};

(async () => {
  // get list of models from modelMap
  const models = Object.keys(modelMap);
  const results = [];

  for (const model of models) {
    console.log(`\n=== Testing refineStep with model: ${model} ===`);
    const result = await testRefineStep(model);
    results.push(result);
  }

  // Print results summary
  console.log("\n=== Refinement Duration Summary ===");
  results.forEach(({ model, duration }) => {
    console.log(`${model}: ${duration.toFixed(2)}ms`);
  });

  // Print sorted by duration
  console.log("\n=== Sorted by Duration (fastest first) ===");
  [...results].sort((a, b) => a.duration - b.duration).forEach(({ model, duration }) => {
    console.log(`${model}: ${duration.toFixed(2)}ms`);
  });
})();
