/**
 * Heretto Integration Tests
 *
 * These tests run against the real Heretto API and are designed to only
 * execute in CI environments (GitHub Actions) where credentials are available.
 *
 * Required environment variables:
 * - HERETTO_ORGANIZATION_ID: The Heretto organization ID
 * - HERETTO_USERNAME: The Heretto username (email)
 * - HERETTO_API_TOKEN: The Heretto API token
 *
 * These tests are skipped when:
 * - Running locally without CI=true environment variable
 * - Required environment variables are not set
 */

const heretto = require("./heretto");
const fs = require("fs");
const path = require("path");
const os = require("os");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

/**
 * Check if we're running in CI and have required credentials
 */
const isCI = process.env.CI === "true";
const hasCredentials =
  process.env.HERETTO_ORGANIZATION_ID &&
  process.env.HERETTO_USERNAME &&
  process.env.HERETTO_API_TOKEN;

const shouldRunIntegrationTests = isCI && hasCredentials;

// Helper to skip tests when not in CI or missing credentials
const describeIntegration = shouldRunIntegrationTests ? describe : describe.skip;

// Log why tests are being skipped
if (!shouldRunIntegrationTests) {
  console.log("\n⏭️  Heretto integration tests skipped:");
  if (!isCI) {
    console.log("   - Not running in CI environment (CI !== 'true')");
  }
  if (!hasCredentials) {
    console.log("   - Missing required environment variables:");
    if (!process.env.HERETTO_ORGANIZATION_ID)
      console.log("     - HERETTO_ORGANIZATION_ID");
    if (!process.env.HERETTO_USERNAME) console.log("     - HERETTO_USERNAME");
    if (!process.env.HERETTO_API_TOKEN) console.log("     - HERETTO_API_TOKEN");
  }
  console.log("");
}

describeIntegration("Heretto Integration Tests (CI Only)", function () {
  // These tests interact with real APIs, so allow longer timeouts
  this.timeout(120000); // 2 minutes per test

  let client;
  let herettoConfig;
  let tempDirectories = []; // Track temp directories for cleanup
  const mockLog = (...args) => {
    if (process.env.DEBUG) {
      console.log(...args);
    }
  };
  const mockConfig = { logLevel: process.env.DEBUG ? "debug" : "info" };

  before(function () {
    herettoConfig = {
      name: "integration-test",
      organizationId: process.env.HERETTO_ORGANIZATION_ID,
      username: process.env.HERETTO_USERNAME,
      apiToken: process.env.HERETTO_API_TOKEN,
      scenarioName: process.env.HERETTO_SCENARIO_NAME || "Doc Detective",
    };

    client = heretto.createApiClient(herettoConfig);
  });

  after(function () {
    // Clean up any temporary directories created during tests
    const tempDir = path.join(os.tmpdir(), "doc-detective");
    if (fs.existsSync(tempDir)) {
      try {
        // Find and remove heretto_* directories created during this test run
        const items = fs.readdirSync(tempDir);
        for (const item of items) {
          if (item.startsWith("heretto_")) {
            const itemPath = path.join(tempDir, item);
            if (fs.statSync(itemPath).isDirectory()) {
              fs.rmSync(itemPath, { recursive: true, force: true });
              if (process.env.DEBUG) {
                console.log(`Cleaned up temp directory: ${itemPath}`);
              }
            }
          }
        }
      } catch (error) {
        // Ignore cleanup errors - these are best-effort
        if (process.env.DEBUG) {
          console.log(`Cleanup warning: ${error.message}`);
        }
      }
    }
  });

  describe("API Client Creation", function () {
    it("should create a valid API client", function () {
      expect(client).to.not.be.null;
      expect(client).to.have.property("get");
      expect(client).to.have.property("post");
    });

    it("should configure correct base URL", function () {
      const expectedBaseUrl = `https://${herettoConfig.organizationId}.heretto.com/ezdnxtgen/api/v2`;
      expect(client.defaults.baseURL).to.equal(expectedBaseUrl);
    });
  });

  describe("findScenario", function () {
    it("should find an existing scenario with correct configuration", async function () {
      const result = await heretto.findScenario(
        client,
        mockLog,
        mockConfig,
        herettoConfig.scenarioName
      );

      // The scenario should exist and have required properties
      expect(result).to.not.be.null;
      expect(result).to.have.property("scenarioId");
      expect(result).to.have.property("fileId");
      expect(result.scenarioId).to.be.a("string");
      expect(result.fileId).to.be.a("string");
    });

    it("should return null for non-existent scenario", async function () {
      const result = await heretto.findScenario(
        client,
        mockLog,
        mockConfig,
        "NonExistent Scenario That Should Not Exist 12345"
      );

      expect(result).to.be.null;
    });
  });

  describe("Full Publishing Workflow", function () {
    let scenarioInfo;
    let jobId;

    before(async function () {
      // Find the scenario first
      scenarioInfo = await heretto.findScenario(
        client,
        mockLog,
        mockConfig,
        herettoConfig.scenarioName
      );

      if (!scenarioInfo) {
        this.skip();
      }
    });

    it("should trigger a publishing job", async function () {
      const job = await heretto.triggerPublishingJob(
        client,
        scenarioInfo.fileId,
        scenarioInfo.scenarioId
      );

      expect(job).to.not.be.null;
      expect(job).to.have.property("id");
      jobId = job.id;
    });

    it("should poll job status until completion", async function () {
      // This test may take a while as it waits for the job to complete
      this.timeout(360000); // 6 minutes

      const completedJob = await heretto.pollJobStatus(
        client,
        scenarioInfo.fileId,
        jobId,
        mockLog,
        mockConfig
      );

      expect(completedJob).to.not.be.null;
      expect(completedJob).to.have.property("status");
      expect(completedJob.status).to.have.property("status");

      // Job should be in a completed state
      const completedStates = ["COMPLETED", "FAILED", "DONE"];
      expect(completedStates).to.include(completedJob.status.status);
    });

    it("should fetch job asset details", async function () {
      const assets = await heretto.getJobAssetDetails(
        client,
        scenarioInfo.fileId,
        jobId
      );

      expect(assets).to.be.an("array");
      expect(assets.length).to.be.greaterThan(0);

      // Should contain at least some DITA files
      const hasDitaFiles = assets.some(
        (path) => path.endsWith(".dita") || path.endsWith(".ditamap")
      );
      expect(hasDitaFiles).to.be.true;
    });

    it("should validate ditamap exists in assets", async function () {
      const assets = await heretto.getJobAssetDetails(
        client,
        scenarioInfo.fileId,
        jobId
      );

      const hasValidDitamap = heretto.validateDitamapInAssets(assets);
      expect(hasValidDitamap).to.be.true;
    });

    it("should download and extract output", async function () {
      const outputPath = await heretto.downloadAndExtractOutput(
        client,
        scenarioInfo.fileId,
        jobId,
        herettoConfig.name,
        mockLog,
        mockConfig
      );

      expect(outputPath).to.not.be.null;
      expect(outputPath).to.be.a("string");
      expect(outputPath).to.include("heretto_");
    });
  });

  describe("loadHerettoContent (End-to-End)", function () {
    it("should load content from Heretto successfully", async function () {
      // This is the full end-to-end test
      this.timeout(600000); // 10 minutes for full workflow

      const outputPath = await heretto.loadHerettoContent(
        herettoConfig,
        mockLog,
        mockConfig
      );

      expect(outputPath).to.not.be.null;
      expect(outputPath).to.be.a("string");
      expect(outputPath).to.include("heretto_");
    });
  });
});
