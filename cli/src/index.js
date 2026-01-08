#!/usr/bin/env node

const {
  setArgs,
  setConfig,
  outputResults,
  setMeta,
  getVersionData,
  log,
  getResolvedTestsFromEnv,
  reportResults,
} = require("./utils");
const { argv } = require("node:process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { detectTests } = require("doc-detective-resolver");
const yaml = require("js-yaml");

/**
 * Compute a content hash for a file to enable content-based matching.
 * @param {string} filePath - Absolute path to the file
 * @returns {string|null} MD5 hash of file content, or null if file can't be read
 */
function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Recursively sort all object keys for consistent comparison.
 * @param {*} obj - The value to sort keys for
 * @returns {*} The value with all object keys sorted
 */
function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = sortKeys(obj[key]);
    return result;
  }, {});
}

/**
 * Canonicalize a spec object for content comparison.
 * Removes volatile fields like sourcePath, contentPath, specId that don't affect spec content.
 * @param {Object} spec - The spec object to canonicalize
 * @returns {string} JSON string of canonicalized spec
 */
function canonicalizeSpec(spec) {
  const clone = JSON.parse(JSON.stringify(spec));
  // Remove metadata fields that don't represent actual spec content
  delete clone.sourcePath;
  delete clone.contentPath;
  delete clone.specId;
  // Recursively sort all object keys for consistent comparison
  return JSON.stringify(sortKeys(clone));
}

/**
 * Match detected specs to their source files using explicit metadata first,
 * then falling back to heuristics.
 * 
 * Matching priority:
 * 1. Explicit sourcePath property (set by resolver)
 * 2. contentPath property (for markdown files)
 * 3. Exact filename/basename match
 * 4. Content hash comparison (parse file content and compare to spec)
 * 5. Error if no reliable match found
 * 
 * @param {Array<Object>} detectedSpecs - Specs returned by the resolver
 * @param {Array<string>} inputPaths - Input file paths provided by the user
 * @returns {Array<Object>} Array of { spec, filePath, matchMethod, error } objects
 */
