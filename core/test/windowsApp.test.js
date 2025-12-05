/**
 * Windows Desktop Automation Tests
 *
 * Tests for Windows desktop application automation using NovaWindows Driver.
 */

const assert = require("assert").strict;
const {
  resolveAppPath,
  normalizeAppConfig,
  isNovaWindowsAvailable,
  getNovaWindowsCapabilities,
  COMMON_WINDOWS_APPS,
} = require("../src/windowsApp");
const {
  parseWindowsSelector,
  buildWindowsXPath,
  isWindowsContext,
  convertToWindowsSelector,
  escapeXPathValue,
} = require("../src/tests/windowsElementStrategies");

describe("Windows Desktop Automation", function () {
  describe("resolveAppPath", function () {
    it("should resolve known app names", function () {
      const notepad = resolveAppPath("notepad");
      assert.ok(notepad);
      assert.equal(notepad.path, "C:\\Windows\\System32\\notepad.exe");
      assert.equal(notepad.type, "desktop");
    });

    it("should resolve app names case-insensitively", function () {
      const notepad = resolveAppPath("NOTEPAD");
      assert.ok(notepad);
      assert.equal(notepad.path, "C:\\Windows\\System32\\notepad.exe");
    });

    it("should resolve calculator as UWP app", function () {
      const calculator = resolveAppPath("calculator");
      assert.ok(calculator);
      assert.equal(calculator.type, "uwp");
      assert.ok(calculator.path.includes("WindowsCalculator"));
    });

    it("should return null for unknown app names", function () {
      const unknown = resolveAppPath("unknownapp123");
      assert.equal(unknown, null);
    });

    it("should return null for empty input", function () {
      assert.equal(resolveAppPath(""), null);
      assert.equal(resolveAppPath(null), null);
      assert.equal(resolveAppPath(undefined), null);
    });

    it("should recognize UWP package identifiers", function () {
      const uwpApp = resolveAppPath("Microsoft.WindowsCalculator_8wekyb3d8bbwe!App");
      assert.ok(uwpApp);
      assert.equal(uwpApp.type, "uwp");
    });
  });

  describe("normalizeAppConfig", function () {
    it("should normalize string app name to full config", function () {
      const config = normalizeAppConfig("notepad");
      assert.equal(config.name, "notepad");
      assert.equal(config.path, "C:\\Windows\\System32\\notepad.exe");
      assert.equal(config.appType, "desktop");
      assert.equal(config.options.launchTimeout, 30000);
      assert.equal(config.options.keepAppOpen, false);
    });

    it("should preserve provided options", function () {
      const config = normalizeAppConfig({
        name: "notepad",
        options: {
          launchTimeout: 60000,
          keepAppOpen: true,
        },
      });
      assert.equal(config.options.launchTimeout, 60000);
      assert.equal(config.options.keepAppOpen, true);
    });

    it("should use custom path when provided", function () {
      const config = normalizeAppConfig({
        name: "myapp",
        path: "C:\\MyApp\\myapp.exe",
      });
      assert.equal(config.path, "C:\\MyApp\\myapp.exe");
    });

    it("should set default options", function () {
      const config = normalizeAppConfig({
        name: "notepad",
      });
      assert.equal(config.options.clickDelay, 0);
      assert.equal(config.options.smoothMouseMove, false);
    });
  });

  describe("isNovaWindowsAvailable", function () {
    it("should detect NovaWindows driver when installed", function () {
      const mockOutput = {
        stderr: `
Listing installed drivers

├── chromium
│   └── appium-chromium-driver@2.0.3 installed (npm)
├── novawindows
│   └── appium-novawindows-driver@1.0.0 installed (npm)
└── gecko
    └── appium-geckodriver@2.1.1 installed (npm)
`,
      };
      const result = isNovaWindowsAvailable(mockOutput);
      assert.ok(result);
      assert.equal(result.name, "novawindows");
    });

    it("should return null when NovaWindows not installed", function () {
      const mockOutput = {
        stderr: `
Listing installed drivers

├── chromium
│   └── appium-chromium-driver@2.0.3 installed (npm)
└── gecko
    └── appium-geckodriver@2.1.1 installed (npm)
`,
      };
      const result = isNovaWindowsAvailable(mockOutput);
      assert.equal(result, null);
    });

    it("should return null for empty/invalid input", function () {
      assert.equal(isNovaWindowsAvailable(null), null);
      assert.equal(isNovaWindowsAvailable({}), null);
      assert.equal(isNovaWindowsAvailable({ stderr: "" }), null);
    });
  });

  describe("getNovaWindowsCapabilities", function () {
    it("should generate correct capabilities for desktop app", function () {
      const app = normalizeAppConfig("notepad");
      const caps = getNovaWindowsCapabilities({
        app,
        runnerDetails: { environment: { platform: "windows" } },
      });

      assert.equal(caps.platformName, "Windows");
      assert.equal(caps["appium:automationName"], "NovaWindows");
      assert.equal(caps["appium:app"], "C:\\Windows\\System32\\notepad.exe");
      assert.equal(caps["wdio:enforceWebDriverClassic"], true);
    });

    it("should include NovaWindows-specific options", function () {
      const app = normalizeAppConfig({
        name: "notepad",
        options: {
          keepAppOpen: true,
          clickDelay: 100,
          smoothMouseMove: true,
        },
      });
      const caps = getNovaWindowsCapabilities({
        app,
        runnerDetails: { environment: { platform: "windows" } },
      });

      assert.equal(caps["nova:keepAppOpen"], true);
      assert.equal(caps["nova:clickDelay"], 100);
      assert.equal(caps["nova:smoothMouseMove"], true);
    });

    it("should throw error for unresolved app path", function () {
      const app = { name: "unknownapp", path: null };
      assert.throws(() => {
        getNovaWindowsCapabilities({
          app,
          runnerDetails: { environment: { platform: "windows" } },
        });
      }, /Cannot resolve path/);
    });
  });

  describe("COMMON_WINDOWS_APPS", function () {
    it("should have notepad configured", function () {
      assert.ok(COMMON_WINDOWS_APPS.notepad);
      assert.ok(COMMON_WINDOWS_APPS.notepad.path);
    });

    it("should have calculator configured", function () {
      assert.ok(COMMON_WINDOWS_APPS.calculator);
      assert.equal(COMMON_WINDOWS_APPS.calculator.type, "uwp");
    });

    it("should have paint configured", function () {
      assert.ok(COMMON_WINDOWS_APPS.paint);
    });

    it("should have wordpad configured", function () {
      assert.ok(COMMON_WINDOWS_APPS.wordpad);
    });
  });
});

