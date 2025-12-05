/**
 * Windows Desktop App Automation Utilities
 *
 * This module provides utilities for Windows desktop application automation
 * using the NovaWindows Driver (Appium-based).
 */

const path = require("path");
const fs = require("fs");

/**
 * Common Windows application paths.
 * Maps friendly names to executable paths or UWP package identifiers.
 */
const COMMON_WINDOWS_APPS = {
  notepad: {
    path: "C:\\Windows\\System32\\notepad.exe",
    type: "desktop",
    windowTitle: "Notepad",
  },
  calculator: {
    path: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
    type: "uwp",
    windowTitle: "Calculator",
  },
  paint: {
    path: "C:\\Windows\\System32\\mspaint.exe",
    type: "desktop",
    windowTitle: "Paint",
  },
  wordpad: {
    path: "C:\\Program Files\\Windows NT\\Accessories\\wordpad.exe",
    type: "desktop",
    windowTitle: "WordPad",
  },
  // Additional common apps
  explorer: {
    path: "C:\\Windows\\explorer.exe",
    type: "desktop",
    windowTitle: "File Explorer",
  },
  cmd: {
    path: "C:\\Windows\\System32\\cmd.exe",
    type: "desktop",
    windowTitle: "Command Prompt",
  },
  powershell: {
    path: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    type: "desktop",
    windowTitle: "Windows PowerShell",
  },
};

/**
 * Extracts a window title from a UWP app identifier.
 *
 * UWP identifiers follow the pattern: PackageFamilyName!AppId
 * Example: Microsoft.WindowsCalculator_8wekyb3d8bbwe!App
 *
 * @param {string} appName - The UWP app identifier
 * @returns {string} The extracted window title
 */
function extractUwpWindowTitle(appName) {
  const exclamationIndex = appName.lastIndexOf("!");

  if (exclamationIndex !== -1) {
    const appId = appName.substring(exclamationIndex + 1).trim();
    if (appId.length > 0) {
      return appId;
    }
  }

  // Fallback: try to extract the last segment after "_"
  const underscoreIndex = appName.lastIndexOf("_");
  if (underscoreIndex !== -1) {
    const lastSegment = appName.substring(underscoreIndex + 1).trim();
    if (lastSegment.length > 0) {
      return lastSegment;
    }
  }

  // Final fallback: use the full appName
  return appName;
}

// Exports
exports.resolveAppPath = resolveAppPath;
exports.isNovaWindowsAvailable = isNovaWindowsAvailable;
exports.getNovaWindowsCapabilities = getNovaWindowsCapabilities;
exports.normalizeAppConfig = normalizeAppConfig;
exports.COMMON_WINDOWS_APPS = COMMON_WINDOWS_APPS;

/**
 * Resolves an app name to its full path.
 *
 * @param {string} appName - The name of the application (e.g., "notepad", "calculator")
 * @returns {Object|null} Object with path and type, or null if not found
 */
function resolveAppPath(appName) {
  if (!appName) return null;

  const normalizedName = appName.toLowerCase().trim();

  // Check if it's a known app
  if (COMMON_WINDOWS_APPS[normalizedName]) {
    return COMMON_WINDOWS_APPS[normalizedName];
  }

  // Check if it's a UWP app identifier (contains "!" to indicate app entry point)
  if (appName.includes("!")) {
    const windowTitle = extractUwpWindowTitle(appName);
    return {
      path: appName,
      type: "uwp",
      windowTitle,
    };
  }

  // If it looks like an absolute path, return it as-is
  if (
    path.isAbsolute(appName) ||
    appName.includes("\\") ||
    appName.endsWith(".exe")
  ) {
    // Verify the file exists for desktop apps
    if (fs.existsSync(appName)) {
      return {
        path: appName,
        type: "desktop",
        windowTitle: path.basename(appName, ".exe"),
      };
    }
    return null;
  }

  // Not found
  return null;
}

/**
 * Normalizes an app configuration to a standard format.
 *
 * @param {string|Object} appConfig - App name string or app configuration object
 * @returns {Object} Normalized app configuration
 */
function normalizeAppConfig(appConfig) {
  // Handle string input (just app name)
  if (typeof appConfig === "string") {
    const resolved = resolveAppPath(appConfig);
    return {
      name: appConfig,
      path: resolved?.path || null,
      appType: resolved?.type || "desktop",
      windowTitle: resolved?.windowTitle || appConfig,
      options: {
        launchTimeout: 30000,
        keepAppOpen: false,
        clickDelay: 0,
        smoothMouseMove: false,
      },
    };
  }

  // Handle object input
  const resolved = appConfig.path
    ? { path: appConfig.path, type: appConfig.appType || "desktop" }
    : resolveAppPath(appConfig.name);

  return {
    name: appConfig.name,
    path: appConfig.path || resolved?.path || null,
    appType: appConfig.appType || resolved?.type || "desktop",
    windowTitle:
      appConfig.options?.windowTitle ||
      resolved?.windowTitle ||
      appConfig.name,
    options: {
      launchTimeout: appConfig.options?.launchTimeout || 30000,
      keepAppOpen: appConfig.options?.keepAppOpen || false,
      clickDelay: appConfig.options?.clickDelay || 0,
      smoothMouseMove: appConfig.options?.smoothMouseMove || false,
      ...(appConfig.options || {}),
    },
  };
}

/**
 * Checks if NovaWindows Driver is installed and available.
 *
 * @param {Object} installedAppiumDrivers - Output from `npx appium driver list`
 * @returns {Object|null} Driver info if available, null otherwise
 */
