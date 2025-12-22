const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");

// Internal constants - not exposed to users
const POLLING_INTERVAL_MS = 5000;
const POLLING_TIMEOUT_MS = 300000; // 5 minutes
const API_REQUEST_TIMEOUT_MS = 30000; // 30 seconds for individual API requests
const DOWNLOAD_TIMEOUT_MS = 300000; // 5 minutes for downloads
const DEFAULT_SCENARIO_NAME = "Doc Detective";
// Base URL for REST API (different from publishing API)
const REST_API_PATH = "/rest/all-files";

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
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates an axios instance configured for Heretto REST API requests (different base URL).
 * @param {Object} herettoConfig - Heretto integration configuration
 * @returns {Object} Configured axios instance for REST API
 */
function createRestApiClient(herettoConfig) {
  const authHeader = createAuthHeader(
    herettoConfig.username,
    herettoConfig.apiToken
  );
  return axios.create({
    baseURL: `https://${herettoConfig.organizationId}.heretto.com`,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });
}

/**
 * Fetches all available publishing scenarios from Heretto.
 * @param {Object} client - Configured axios instance
 * @returns {Promise<Array>} Array of publishing scenarios
 */
async function getPublishingScenarios(client) {
  const response = await client.get("/publishes/scenarios");
  return response.data.content || [];
}

/**
 * Fetches parameters for a specific publishing scenario.
 * @param {Object} client - Configured axios instance
 * @param {string} scenarioId - ID of the publishing scenario
 * @returns {Promise<Object>} Scenario parameters object
 */
async function getPublishingScenarioParameters(client, scenarioId) {
  const response = await client.get(
    `/publishes/scenarios/${scenarioId}/parameters`
  );
  return response.data;
}

/**
 * Finds an existing publishing scenario by name and validates its configuration.
 * @param {Object} client - Configured axios instance
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @param {string} scenarioName - Name of the scenario to find
 * @returns {Promise<Object|null>} Object with scenarioId and fileId, or null if not found or invalid
 */
