const path = require("path");
const browsers = require("@puppeteer/browsers");
const geckodriver = require("geckodriver");
const { spawn } = require("child_process");

async function main() {
  await installBrowsers();
  // await installAppiumDepencencies();

  // Check if on Windows and provide NovaWindows driver installation info
  if (process.platform === "win32") {
    console.log("");
    console.log("=".repeat(70));
    console.log("Windows Desktop Automation Support");
    console.log("=".repeat(70));
    console.log("");
    console.log("To enable Windows desktop application testing, install the NovaWindows Driver:");
    console.log("");
    console.log("  npx appium driver install --source=npm appium-novawindows-driver");
    console.log("");
    console.log("Requirements:");
    console.log("  - Windows 10 version 1809+ or Windows 11");
    console.log("  - No Developer Mode required");
    console.log("");
    console.log("Documentation: https://github.com/AutomateThePlanet/appium-novawindows-driver");
    console.log("=".repeat(70));
    console.log("");
  }
}

main();

async function installBrowsers() {
  // Move to doc-detective-core directory to correctly set browser snapshot directory
  cwd = process.cwd();
  process.chdir(path.join(__dirname, ".."));

  // Meta
  const browser_platform = browsers.detectBrowserPlatform();
  const cacheDir = path.resolve("browser-snapshots");

  // Install Chrome
  try {
    console.log("Installing Chrome browser");
    let browser = "chrome";
    buildId = await browsers.resolveBuildId(
      browser,
      browser_platform,
      "stable"
    );
    const chromeInstall = await browsers.install({
      browser,
      buildId,
      cacheDir,
    });
  } catch (error) {
    console.log("Chrome download not available.", error);
  }

  // Install Firefox
  try {
    console.log("Installing Firefox browser");
    browser = "firefox";
    buildId = await browsers.resolveBuildId(
      browser,
      browser_platform,
      "latest"
    );
    const firefoxInstall = await browsers.install({
      browser,
      buildId,
      cacheDir,
    });
  } catch (error) {
    console.log("Firefox download not available.", error);
  }

  // Install ChromeDriver
  try {
    console.log("Installing ChromeDriver binary");
    browser = "chromedriver";
    buildId = await browsers.resolveBuildId(
      browser,
      browser_platform,
      "stable"
    );
    const chromeDriverInstall = await browsers.install({
      browser,
      buildId,
      cacheDir,
    });
  } catch (error) {
    console.log("ChromeDriver download not available.", error);
  }

  // Install Geckodriver
  try {
    console.log("Installing Geckodriver binary");
    if (__dirname.includes("AppData\\Roaming\\")) {
      // Running from global install on Windows
      binPath = path.join(__dirname.split("node_modules")[0]);
    } else if (__dirname.includes("node_modules")) {
      // If running from node_modules
      binPath = path.join(__dirname, "../../.bin");
    } else {
      binPath = path.join(__dirname, "../node_modules/.bin");
    }
    process.env.GECKODRIVER_CACHE_DIR = binPath;
    const geckoInstall = await geckodriver.download();
  } catch (error) {
    console.log("Geckodriver download not available.", error);
  }
  // Move back to original directory
  process.chdir(cwd);
}
