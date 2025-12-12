const { execSync, spawn } = require("child_process");
const fs = require("fs");

/** Default Ollama model to use */
const DEFAULT_OLLAMA_MODEL = "qwen3-vl:8b-instruct-q4_K_M";

/** Timeout for checking Ollama availability */
const OLLAMA_AVAILABILITY_TIMEOUT_MS = 500;

/**
 * Checks if Ollama is available at the specified URL.
 * @param {string} [baseUrl] - Optional base URL override.
 * @returns {Promise<boolean>} True if Ollama is available.
 */
const isOllamaAvailable = async (baseUrl) => {
  const url = baseUrl || "http://localhost:11434";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OLLAMA_AVAILABILITY_TIMEOUT_MS
    );

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

/** Default Ollama base URL */
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

/** Maximum time to wait for model pull (10 minutes) */
const MODEL_PULL_TIMEOUT_MS = 10 * 60 * 1000;

/** Maximum time to wait for Ollama startup (30 seconds) */
const OLLAMA_STARTUP_TIMEOUT_MS = 30 * 1000;

/**
 * Detects available GPU type.
 * @returns {"nvidia" | "amd" | "none"} The GPU type.
 */
const detectGpuType = () => {
  // Check for Nvidia GPU
  try {
    execSync("nvidia-smi", { stdio: "ignore" });
    return "nvidia";
  } catch {
    // nvidia-smi not available or failed
  }

  // Check for AMD GPU
  try {
    if (fs.existsSync("/dev/kfd") && fs.existsSync("/dev/dri")) {
      return "amd";
    }
  } catch {
    // fs check failed
  }

  return "none";
};

/**
 * Starts the Ollama Docker container with appropriate GPU support.
 * @returns {Promise<void>}
 */
const startOllamaContainer = async () => {
  const gpuType = detectGpuType();
  console.log(`    Detected GPU type: ${gpuType}`);

  let dockerArgs;
  switch (gpuType) {
    case "nvidia":
      dockerArgs = [
        "run", "-d",
        "--gpus=all",
        "-v", "ollama:/root/.ollama",
        "-p", "11434:11434",
        "--name", "ollama",
        "ollama/ollama"
      ];
      break;
    case "amd":
      dockerArgs = [
        "run", "-d",
        "--device", "/dev/kfd",
        "--device", "/dev/dri",
        "-v", "ollama:/root/.ollama",
        "-p", "11434:11434",
        "--name", "ollama",
        "ollama/ollama:rocm"
      ];
      break;
    default:
      dockerArgs = [
        "run", "-d",
        "-v", "ollama:/root/.ollama",
        "-p", "11434:11434",
        "--name", "ollama",
        "ollama/ollama"
      ];
  }

  console.log(`    Starting Ollama container...`);
  execSync(`docker ${dockerArgs.join(" ")}`, { stdio: "inherit" });
};

/**
 * Waits for Ollama to become available.
 * @param {number} [timeoutMs=OLLAMA_STARTUP_TIMEOUT_MS] - Maximum time to wait.
 * @returns {Promise<boolean>} True if Ollama became available.
 */
const waitForOllama = async (timeoutMs = OLLAMA_STARTUP_TIMEOUT_MS) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch("http://localhost:11434");
      if (response.ok) {
        return true;
      }
    } catch {
      // Not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
};

/**
 * Pulls the specified Ollama model with progress output.
 * @param {string} [model=DEFAULT_OLLAMA_MODEL] - The model to pull.
 * @returns {Promise<void>}
 */
const pullOllamaModel = async (model = DEFAULT_OLLAMA_MODEL) => {
  console.log(`    Pulling ${model} model (this may take up to 10 minutes on first run)...`);
  
  return new Promise((resolve, reject) => {
    const pullProcess = spawn("docker", ["exec", "ollama", "ollama", "pull", model], {
      stdio: "inherit"
    });

    const timeoutId = setTimeout(() => {
      pullProcess.kill();
      reject(new Error("Model pull timed out after 10 minutes"));
    }, MODEL_PULL_TIMEOUT_MS);

    pullProcess.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        console.log(`    Model ${model} is ready.`);
        resolve();
      } else {
        reject(new Error(`Model pull failed with exit code ${code}`));
      }
    });

    pullProcess.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
};

/**
 * Stops and removes the Ollama container.
 * @returns {Promise<void>}
 */
const stopOllamaContainer = async () => {
  try {
    console.log(`    Stopping Ollama container...`);
    execSync("docker stop ollama", { stdio: "ignore" });
  } catch {
    // Container may not be running
  }
  try {
    execSync("docker rm ollama", { stdio: "ignore" });
    console.log(`    Ollama container removed.`);
  } catch {
    // Container may not exist
  }
};

/**
 * Ensures Ollama is running, starting a Docker container if needed.
 * @param {string} [model=DEFAULT_OLLAMA_MODEL] - The model to ensure is available.
 * @returns {Promise<boolean>} True if Ollama is available.
 */