async function findScenario(client, log, config, scenarioName) {
  try {
    const scenarios = await getPublishingScenarios(client);
    const foundScenario = scenarios.find((s) => s.name === scenarioName);

    if (!foundScenario) {
      log(config, "error", `No existing "${scenarioName}" scenario found.`);
      return null;
    }

    const scenarioParameters = await getPublishingScenarioParameters(
      client,
      foundScenario.id
    );

    if (!scenarioParameters) {
      log(
        config,
        "error",
        `Failed to retrieve scenario details for ID: ${foundScenario.id}`
      );
      return null;
    }

    // Make sure that scenarioParameters.content has an object with name="transtype" and options[0].value="dita"
    const transtypeParam = scenarioParameters.content.find(
      (param) => param.name === "transtype"
    );
    if (!transtypeParam || transtypeParam.value !== "dita") {
      log(
        config,
        "error",
        `Existing "${scenarioName}" scenario has incorrect "transtype" parameter settings. Make sure it is set to "dita".`
      );
      return null;
    }
    
    // Make sure that scenarioParameters.content has an object with name="tool-kit-name" and value="default/dita-ot-3.6.1"
    const toolKitParam = scenarioParameters.content.find(
      (param) => param.name === "tool-kit-name"
    );
    if (!toolKitParam || !toolKitParam.value) {
      log(
        config,
        "error",
        `Existing "${scenarioName}" scenario has incorrect "tool-kit-name" parameter settings.`
      );
      return null;
    }
    
    // Make sure that scenarioParameters.content has an object with type="file_uuid_picker" and a value
    const fileUuidPickerParam = scenarioParameters.content.find(
      (param) => param.type === "file_uuid_picker"
    );
    if (!fileUuidPickerParam || !fileUuidPickerParam.value) {
      log(
        config,
        "error",
        `Existing "${scenarioName}" scenario has incorrect "file_uuid_picker" parameter settings. Make sure it has a valid value.`
      );
      return null;
    }

    log(
      config,
      "debug",
      `Found existing "${scenarioName}" scenario: ${foundScenario.id}`
    );
    return {
      scenarioId: foundScenario.id,
      fileId: fileUuidPickerParam.value,
    };
  } catch (error) {
    log(
      config,
      "error",
      `Failed to find publishing scenario: ${error.message}`
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
  const response = await client.post(`/files/${fileId}/publishes`, {
    scenario: scenarioId,
    parameters: []
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
  const response = await client.get(
    `/files/${fileId}/publishes/${jobId}`
  );
  return response.data;
}

/**
 * Gets all asset file paths from a completed publishing job.
 * Handles pagination to retrieve all assets.
 * @param {Object} client - Configured axios instance
 * @param {string} fileId - UUID of the DITA map
 * @param {string} jobId - ID of the publishing job
 * @returns {Promise<Array<string>>} Array of asset file paths
 */
async function getJobAssetDetails(client, fileId, jobId) {
  const allAssets = [];
  let page = 0;
  const pageSize = 100;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await client.get(
      `/files/${fileId}/publishes/${jobId}/assets`,
      {
        params: {
          page,
          size: pageSize,
        },
      }
    );

    const data = response.data;
    const content = data.content || [];

    for (const asset of content) {
      if (asset.filePath) {
        allAssets.push(asset.filePath);
      }
    }

    // Check if there are more pages
    const totalPages = data.totalPages || 1;
    page++;
    hasMorePages = page < totalPages;
  }

  return allAssets;
}

/**
 * Validates that a .ditamap file exists in the job assets.
 * Checks for any .ditamap file in the ot-output/dita/ directory.
 * @param {Array<string>} assets - Array of asset file paths
 * @returns {boolean} True if a .ditamap is found in ot-output/dita/
 */
function validateDitamapInAssets(assets) {
  return assets.some((assetPath) => 
    assetPath.startsWith("ot-output/dita/") && assetPath.endsWith(".ditamap")
  );
}

/**
 * Polls a publishing job until completion or timeout.
 * After job completes, validates that a .ditamap file exists in the output.
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
      log(config, "debug", `Job ${jobId} status: ${job?.status?.status}`);

      // Check if job has reached a terminal state (result is set)
      if (job?.status?.result) {
        log(
          config,
          "debug",
          `Job ${jobId} completed with result: ${job.status.result}`
        );

        // Validate that a .ditamap file exists in the output
        try {
          const assets = await getJobAssetDetails(client, fileId, jobId);
          log(
            config,
            "debug",
            `Job ${jobId} has ${assets.length} assets`
          );

          if (validateDitamapInAssets(assets)) {
            log(
              config,
              "debug",
              `Found .ditamap file in ot-output/dita/`
            );
            return job;
          }

          log(
            config,
            "warning",
            `Publishing job ${jobId} completed but no .ditamap file found in ot-output/dita/`
          );
          return null;
        } catch (assetError) {
          log(
            config,
            "warning",
            `Failed to validate job assets: ${assetError.message}`
          );
          return null;
        }
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
    } catch (error) {
      log(config, "warning", `Error polling job status: ${error.message}`);
      return null;
    }
  }

  log(
    config,
    "warning",
    `Publishing job ${jobId} timed out after ${
      POLLING_TIMEOUT_MS / 1000
    } seconds`
  );
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
async function downloadAndExtractOutput(
  client,
  fileId,
  jobId,
  herettoName,
  log,
  config
) {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = `${os.tmpdir()}/doc-detective`;
    fs.mkdirSync(tempDir, { recursive: true });

    // Create unique output directory based on heretto name and job ID
    const hash = crypto
      .createHash("md5")
      .update(`${herettoName}_${jobId}`)
      .digest("hex");
    const outputDir = path.join(tempDir, `heretto_${hash}`);

    // Download the output file
    log(
      config,
      "debug",
      `Downloading publishing job output for ${herettoName}...`
    );
    const response = await client.get(
      `/files/${fileId}/publishes/${jobId}/assets-all`,
      {
        responseType: "arraybuffer",
        timeout: DOWNLOAD_TIMEOUT_MS,
        headers: {
          Accept: "application/octet-stream",
        },
      }
    );

    // Save ZIP to temp file
    const zipPath = path.join(tempDir, `heretto_${hash}.zip`);
    fs.writeFileSync(zipPath, response.data);

    // Extract ZIP contents with path traversal protection
    log(config, "debug", `Extracting output to ${outputDir}...`);
    const zip = new AdmZip(zipPath);
    const resolvedOutputDir = path.resolve(outputDir);
    
    // Validate and extract entries safely to prevent zip slip attacks
    for (const entry of zip.getEntries()) {
      const entryPath = path.join(outputDir, entry.entryName);
      const resolvedPath = path.resolve(entryPath);
      
      // Ensure the resolved path is within outputDir
      if (!resolvedPath.startsWith(resolvedOutputDir + path.sep) && resolvedPath !== resolvedOutputDir) {
        log(config, "warning", `Skipping potentially malicious ZIP entry: ${entry.entryName}`);
        continue;
      }
      
      if (entry.isDirectory) {
        fs.mkdirSync(resolvedPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, entry.getData());
      }
    }

    // Clean up ZIP file
    fs.unlinkSync(zipPath);

    log(
      config,
      "info",
      `Heretto content "${herettoName}" extracted to ${outputDir}`
    );
    return outputDir;
  } catch (error) {
    log(
      config,
      "warning",
      `Failed to download or extract output: ${error.message}`
    );
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
  log(
    config,
    "info",
    `Loading content from Heretto "${herettoConfig.name}"...`
  );

  try {
    const client = createApiClient(herettoConfig);

    // Find the Doc Detective publishing scenario
    const scenarioName = herettoConfig.scenarioName || DEFAULT_SCENARIO_NAME;
    const scenario = await findScenario(
      client,
      log,
      config,
      scenarioName
    );
    if (!scenario) {
      log(
        config,
        "warning",
        `Skipping Heretto "${herettoConfig.name}" - could not find or create publishing scenario`
      );
      return null;
    }

    // Trigger publishing job
    log(
      config,
      "debug",
      `Triggering publishing job for file ${scenario.fileId}...`
    );
    const job = await triggerPublishingJob(
      client,
      scenario.fileId,
      scenario.scenarioId
    );
    log(config, "debug", `Publishing job started: ${job.jobId}`);

    // Poll for completion
    log(config, "info", `Waiting for publishing job to complete...`);
    const completedJob = await pollJobStatus(
      client,
      scenario.fileId,
      job.jobId,
      log,
      config
    );
    if (!completedJob) {
      log(
        config,
        "warning",
        `Skipping Heretto "${herettoConfig.name}" - publishing job failed or timed out`
      );
      return null;
    }

    // Download and extract output
    const outputPath = await downloadAndExtractOutput(
      client,
      scenario.fileId,
      job.jobId,
      herettoConfig.name,
      log,
      config
    );

    // Build file mapping from extracted content
    if (outputPath && herettoConfig.uploadOnChange) {
      const fileMapping = await buildFileMapping(
        outputPath,
        herettoConfig,
        log,
        config
      );
      herettoConfig.fileMapping = fileMapping;
    }

    return outputPath;
  } catch (error) {
    log(
      config,
      "warning",
      `Failed to load Heretto "${herettoConfig.name}": ${error.message}`
    );
    return null;
  }
}

/**
 * Builds a mapping of local file paths to Heretto file metadata.
 * Parses DITA files to extract file references and attempts to resolve UUIDs.
 * @param {string} outputPath - Path to extracted Heretto content
 * @param {Object} herettoConfig - Heretto integration configuration
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<Object>} Mapping of local paths to {fileId, filePath}
 */
async function buildFileMapping(outputPath, herettoConfig, log, config) {
  const fileMapping = {};
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  try {
    // Recursively find all DITA/XML files
    const ditaFiles = findFilesWithExtensions(outputPath, [
      ".dita",
      ".ditamap",
      ".xml",
    ]);

    for (const ditaFile of ditaFiles) {
      try {
        const content = fs.readFileSync(ditaFile, "utf-8");
        const parsed = xmlParser.parse(content);

        // Extract image references from DITA content
        const imageRefs = extractImageReferences(parsed);

        for (const imageRef of imageRefs) {
          // Resolve relative path to absolute local path
          const absoluteLocalPath = path.resolve(
            path.dirname(ditaFile),
            imageRef
          );

          if (!fileMapping[absoluteLocalPath]) {
            fileMapping[absoluteLocalPath] = {
              filePath: imageRef,
              sourceFile: ditaFile,
            };
          }
        }
      } catch (parseError) {
        log(
          config,
          "debug",
          `Failed to parse ${ditaFile} for file mapping: ${parseError.message}`
        );
      }
    }

    log(
      config,
      "debug",
      `Built file mapping with ${Object.keys(fileMapping).length} entries`
    );
  } catch (error) {
    log(config, "warning", `Failed to build file mapping: ${error.message}`);
  }

  return fileMapping;
}

/**
 * Recursively finds files with specified extensions.
 * @param {string} dir - Directory to search
 * @param {Array<string>} extensions - File extensions to match (e.g., ['.dita', '.xml'])
 * @returns {Array<string>} Array of matching file paths
 */
function findFilesWithExtensions(dir, extensions) {
  const results = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...findFilesWithExtensions(fullPath, extensions));
      } else if (
        extensions.some((ext) => fullPath.toLowerCase().endsWith(ext))
      ) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore read errors for inaccessible directories
  }

  return results;
}