function isNovaWindowsAvailable(installedAppiumDrivers) {
  if (!installedAppiumDrivers?.stderr) return null;

  const novaWindowsMatch = installedAppiumDrivers.stderr.match(
    /\n.*novawindows.*installed.*\n/i
  );

  if (novaWindowsMatch) {
    // Extract version if possible
    const versionMatch = novaWindowsMatch[0].match(/(\d+\.\d+\.\d+)/);
    return {
      name: "novawindows",
      version: versionMatch ? versionMatch[1] : "unknown",
      type: "desktop-driver",
    };
  }

  return null;
}

/**
 * Generates WebDriver capabilities for NovaWindows Driver.
 *
 * @param {Object} options - Options object
 * @param {Object} options.app - Normalized app configuration
 * @param {Object} options.runnerDetails - Runner details including environment
 * @returns {Object} WebDriver capabilities object
 */
function getNovaWindowsCapabilities({ app, runnerDetails }) {
  if (!app?.path) {
    throw new Error(
      `Cannot resolve path for application: ${app?.name}. ` +
        `Specify the full path in the app configuration or use a known app name (notepad, calculator, paint, wordpad).`
    );
  }

  const capabilities = {
    platformName: "Windows",
    "appium:automationName": "NovaWindows",
    "appium:app": app.path,
    "appium:newCommandTimeout": 600000, // 10 minutes
    "wdio:enforceWebDriverClassic": true, // Use classic WebDriver mode
  };

  // Add NovaWindows-specific options
  if (app.options) {
    if (app.options.keepAppOpen !== undefined) {
      capabilities["nova:keepAppOpen"] = app.options.keepAppOpen;
    }
    if (app.options.clickDelay !== undefined && app.options.clickDelay > 0) {
      capabilities["nova:clickDelay"] = app.options.clickDelay;
    }
    if (app.options.smoothMouseMove !== undefined) {
      capabilities["nova:smoothMouseMove"] = app.options.smoothMouseMove;
    }
    if (app.options.windowTitle) {
      capabilities["appium:windowTitle"] = app.options.windowTitle;
    }
  }

  return capabilities;
}

/**
 * Generates an error message for when the NovaWindows Driver is not installed.
 *
 * @returns {string} User-friendly error message with installation instructions
 */
function getNovaWindowsNotInstalledError() {
  return `
ERROR: NovaWindows Driver not detected.

To enable Windows desktop automation, install the NovaWindows Driver:

  npx appium driver install --source=npm appium-novawindows-driver

Requirements:
  - Windows 10 version 1809+ or Windows 11
  - No Developer Mode required
  - No external service installation

Documentation:
  https://github.com/AutomateThePlanet/appium-novawindows-driver
`.trim();
}

exports.getNovaWindowsNotInstalledError = getNovaWindowsNotInstalledError;

/**
 * Generates an error message for when an app path cannot be resolved.
 *
 * @param {string} appName - The app name that couldn't be resolved
 * @returns {string} User-friendly error message
 */
function getAppNotFoundError(appName) {
  const knownApps = Object.keys(COMMON_WINDOWS_APPS).join(", ");
  return `
ERROR: Cannot locate application path for "${appName}".

Solutions:
  1. Specify the full path in your app configuration:
     {
       "apps": {
         "name": "${appName}",
         "path": "C:\\\\Path\\\\To\\\\${appName}.exe"
       }
     }

  2. Use a known application name: ${knownApps}

  3. For UWP apps, use the package family name:
     "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"

Tip: Use the Windows Registry or "where" command to find the app path.
`.trim();
}

exports.getAppNotFoundError = getAppNotFoundError;

/**
 * Generates an error message for app launch timeout.
 *
 * @param {string} appPath - The app path that timed out
 * @param {number} timeout - The timeout duration in ms
 * @returns {string} User-friendly error message
 */
function getAppLaunchTimeoutError(appPath, timeout) {
  return `
ERROR: Application failed to launch within ${timeout}ms: ${appPath}

Troubleshooting:
  1. Verify the path is correct
  2. Check for blocking dialogs (UAC prompts, first-run wizards)
  3. Ensure sufficient system resources
  4. Increase the launchTimeout in app options:
     {
       "apps": {
         "name": "myapp",
         "path": "${appPath}",
         "options": {
           "launchTimeout": 60000
         }
       }
     }

Note: UAC/elevated prompts cannot be automated due to Windows security.
`.trim();
}

exports.getAppLaunchTimeoutError = getAppLaunchTimeoutError;

/**
 * Generates an error message for element not found in Windows app.
 *
 * @param {string} selector - The selector that wasn't found
 * @param {number} timeout - The timeout duration in ms
 * @returns {string} User-friendly error message
 */
function getWindowsElementNotFoundError(selector, timeout) {
  return `
ERROR: Element not found with selector "${selector}"
Timeout: ${timeout}ms

Troubleshooting:
  1. Use Accessibility Insights for Windows to discover element properties:
     https://accessibilityinsights.io/

  2. Supported locator strategies for Windows apps:
     - Accessibility ID: [id="SaveButton"]
     - Name: [name="Save"]
     - XPath: //Button[@Name="Save"]
     - Class: [class="Button"]

  3. Verify the element is visible and not obscured

  4. Some elements may not expose automation properties - check the
     application's accessibility implementation.
`.trim();
}

exports.getWindowsElementNotFoundError = getWindowsElementNotFoundError;