function matchSpecsToSourceFiles(detectedSpecs, inputPaths) {
  const results = [];
  const usedInputPaths = new Set();
  
  // Build a map of input paths by basename for quick lookup
  const inputsByBasename = new Map();
  for (const inputPath of inputPaths) {
    const basename = path.basename(inputPath);
    if (!inputsByBasename.has(basename)) {
      inputsByBasename.set(basename, []);
    }
    inputsByBasename.get(basename).push(inputPath);
  }
  
  // Build a map of input paths by resolved absolute path
  const inputsByAbsPath = new Map();
  for (const inputPath of inputPaths) {
    const absPath = path.resolve(inputPath);
    inputsByAbsPath.set(absPath, inputPath);
  }
  
  for (const detectedSpec of detectedSpecs) {
    let matchedPath = null;
    let matchMethod = null;
    let error = null;
    
    // Priority 1: Use explicit sourcePath property (set by resolver for all file types)
    if (detectedSpec.sourcePath) {
      const absSourcePath = path.resolve(detectedSpec.sourcePath);
      if (inputsByAbsPath.has(absSourcePath)) {
        matchedPath = absSourcePath;
        matchMethod = 'sourcePath';
      } else if (fs.existsSync(absSourcePath)) {
        // sourcePath exists but wasn't in inputPaths - still use it
        matchedPath = absSourcePath;
        matchMethod = 'sourcePath';
      }
    }
    
    // Priority 2: Use contentPath property (typically set for markdown files)
    if (!matchedPath && detectedSpec.contentPath) {
      const absContentPath = path.resolve(detectedSpec.contentPath);
      if (inputsByAbsPath.has(absContentPath)) {
        matchedPath = absContentPath;
        matchMethod = 'contentPath';
      } else if (fs.existsSync(absContentPath)) {
        matchedPath = absContentPath;
        matchMethod = 'contentPath';
      }
    }
    
    // Priority 3: Try exact filename/basename match
    if (!matchedPath) {
      // If spec has a specId that looks like a filename, try to match it
      const specId = detectedSpec.specId;
      if (specId && inputsByBasename.has(specId)) {
        const candidates = inputsByBasename.get(specId).filter(p => !usedInputPaths.has(p));
        if (candidates.length === 1) {
          matchedPath = path.resolve(candidates[0]);
          matchMethod = 'specIdMatch';
        }
      }
    }
    
    // Priority 4: Content hash comparison for JSON/YAML files
    if (!matchedPath) {
      const jsonYamlInputs = inputPaths.filter(p => {
        const ext = path.extname(p).toLowerCase();
        return (ext === '.json' || ext === '.yaml' || ext === '.yml') && !usedInputPaths.has(p);
      });
      
      if (jsonYamlInputs.length > 0) {
        const canonicalSpec = canonicalizeSpec(detectedSpec);
        const matchingFiles = [];
        
        for (const inputPath of jsonYamlInputs) {
          try {
            const content = fs.readFileSync(inputPath, 'utf-8');
            let parsedContent;
            const ext = path.extname(inputPath).toLowerCase();
            
            if (ext === '.json') {
              parsedContent = JSON.parse(content);
            } else {
              parsedContent = yaml.load(content);
            }
            
            // Canonicalize and compare
            const canonicalInput = canonicalizeSpec(parsedContent);
            if (canonicalSpec === canonicalInput) {
              matchingFiles.push(inputPath);
            }
          } catch {
            // Skip files that can't be parsed
            continue;
          }
        }
        
        if (matchingFiles.length === 1) {
          matchedPath = path.resolve(matchingFiles[0]);
          matchMethod = 'contentMatch';
        } else if (matchingFiles.length > 1) {
          // Multiple matches - ambiguous, report error
          error = `Ambiguous match: spec with ID "${detectedSpec.specId}" matches multiple files: ${matchingFiles.join(', ')}. Please provide explicit file paths.`;
        }
      }
    }
    
    // Priority 5: Single remaining unmatched input for single unmatched spec
    if (!matchedPath && !error) {
      const unmatchedInputs = inputPaths.filter(p => !usedInputPaths.has(p));
      const remainingSpecs = detectedSpecs.filter(s => 
        !results.some(r => r.spec === s && r.filePath)
      );
      
      // Only use this fallback if there's exactly one unmatched input and one remaining spec
      if (unmatchedInputs.length === 1 && remainingSpecs.length === 1 && remainingSpecs[0] === detectedSpec) {
        matchedPath = path.resolve(unmatchedInputs[0]);
        matchMethod = 'singleRemaining';
      }
    }
    
    // If still no match, report error
    if (!matchedPath && !error) {
      error = `Unable to reliably match spec with ID "${detectedSpec.specId}" to a source file. ` +
        `Provide the source file explicitly as input, or ensure the spec file contains a unique identifier.`;
    }
    
    if (matchedPath) {
      usedInputPaths.add(matchedPath);
    }
    
    results.push({
      spec: detectedSpec,
      filePath: matchedPath,
      matchMethod,
      error,
    });
  }
  
  return results;
}

// Run
setMeta();
main(argv);

/**
 * Check if any argument in the array is an exact --editor or -e flag.
 * Matches: '--editor', '-e', '--editor=<value>', '-e=<value>'
 * Does NOT match substrings like '--editor-mode' or '--some-editor'
 * @param {string[]} args - Array of command-line arguments
 * @returns {boolean} True if an exact editor flag is found
 */
function hasEditorFlag(args) {
  return args.some(arg => 
    arg === '--editor' || 
    arg === '-e' || 
    arg.startsWith('--editor=') || 
    arg.startsWith('-e=')
  );
}