/**
 * Extracts image references from parsed DITA XML content.
 * Looks for <image> elements with href attributes.
 * @param {Object} parsedXml - Parsed XML object
 * @returns {Array<string>} Array of image href values
 */
function extractImageReferences(parsedXml) {
  const refs = [];

  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;

    // Check for image elements
    if (obj.image) {
      const images = Array.isArray(obj.image) ? obj.image : [obj.image];
      for (const img of images) {
        if (img["@_href"]) {
          refs.push(img["@_href"]);
        }
      }
    }

    // Recursively traverse all properties
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "object") {
        traverse(obj[key]);
      }
    }
  }

  traverse(parsedXml);
  return refs;
}

/**
 * Searches for a file in Heretto by filename.
 * @param {Object} herettoConfig - Heretto integration configuration
 * @param {string} filename - Name of the file to search for
 * @param {string} folderPath - Optional folder path to search within
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<Object|null>} File info with ID and URI, or null if not found
 */
async function searchFileByName(
  herettoConfig,
  filename,
  folderPath,
  log,
  config
) {
  const client = createApiClient(herettoConfig);

  try {
    const searchBody = {
      queryString: filename,
      foldersToSearch: {},
      startOffset: 0,
      endOffset: 10,
      searchResultType: "FILES_ONLY",
      addPrefixAndFuzzy: false,
    };

    // If folderPath provided, search within that folder; otherwise search root
    if (folderPath) {
      searchBody.foldersToSearch[folderPath] = true;
    } else {
      // Search in organization root
      searchBody.foldersToSearch[
        `/db/organizations/${herettoConfig.organizationId}/`
      ] = true;
    }

    const response = await client.post(
      "/ezdnxtgen/api/search".replace("/ezdnxtgen/api/v2", ""),
      searchBody,
      {
        baseURL: `https://${herettoConfig.organizationId}.heretto.com`,
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.data?.hits?.length > 0) {
      // Find exact filename match
      const exactMatch = response.data.hits.find(
        (hit) => hit.fileEntity?.name === filename
      );

      if (exactMatch) {
        return {
          fileId: exactMatch.fileEntity.ID,
          filePath: exactMatch.fileEntity.URI,
          name: exactMatch.fileEntity.name,
        };
      }
    }

    return null;
  } catch (error) {
    log(
      config,
      "debug",
      `Failed to search for file "${filename}": ${error.message}`
    );
    return null;
  }
}

/**
 * Uploads a file to Heretto CMS.
 * @param {Object} herettoConfig - Heretto integration configuration
 * @param {string} fileId - UUID of the file to update
 * @param {string} localFilePath - Local path to the file to upload
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<Object>} Result object with status and description
 */
async function uploadFile(herettoConfig, fileId, localFilePath, log, config) {
  const client = createRestApiClient(herettoConfig);

  try {
    // Read file as binary
    const fileBuffer = fs.readFileSync(localFilePath);

    // Determine content type from file extension
    const ext = path.extname(localFilePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".webp") contentType = "image/webp";

    log(config, "debug", `Uploading ${localFilePath} to Heretto file ${fileId}`);

    const response = await client.put(
      `${REST_API_PATH}/${fileId}/content`,
      fileBuffer,
      {
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileBuffer.length,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    if (response.status === 200 || response.status === 201) {
      log(
        config,
        "info",
        `Successfully uploaded ${path.basename(localFilePath)} to Heretto`
      );
      return {
        status: "PASS",
        description: `File uploaded successfully to Heretto`,
      };
    }

    return {
      status: "FAIL",
      description: `Unexpected response status: ${response.status}`,
    };
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    log(
      config,
      "warning",
      `Failed to upload file to Heretto: ${errorMessage}`
    );
    return {
      status: "FAIL",
      description: `Failed to upload: ${errorMessage}`,
    };
  }
}

/**
 * Resolves a local file path to a Heretto file ID.
 * First checks file mapping, then searches by filename if needed.
 * @param {Object} herettoConfig - Heretto integration configuration
 * @param {string} localFilePath - Local path to the file
 * @param {Object} sourceIntegration - Source integration metadata from step
 * @param {Function} log - Logging function
 * @param {Object} config - Doc Detective config for logging
 * @returns {Promise<string|null>} Heretto file ID or null if not found
 */
async function resolveFileId(
  herettoConfig,
  localFilePath,
  sourceIntegration,
  log,
  config
) {
  // If fileId is already known, use it
  if (sourceIntegration?.fileId) {
    return sourceIntegration.fileId;
  }

  // Check file mapping
  if (herettoConfig.fileMapping && herettoConfig.fileMapping[localFilePath]) {
    const mapping = herettoConfig.fileMapping[localFilePath];
    if (mapping.fileId) {
      return mapping.fileId;
    }
  }

  // Search by filename
  const filename = path.basename(localFilePath);
  const searchResult = await searchFileByName(
    herettoConfig,
    filename,
    null,
    log,
    config
  );

  if (searchResult?.fileId) {
    // Cache the result in file mapping
    if (!herettoConfig.fileMapping) {
      herettoConfig.fileMapping = {};
    }
    herettoConfig.fileMapping[localFilePath] = {
      fileId: searchResult.fileId,
      filePath: searchResult.filePath,
    };
    return searchResult.fileId;
  }

  log(
    config,
    "warning",
    `Could not resolve Heretto file ID for ${localFilePath}`
  );
  return null;
}

module.exports = {
  createAuthHeader,
  createApiClient,
  createRestApiClient,
  findScenario,
  triggerPublishingJob,
  getJobStatus,
  getJobAssetDetails,
  validateDitamapInAssets,
  pollJobStatus,
  downloadAndExtractOutput,
  loadHerettoContent,
  buildFileMapping,
  searchFileByName,
  uploadFile,
  resolveFileId,
  // Export constants for testing
  POLLING_INTERVAL_MS,
  POLLING_TIMEOUT_MS,
  DEFAULT_SCENARIO_NAME,
};