describe("Windows Element Finding Strategies", function () {
  describe("isWindowsContext", function () {
    it("should return true for context with app", function () {
      assert.equal(isWindowsContext({ app: "notepad" }), true);
      assert.equal(isWindowsContext({ app: { name: "notepad" } }), true);
    });

    it("should return true for context with isWindowsApp flag", function () {
      assert.equal(isWindowsContext({ isWindowsApp: true }), true);
    });

    it("should return false for browser context", function () {
      assert.equal(isWindowsContext({ browser: { name: "chrome" } }), false);
      assert.equal(isWindowsContext({}), false);
      assert.equal(isWindowsContext(null), false);
    });
  });

  describe("parseWindowsSelector", function () {
    it("should parse accessibility ID selectors", function () {
      const result = parseWindowsSelector('[id="SaveButton"]');
      assert.equal(result.strategy, "accessibility id");
      assert.equal(result.value, "SaveButton");
    });

    it("should parse name selectors", function () {
      const result = parseWindowsSelector('[name="Save"]');
      assert.equal(result.strategy, "name");
      assert.equal(result.value, "Save");
    });

    it("should parse class name selectors", function () {
      const result = parseWindowsSelector('[class="Button"]');
      assert.equal(result.strategy, "class name");
      assert.equal(result.value, "Button");
    });

    it("should parse XPath selectors", function () {
      const result = parseWindowsSelector('//Button[@Name="Save"]');
      assert.equal(result.strategy, "xpath");
      assert.equal(result.value, '//Button[@Name="Save"]');
    });

    it("should parse CSS-style ID selectors", function () {
      const result = parseWindowsSelector("#SaveButton");
      assert.equal(result.strategy, "accessibility id");
      assert.equal(result.value, "SaveButton");
    });

    it("should parse WebDriverIO accessibility id shorthand", function () {
      const result = parseWindowsSelector("~SaveButton");
      assert.equal(result.strategy, "accessibility id");
      assert.equal(result.value, "SaveButton");
    });

    it("should parse CSS-style class selectors", function () {
      const result = parseWindowsSelector(".Button");
      assert.equal(result.strategy, "class name");
      assert.equal(result.value, "Button");
    });

    it("should treat plain text as name search", function () {
      const result = parseWindowsSelector("Save");
      assert.equal(result.strategy, "name");
      assert.equal(result.value, "Save");
    });

    it("should recognize Windows control types", function () {
      const result = parseWindowsSelector("Button");
      assert.equal(result.strategy, "class name");
      assert.equal(result.value, "Button");
    });

    it("should handle automationid attribute", function () {
      const result = parseWindowsSelector('[automationid="btn-save"]');
      assert.equal(result.strategy, "accessibility id");
      assert.equal(result.value, "btn-save");
    });

    it("should handle null/undefined input", function () {
      const result1 = parseWindowsSelector(null);
      assert.equal(result1.strategy, null);

      const result2 = parseWindowsSelector(undefined);
      assert.equal(result2.strategy, null);
    });
  });

  describe("buildWindowsXPath", function () {
    it("should build XPath from element ID", function () {
      const xpath = buildWindowsXPath({ elementId: "SaveButton" });
      assert.ok(xpath.includes("AutomationId"));
      assert.ok(xpath.includes("SaveButton"));
    });

    it("should build XPath from element text", function () {
      const xpath = buildWindowsXPath({ elementText: "Save" });
      assert.ok(xpath.includes("Name"));
      assert.ok(xpath.includes("Save"));
    });

    it("should combine multiple criteria with AND", function () {
      const xpath = buildWindowsXPath({
        elementId: "SaveButton",
        elementText: "Save",
      });
      assert.ok(xpath.includes("and"));
    });

    it("should handle element class", function () {
      const xpath = buildWindowsXPath({ elementClass: "Button" });
      assert.ok(xpath.includes("ClassName"));
    });

    it("should return generic XPath for empty criteria", function () {
      const xpath = buildWindowsXPath({});
      assert.equal(xpath, "//*");
    });
  });

  describe("convertToWindowsSelector", function () {
    it("should convert ID selector to WebDriver format", function () {
      const result = convertToWindowsSelector('[id="SaveButton"]');
      assert.equal(result.using, "accessibility id");
      assert.equal(result.value, "SaveButton");
    });

    it("should convert name selector to WebDriver format", function () {
      const result = convertToWindowsSelector('[name="Save"]');
      assert.equal(result.using, "name");
      assert.equal(result.value, "Save");
    });
  });

  describe("escapeXPathValue", function () {
    it("should wrap simple strings in single quotes", function () {
      assert.equal(escapeXPathValue("hello"), "'hello'");
      assert.equal(escapeXPathValue("SaveButton"), "'SaveButton'");
    });

    it("should use double quotes when string contains single quotes", function () {
      assert.equal(escapeXPathValue("it's"), '"it\'s"');
      assert.equal(escapeXPathValue("O'Reilly"), '"O\'Reilly"');
    });

    it("should use single quotes when string contains double quotes", function () {
      assert.equal(escapeXPathValue('say "hello"'), "'say \"hello\"'");
    });

    it("should use concat() when string contains both quote types", function () {
      const result = escapeXPathValue("it's a \"test\"");
      assert.ok(result.startsWith("concat("));
      assert.ok(result.includes("it"));
      assert.ok(result.includes("test"));
    });

    it("should handle null and undefined", function () {
      assert.equal(escapeXPathValue(null), "''");
      assert.equal(escapeXPathValue(undefined), "''");
    });

    it("should convert numbers to strings", function () {
      assert.equal(escapeXPathValue(123), "'123'");
    });

    it("should handle empty strings", function () {
      assert.equal(escapeXPathValue(""), "''");
    });
  });
});