// Run
async function main(argv) {
  // Check for --editor flag first (before processing other args)
  const rawArgs = argv.slice(2); // Remove 'node' and script path
  if (hasEditorFlag(rawArgs)) {
    // Parse editor-specific options
    const outputDir = process.cwd();
    
    // Extract input file paths from args (everything that's not a flag or flag value)
    const inputPaths = [];
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      // Skip flags and their values
      if (arg === '--editor' || arg === '-e') continue;
      if (arg === '--input' || arg === '-i') {
        // Next arg is the input value
        if (i + 1 < rawArgs.length) {
          const inputValue = rawArgs[i + 1];
          // Handle comma-separated inputs
          inputValue.split(',').forEach(f => {
            const trimmed = f.trim();
            if (trimmed) inputPaths.push(path.resolve(trimmed));
          });
          i++; // Skip the value
        }
        continue;
      }
      // Handle --input=value format
      if (arg.startsWith('--input=') || arg.startsWith('-i=')) {
        const inputValue = arg.split('=')[1];
        inputValue.split(',').forEach(f => {
          const trimmed = f.trim();
          if (trimmed) inputPaths.push(path.resolve(trimmed));
        });
        continue;
      }
      // Skip other flags
      if (arg.startsWith('-')) continue;
      // Assume it's an input path if it exists
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved)) {
        inputPaths.push(resolved);
      }
    }
    
    // Use doc-detective-resolver to detect specs from input paths
    const specs = [];
    
    if (inputPaths.length > 0) {
      // Build config for resolver with all input paths
      const resolverConfig = {
        input: inputPaths,
        logLevel: 'silent', // Suppress resolver logging for editor mode
      };
      
      try {
        const detectedSpecs = await detectTests({ config: resolverConfig });
        
        if (detectedSpecs && detectedSpecs.length > 0) {
          // Match detected specs to their source files using explicit metadata,
          // then fallback to heuristics if needed
          const matchedSpecs = matchSpecsToSourceFiles(detectedSpecs, inputPaths);
          
          for (const matched of matchedSpecs) {
            const { spec: detectedSpec, filePath, matchMethod, error } = matched;
            
            if (error) {
              console.error(`\x1b[31mError: ${error}\x1b[0m`);
              console.error('\x1b[33mPlease ensure each spec file is provided explicitly as input.\x1b[0m');
              process.exit(1);
            }
            
            const ext = filePath ? path.extname(filePath).toLowerCase() : '.json';
            
            // detectedSpec is already a valid spec_v3 object from detectTests.
            // The resolver validates specs against the spec_v3 schema and only
            // returns specs that pass validation (invalid specs are logged and skipped).
            const spec = { ...detectedSpec };
            
            specs.push({
              spec,
              filePath,
              extension: ext,
              isValid: true,
              validationErrors: null,
              matchMethod, // Track how the match was made for debugging
            });
          }
        }
      } catch (err) {
        console.error(`\x1b[31mError detecting specs: ${err.message}\x1b[0m`);
      }

      // If input paths were specified but no specs were detected
      if (specs.length === 0) {
        // If single file provided, allow it (might be documentation file to analyze)
        const isSingleFile = inputPaths.length === 1 && fs.existsSync(inputPaths[0]);
        if (!isSingleFile) {
          // Multiple files or missing file - this is an error
          console.error('\x1b[31mError: No valid spec files could be detected from the provided inputs.\x1b[0m');
          process.exit(1);
        }
        // Otherwise, proceed - single file will be auto-analyzed as documentation
      }
    }

    // Dynamically import the builder to avoid ESM issues at startup
    const { runBuilder } = require("./cli/builder");

    // Determine if we should auto-analyze
    // Auto-analyze when: single input file provided with --editor
    const autoAnalyzeFile = inputPaths.length === 1 ? inputPaths[0] : null;

    // Run the interactive builder with loaded specs (may be empty for auto-analyze)
    await runBuilder({ outputDir, specs, autoAnalyzeFile });
    return;
  }

  // Find index of `doc-detective` or `run` in argv
  const index = argv.findIndex(
    (arg) => arg.endsWith("doc-detective") || arg.endsWith("index.js")
  );
  // Set args
  argv = setArgs(argv);

  // Get .doc-detective JSON or YAML config, if it exists, preferring a config arg if provided
  const configPathJSON = path.resolve(process.cwd(), ".doc-detective.json");
  const configPathYAML = path.resolve(process.cwd(), ".doc-detective.yaml");
  const configPathYML = path.resolve(process.cwd(), ".doc-detective.yml");
  const configPath = fs.existsSync(argv.config)
    ? argv.config
    : fs.existsSync(configPathJSON)
    ? configPathJSON
    : fs.existsSync(configPathYAML)
    ? configPathYAML
    : fs.existsSync(configPathYML)
    ? configPathYML
    : null;

  // Set config
  const config = await setConfig({ configPath: configPath, args: argv });

  log(
    config,
    "debug",
    `CLI:VERSION INFO:\n${JSON.stringify(getVersionData(), null, 2)}`
  );
  log(config, "debug", `CLI:CONFIG:\n${JSON.stringify(config, null, 2)}`);

  // Check for DOC_DETECTIVE_API environment variable
  let api = await getResolvedTestsFromEnv(config);
  let resolvedTests = api?.resolvedTests || null;
  let apiConfig = api?.apiConfig || null;

  // Run tests directly using doc-detective-core
  const { runTests } = require("doc-detective-core");
  const output = config.output;
  const results = resolvedTests
    ? await runTests(config, { resolvedTests })
    : await runTests(config);

  if (apiConfig) {
    await reportResults({ config, apiConfig, results });
  } else {
    // Output results
    await outputResults(config, output, results, { 
      command: "runTests",
    });
  }
}
