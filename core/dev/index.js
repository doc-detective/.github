const { runTests } = require("../src");

/**
 * Run tests with a predefined configuration and print the result as pretty-printed JSON.
 */
async function main() {
  const json = {
    input: "dev/windows-calculator.spec.json",
    logLevel: "debug",
    runOn:[{
      platforms: ["windows"],
      apps: [{
        name: "calculator"
      }]
    }],
    integrations: {
      docDetectiveApi: {
        apiKey: process.env.KEY || ""
      }
    }
  };
  // console.log(json);
  const result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();