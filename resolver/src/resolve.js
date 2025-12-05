const crypto = require("crypto");
const { log } = require("./utils");
const { loadDescription } = require("./openapi");

exports.resolveDetectedTests = resolveDetectedTests;

// Doc Detective actions that require a driver.
const driverActions = [
  "click",
  "dragAndDrop",
  "find",
  "goTo",
  "loadCookie",
  "record",
  "saveCookie",
  "screenshot",
  "stopRecord",
  "type",
];

function isDriverRequired({ test }) {
  let driverRequired = false;
  test.steps.forEach((step) => {
    // Check if test includes actions that require a driver.
    driverActions.forEach((action) => {
      if (typeof step[action] !== "undefined") driverRequired = true;
    });
  });
  return driverRequired;
}

function resolveContexts({ contexts, test, config }) {
  log(config, "debug", `Determining required contexts for test: ${test.testId}`);
  const resolvedContexts = [];

  // Check if current test requires a driver (browser or app)
  let driverRequired = false;
  test.steps.forEach((step) => {
    // Check if test includes actions that require a driver.
    driverActions.forEach((action) => {
      if (typeof step[action] !== "undefined") driverRequired = true;
    });
  });

  // Standardize context format
  contexts.forEach((context) => {
    // Handle browsers
    if (context.browsers) {
      if (
        typeof context.browsers === "string" ||
        (typeof context.browsers === "object" &&
          !Array.isArray(context.browsers))
      ) {
        // If browsers is a string or an object, convert to array
        context.browsers = [context.browsers];
      }
      context.browsers = context.browsers.map((browser) => {
        if (typeof browser === "string") {
          browser = { name: browser };
        }
        if (browser.name === "safari") browser.name = "webkit";
        return browser;
      });
    }
    // Handle apps (Windows desktop applications)
    if (context.apps) {
      if (
        typeof context.apps === "string" ||
        (typeof context.apps === "object" &&
          !Array.isArray(context.apps))
      ) {
        // If apps is a string or an object, convert to array
        context.apps = [context.apps];
      }
      context.apps = context.apps.map((app) => {
        if (typeof app === "string") {
          app = { name: app };
        }
        return app;
      });
    }
    if (context.platforms) {
      if (typeof context.platforms === "string") {
        context.platforms = [context.platforms];
      }
    } else {
      // Default to empty array if platforms is not specified
      context.platforms = [];
    }

    // Validate that both apps and browsers are not specified together
    if (context.apps && context.apps.length > 0 && context.browsers && context.browsers.length > 0) {
      log(config, "error", `Context specifies both 'apps' and 'browsers', which is ambiguous. Only 'apps' will be used. Remove one to resolve ambiguity.`);
    }
  });

  // Resolve to final contexts. Each context should include a single platform and at most a single browser or app.
  // If no driver is required, filter down to platform-based contexts
  // If driver is required, create contexts for each specified combination of platform and browser/app
  contexts.forEach((context) => {
    const staticContexts = [];

    // Skip contexts with no platforms
    if (!context.platforms || context.platforms.length === 0) {
      log(config, "debug", `Skipping context with no platforms specified.`);
      return;
    }

    context.platforms.forEach((platform) => {
      if (!driverRequired) {
        const staticContext = { platform };
        staticContexts.push(staticContext);
      } else if (context.apps && context.apps.length > 0) {
        // Windows app contexts - one context per app (takes precedence over browsers)
        context.apps.forEach((app) => {
          const staticContext = { platform, app };
          staticContexts.push(staticContext);
        });
      } else if (context.browsers && context.browsers.length > 0) {
        // Browser contexts
        context.browsers.forEach((browser) => {
          const staticContext = { platform, browser };
          staticContexts.push(staticContext);
        });
      } else {
        // No specific browser or app, just platform
        const staticContext = { platform };
        staticContexts.push(staticContext);
      }
    });
    // For each static context, check if a matching object already exists in resolvedContexts. If not, push to resolvedContexts.
    staticContexts.forEach((staticContext) => {
      const existingContext = resolvedContexts.find((resolvedContext) => {
        return (
          resolvedContext.platform === staticContext.platform &&
          JSON.stringify(resolvedContext.browser) ===
            JSON.stringify(staticContext.browser) &&
          JSON.stringify(resolvedContext.app) ===
            JSON.stringify(staticContext.app)
        );
      });
      if (!existingContext) {
        resolvedContexts.push(staticContext);
      }
    });
  });

  // If no contexts are defined, use default contexts
  if (resolvedContexts.length === 0) {
    resolvedContexts.push({});
  }

  log(config, "debug", `Resolved contexts for test ${test.testId}:\n${JSON.stringify(resolvedContexts, null, 2)}`);
  return resolvedContexts;
}

