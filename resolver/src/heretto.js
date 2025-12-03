const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

// Internal constants - not exposed to users
const POLLING_INTERVAL_MS = 5000;
const POLLING_TIMEOUT_MS = 300000; // 5 minutes
const SCENARIO_NAME = "Doc Detective";
const SCENARIO_DESCRIPTION = "Normalized DITA output for Doc Detective testing";

/**
 * Creates a Base64-encoded Basic Auth header from username and API token.
 * @param {string} username - Heretto CCMS username (email)
 * @param {string} apiToken - API token generated in Heretto CCMS
 * @returns {string} Base64-encoded authorization header value
 */
function createAuthHeader(username, apiToken) {
  const credentials = `${username}:${apiToken}`;
  return Buffer.from(credentials).toString("base64");
}

/**
 * Builds the base URL for Heretto CCMS API.
 * @param {string} organizationId - The organization subdomain
 * @returns {string} Base API URL
 */
function getBaseUrl(organizationId) {
  return `https://${organizationId}.heretto.com/ezdnxtgen/api/v2`;
}

/**
 * Creates an axios instance configured for Heretto API requests.
 * @param {Object} herettoConfig - Heretto integration configuration
 * @returns {Object} Configured axios instance
 */
function createApiClient(herettoConfig) {
  const authHeader = createAuthHeader(
    herettoConfig.username,
    herettoConfig.apiToken
  );
  return axios.create({
    baseURL: getBaseUrl(herettoConfig.organizationId),
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Fetches all available publishing scenarios from Heretto.
 * @param {Object} client - Configured axios instance
 * @returns {Promise<Array>} Array of publishing scenarios
 */
async function getPublishingScenarios(client) {
  const response = await client.get("/publishing-scenarios");
  return response.data.content || [];
}

/**
 * Creates a new publishing scenario in Heretto.
 * @param {Object} client - Configured axios instance
 * @returns {Promise<Object>} Created scenario object
 */
async function createPublishingScenario(client) {
  const scenarioConfig = {
    name: SCENARIO_NAME,
    description: SCENARIO_DESCRIPTION,
    outputFormat: "dita",
    engine: "dita-ot",
    parameters: {
      "transtype": "dita"
    }
  };
  const response = await client.post("/publishing-scenarios", scenarioConfig);
  return response.data;
}

/**
 * Finds an existing "Doc Detective" scenario or creates one if missing.
 * @param {Object} client - Configured axios instance
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<Object|null>} Scenario object or null if creation failed
 */
async function findOrCreateScenario(client, log, config) {
  try {
    const scenarios = await getPublishingScenarios(client);
    const existingScenario = scenarios.find((s) => s.name === SCENARIO_NAME);

    if (existingScenario) {
      log(config, "debug", `Found existing "${SCENARIO_NAME}" scenario: ${existingScenario.id}`);
      return existingScenario;
    }

    log(config, "info", `Creating "${SCENARIO_NAME}" publishing scenario...`);
    const newScenario = await createPublishingScenario(client);
    log(config, "debug", `Created scenario: ${newScenario.id}`);
    return newScenario;
  } catch (error) {
    log(
      config,
      "error",
      `Failed to find or create publishing scenario: ${error.message}`
    );
    return null;
  }
}

/**
 * Triggers a publishing job for a DITA map.
 * @param {Object} client - Configured axios instance
 * @param {string} fileId - UUID of the DITA map
 * @param {string} scenarioId - ID of the publishing scenario to use
 * @returns {Promise<Object>} Publishing job object
 */
async function triggerPublishingJob(client, fileId, scenarioId) {
  const response = await client.post(`/files/${fileId}/publishing-jobs`, {
    scenarioId: scenarioId,
  });
  return response.data;
}

/**
 * Gets the status of a publishing job.
 * @param {Object} client - Configured axios instance
 * @param {string} fileId - UUID of the DITA map
 * @param {string} jobId - ID of the publishing job
 * @returns {Promise<Object>} Job status object
 */
async function getJobStatus(client, fileId, jobId) {
  const response = await client.get(`/files/${fileId}/publishing-jobs/${jobId}`);
  return response.data;
}

/**
 * Polls a publishing job until completion or timeout.
 * @param {Object} client - Configured axios instance
 * @param {string} fileId - UUID of the DITA map
 * @param {string} jobId - ID of the publishing job
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<Object|null>} Completed job object or null on timeout/failure
 */
async function pollJobStatus(client, fileId, jobId, log, config) {
  const startTime = Date.now();

  while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
    try {
      const job = await getJobStatus(client, fileId, jobId);
      log(config, "debug", `Job ${jobId} status: ${job.status}`);

      if (job.status === "COMPLETED" || job.status === "SUCCESS") {
        return job;
      }

      if (job.status === "FAILED" || job.status === "ERROR") {
        log(config, "warning", `Publishing job ${jobId} failed: ${job.errorMessage || "Unknown error"}`);
        return null;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
    } catch (error) {
      log(config, "warning", `Error polling job status: ${error.message}`);
      return null;
    }
  }

  log(config, "warning", `Publishing job ${jobId} timed out after ${POLLING_TIMEOUT_MS / 1000} seconds`);
  return null;
}

/**
 * Downloads the publishing job output and extracts it to temp directory.
 * @param {Object} client - Configured axios instance
 * @param {string} fileId - UUID of the DITA map
 * @param {string} jobId - ID of the publishing job
 * @param {string} herettoName - Name of the Heretto integration for directory naming
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<string|null>} Path to extracted content or null on failure
 */
async function downloadAndExtractOutput(client, fileId, jobId, herettoName, log, config) {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = `${os.tmpdir()}/doc-detective`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create unique output directory based on heretto name and job ID
    const hash = crypto.createHash("md5").update(`${herettoName}_${jobId}`).digest("hex");
    const outputDir = path.join(tempDir, `heretto_${hash}`);

    // Download the output file
    log(config, "debug", `Downloading publishing job output for ${herettoName}...`);
    const response = await client.get(`/files/${fileId}/publishing-jobs/${jobId}/output`, {
      responseType: "arraybuffer",
    });

    // Save ZIP to temp file
    const zipPath = path.join(tempDir, `heretto_${hash}.zip`);
    fs.writeFileSync(zipPath, response.data);

    // Extract ZIP contents
    log(config, "debug", `Extracting output to ${outputDir}...`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(outputDir, true);

    // Clean up ZIP file
    fs.unlinkSync(zipPath);

    log(config, "info", `Heretto content "${herettoName}" extracted to ${outputDir}`);
    return outputDir;
  } catch (error) {
    log(config, "warning", `Failed to download or extract output: ${error.message}`);
    return null;
  }
}

/**
 * Main function to load content from a Heretto CMS instance.
 * Triggers a publishing job, waits for completion, and downloads the output.
 * @param {Object} herettoConfig - Heretto integration configuration
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<string|null>} Path to extracted content or null on failure
 */
async function loadHerettoContent(herettoConfig, log, config) {
  log(config, "info", `Loading content from Heretto "${herettoConfig.name}"...`);

  try {
    const client = createApiClient(herettoConfig);

    // Find or create the Doc Detective publishing scenario
    const scenario = await findOrCreateScenario(client, log, config);
    if (!scenario) {
      log(config, "warning", `Skipping Heretto "${herettoConfig.name}" - could not find or create publishing scenario`);
      return null;
    }

    // Trigger publishing job
    log(config, "debug", `Triggering publishing job for file ${herettoConfig.fileId}...`);
    const job = await triggerPublishingJob(client, herettoConfig.fileId, scenario.id);
    log(config, "debug", `Publishing job started: ${job.id}`);

    // Poll for completion
    log(config, "info", `Waiting for publishing job to complete...`);
    const completedJob = await pollJobStatus(client, herettoConfig.fileId, job.id, log, config);
    if (!completedJob) {
      log(config, "warning", `Skipping Heretto "${herettoConfig.name}" - publishing job failed or timed out`);
      return null;
    }

    // Download and extract output
    const outputPath = await downloadAndExtractOutput(
      client,
      herettoConfig.fileId,
      completedJob.id,
      herettoConfig.name,
      log,
      config
    );

    return outputPath;
  } catch (error) {
    log(config, "warning", `Failed to load Heretto "${herettoConfig.name}": ${error.message}`);
    return null;
  }
}

module.exports = {
  createAuthHeader,
  createApiClient,
  findOrCreateScenario,
  triggerPublishingJob,
  pollJobStatus,
  downloadAndExtractOutput,
  loadHerettoContent,
  // Export constants for testing
  POLLING_INTERVAL_MS,
  POLLING_TIMEOUT_MS,
  SCENARIO_NAME,
};
