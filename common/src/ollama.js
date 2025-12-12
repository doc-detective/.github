const { execSync, spawn } = require("child_process");
const fs = require("fs");
const { isOllamaAvailable, modelMap } = require("./ai");

/** Default Ollama model to use */
const DEFAULT_OLLAMA_MODEL = modelMap["ollama/qwen3-vl:8b"];

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

module.exports = {
  DEFAULT_OLLAMA_MODEL,
  MODEL_PULL_TIMEOUT_MS,
  OLLAMA_STARTUP_TIMEOUT_MS,
  detectGpuType,
  startOllamaContainer,
  waitForOllama,
  pullOllamaModel,
  stopOllamaContainer,
  ensureOllamaRunning,
};