async function fetchOpenApiDocuments({ config, documentArray }) {
  log(config, "debug", `Fetching OpenAPI documents:\n${JSON.stringify(documentArray, null, 2)}`);
  const openApiDocuments = [];
  if (config?.integrations?.openApi?.length > 0)
    openApiDocuments.push(...config.integrations.openApi);
  if (documentArray?.length > 0) {
    for (const definition of documentArray) {
      try {
        const openApiDefinition = await loadDescription(
          definition.descriptionPath
        );
        definition.definition = openApiDefinition;
      } catch (error) {
        log(
          config,
          "error",
          `Failed to load OpenAPI definition from ${definition.descriptionPath}: ${error.message}`
        );
        continue; // Skip this definition
      }
      const existingDefinitionIndex = openApiDocuments.findIndex(
        (def) => def.name === definition.name
      );
      if (existingDefinitionIndex > -1) {
        openApiDocuments.splice(existingDefinitionIndex, 1);
      }
      openApiDocuments.push(definition);
    }
  }
  log(config, "debug", `Fetched OpenAPI documents:\n${JSON.stringify(openApiDocuments, null, 2)}`);
  return openApiDocuments;
}

// Iterate through and resolve test specifications and contained tests.
async function resolveDetectedTests({ config, detectedTests }) {
  log(config, "debug", `RESOLVING DETECTED TEST SPECS:\n${JSON.stringify(detectedTests, null, 2)}`);
  // Set initial shorthand values
  const resolvedTests = {
    resolvedTestsId: crypto.randomUUID(),
    config: config,
    specs: [],
  };

  // Iterate specs
  log(config, "info", "Resolving test specs.");
  for (const spec of detectedTests) {
    const resolvedSpec = await resolveSpec({ config, spec });
    resolvedTests.specs.push(resolvedSpec);
  }

  log(config, "debug", `RESOLVED TEST SPECS:\n${JSON.stringify(resolvedTests, null, 2)}`);
  return resolvedTests;
}

async function resolveSpec({ config, spec }) {
  const specId = spec.specId || crypto.randomUUID();
  log(config, "debug", `RESOLVING SPEC ID ${specId}:\n${JSON.stringify(spec, null, 2)}`);
  const resolvedSpec = {
    ...spec,
    specId: specId,
    runOn: spec.runOn || config.runOn || [],
    openApi: await fetchOpenApiDocuments({
      config,
      documentArray: spec.openApi,
    }),
    tests: [],
  };
  for (const test of spec.tests) {
    const resolvedTest = await resolveTest({
      config,
      spec: resolvedSpec,
      test,
    });
    resolvedSpec.tests.push(resolvedTest);
  }
  log(config, "debug", `RESOLVED SPEC ${specId}:\n${JSON.stringify(resolvedSpec, null, 2)}`);
  return resolvedSpec;
}

async function resolveTest({ config, spec, test }) {
  const testId = test.testId || crypto.randomUUID();
  log(config, "debug", `RESOLVING TEST ID ${testId}:\n${JSON.stringify(test, null, 2)}`);
  
  // Use test.contexts if defined, otherwise fall back to runOn or spec.runOn
  const testRunOn = test.contexts || test.runOn || spec.runOn;
  
  const resolvedTest = {
    ...test,
    testId: testId,
    runOn: testRunOn,
    openApi: await fetchOpenApiDocuments({
      config,
      documentArray: [...spec.openApi, ...(test.openApi || [])],
    }),
    contexts: [],
  };
  delete resolvedTest.steps;

  const testContexts = resolveContexts({
    test: test,
    contexts: testRunOn,
    config: config,
  });

  for (const context of testContexts) {
    const resolvedContext = await resolveContext({
      config,
      test: test,
      context,
    });
    resolvedTest.contexts.push(resolvedContext);
  }
  log(config, "debug", `RESOLVED TEST ${testId}:\n${JSON.stringify(resolvedTest, null, 2)}`);
  return resolvedTest;
}

async function resolveContext({ config, test, context }) {
  const contextId = context.contextId || crypto.randomUUID();
  log(config, "debug", `RESOLVING CONTEXT ID ${contextId}:\n${JSON.stringify(context, null, 2)}`);
  const resolvedContext = {
    ...context,
    unsafe: test.unsafe || false,
    openApi: test.openApi || [],
    steps: [...test.steps],
    contextId: contextId,
  };
  log(config, "debug", `RESOLVED CONTEXT ${contextId}:\n${JSON.stringify(resolvedContext, null, 2)}`);
  return resolvedContext;
}
