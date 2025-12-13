const { runTests } = require("../src");
const path = require("path");

async function testAnnotations() {
  console.log("Testing annotations...");
  
  const config = {
    runTests: {
      input: path.resolve(__dirname, "artifacts/annotations.spec.json"),
    },
    logLevel: "info",
    telemetry: { send: false }
  };

  try {
    const result = await runTests(config);
    console.log("\n=== Test Results ===");
    console.log("Specs:", result.summary.specs);
    console.log("Tests:", result.summary.tests);
    console.log("Steps:", result.summary.steps);
    
    if (result.summary.specs.fail > 0 || result.summary.tests.fail > 0) {
      console.log("\n=== Failed Tests ===");
      result.specs.forEach((spec) => {
        spec.tests.forEach((test) => {
          test.steps.forEach((step) => {
            if (step.status === "FAIL") {
              console.log(`Step ${step.stepId}: ${step.description}`);
            }
          });
        });
      });
      process.exit(1);
    } else {
      console.log("\n✓ All annotation tests passed!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Error running tests:", error);
    process.exit(1);
  }
}

testAnnotations();