const ensureOllamaRunning = async (model = DEFAULT_OLLAMA_MODEL) => {
  if (await isOllamaAvailable()) {
    console.log("    Ollama is already running.");
    return true;
  }

  console.log("    Ollama not detected, starting Docker container...");
  
  // Clean up any existing container first
  await stopOllamaContainer();
  
  await startOllamaContainer();

  const available = await waitForOllama();
  if (!available) {
    throw new Error("Ollama container started but did not become available");
  }

  await pullOllamaModel(model);
  return true;
};

/**
 * Checks if a model is available locally.
 * @param {Object} options - Options object.
 * @param {string} options.model - The model name to check.
 * @param {string} [options.baseUrl] - Optional base URL for Ollama API.
 * @returns {Promise<boolean>} True if the model is available locally.
 */
const isModelAvailable = async ({ model, baseUrl = DEFAULT_OLLAMA_BASE_URL }) => {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    const models = data.models || [];
    
    // Check if the model name matches any locally available model
    // Model names can be in format "name:tag" or just "name" (defaults to "latest")
    const normalizedModel = model.includes(":") ? model : `${model}:latest`;
    
    return models.some(m => {
      const localModel = m.name || m.model;
      const normalizedLocal = localModel.includes(":") ? localModel : `${localModel}:latest`;
      return normalizedLocal === normalizedModel || localModel === model;
    });
  } catch {
    return false;
  }
};

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes - The number of bytes.
 * @returns {string} Human-readable size string.
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Renders a progress bar to the console.
 * @param {Object} options - Options object.
 * @param {number} options.completed - Bytes completed.
 * @param {number} options.total - Total bytes.
 * @param {string} options.status - Current status message.
 * @param {number} [options.barWidth=40] - Width of the progress bar.
 */
const renderProgressBar = ({ completed, total, status, barWidth = 40 }) => {
  const percentage = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  
  const bar = "█".repeat(filledWidth) + "░".repeat(emptyWidth);
  const percentStr = percentage.toFixed(1).padStart(5);
  const completedStr = formatBytes(completed);
  const totalStr = formatBytes(total);
  
  // Use carriage return to overwrite the line
  process.stdout.write(`\r    [${bar}] ${percentStr}% | ${completedStr}/${totalStr} | ${status}`);
};

/**
 * Ensures a model is available, pulling it if necessary.
 * Uses the /api/pull endpoint with streaming to display progress.
 * @param {Object} options - Options object.
 * @param {string} options.model - The model name to ensure is available.
 * @param {string} [options.baseUrl] - Optional base URL for Ollama API.
 * @returns {Promise<boolean>} True if the model is available, false if it cannot be made available.
 */
const ensureModelAvailable = async ({ model, baseUrl = DEFAULT_OLLAMA_BASE_URL }) => {
  // First check if Ollama is available
  if (!await isOllamaAvailable()) {
    console.error("    Ollama is not available.");
    return false;
  }

  // Check if model is already available
  if (await isModelAvailable({ model, baseUrl })) {
    console.log(`    Model ${model} is already available.`);
    return true;
  }

  console.log(`    Pulling model ${model}...`);

  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) {
      console.error(`\n    Failed to pull model: HTTP ${response.status}`);
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastStatus = "";
    let lastCompleted = 0;
    let lastTotal = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete JSON objects from the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const data = JSON.parse(line);
          
          if (data.error) {
            console.error(`\n    Error pulling model: ${data.error}`);
            return false;
          }

          lastStatus = data.status || lastStatus;
          
          // Update progress if we have total/completed info
          if (data.total !== undefined) {
            lastTotal = data.total;
            lastCompleted = data.completed || 0;
            renderProgressBar({
              completed: lastCompleted,
              total: lastTotal,
              status: lastStatus.substring(0, 30),
            });
          } else if (lastTotal === 0) {
            // Status-only update (no download progress)
            process.stdout.write(`\r    ${lastStatus.padEnd(80)}`);
          }

          // Check for success
          if (data.status === "success") {
            process.stdout.write("\n");
            console.log(`    Model ${model} is ready.`);
            return true;
          }
        } catch {
          // Ignore JSON parse errors for incomplete data
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.status === "success") {
          process.stdout.write("\n");
          console.log(`    Model ${model} is ready.`);
          return true;
        }
        if (data.error) {
          console.error(`\n    Error pulling model: ${data.error}`);
          return false;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // If we got here without success, check if model is now available
    process.stdout.write("\n");
    const available = await isModelAvailable({ model, baseUrl });
    if (available) {
      console.log(`    Model ${model} is ready.`);
    } else {
      console.error(`    Failed to make model ${model} available.`);
    }
    return available;

  } catch (error) {
    console.error(`\n    Error pulling model: ${error.message}`);
    return false;
  }
};

module.exports = {
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  MODEL_PULL_TIMEOUT_MS,
  OLLAMA_STARTUP_TIMEOUT_MS,
  OLLAMA_AVAILABILITY_TIMEOUT_MS,
  isOllamaAvailable,
  detectGpuType,
  startOllamaContainer,
  waitForOllama,
  pullOllamaModel,
  stopOllamaContainer,
  ensureOllamaRunning,
  isModelAvailable,
  ensureModelAvailable,
};
