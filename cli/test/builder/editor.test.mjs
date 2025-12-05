/**
 * CLI Editor Integration Tests
 * 
 * Tests the --editor flag CLI entry point and argument parsing.
 * Uses spawnCommand() pattern from existing CLI tests.
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { expect } = await import('chai');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to CLI entry point
const CLI_PATH = path.resolve(__dirname, '../../src/index.js');

// Helper to create temp directory with cleanup
const createTempDir = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-editor-test-'));
  return tempDir;
};

// Helper to create a test spec file
const createTestSpecFile = (dir, filename, content) => {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return filePath;
};

// Helper to spawn CLI with timeout (for interactive commands)
const spawnWithTimeout = async (args, options = {}) => {
  const { spawn } = await import('child_process');
  const timeout = options.timeout || 3000;
  
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, ...options.env },
      cwd: options.cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // For interactive commands, we can't wait for natural exit
    // Send interrupt after timeout to capture initial output
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeout);
    
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: 1, error: err.message });
    });
  });
};

describe('CLI Editor Integration', function() {
  // These tests may take time due to CLI startup
  this.timeout(30000);
  
  let tempDir;
  
  beforeEach(() => {
    tempDir = createTempDir();
  });
  
  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  describe('--editor flag recognition', () => {
    it('should recognize --editor flag', async () => {
      // Create a valid spec file
      const specContent = {
        id: 'test-spec',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'test.spec.json', specContent);
      
      // Run with --editor flag - it will start interactive mode
      // We just want to verify it starts without immediate errors
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      // Interactive mode should not produce errors on startup
      // It may exit with SIGTERM since we kill it
      expect(result.stderr).to.not.include('Error:');
      expect(result.stderr).to.not.include('SyntaxError');
    });
    
    it('should recognize -e short flag', async () => {
      const specContent = {
        id: 'test-spec',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'test.spec.json', specContent);
      
      const result = await spawnWithTimeout(['-e', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('Error:');
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
  
  describe('input file handling', () => {
    it('should accept --input flag with spec file', async () => {
      const specContent = {
        id: 'input-test-spec',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'input-test.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '--input', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      // Should not have startup errors
      expect(result.stderr).to.not.include('SyntaxError');
    });
    
    it('should accept -i short flag with spec file', async () => {
      const specContent = {
        id: 'short-flag-test',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'short-flag.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
    
    it('should accept --input=value format', async () => {
      const specContent = {
        id: 'equals-format-test',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'equals-format.spec.json', specContent);
      
      const result = await spawnWithTimeout([`--editor`, `--input=${specPath}`], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
    
    it('should error when no valid specs found', async () => {
      // Create an empty file that won't be detected as a valid spec
      const emptyPath = path.join(tempDir, 'empty.txt');
      fs.writeFileSync(emptyPath, '');
      
      const result = await spawnWithTimeout(['--editor', '-i', emptyPath], {
        timeout: 3000,
        cwd: tempDir,
      });
      
      // Should have an error message about no valid specs
      expect(result.stderr).to.include('No valid spec files');
    });
    
    it('should accept comma-separated input paths', async () => {
      const spec1Content = {
        id: 'multi-input-1',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const spec2Content = {
        id: 'multi-input-2',
        tests: [{
          id: 'test-2',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath1 = createTestSpecFile(tempDir, 'multi1.spec.json', spec1Content);
      const specPath2 = createTestSpecFile(tempDir, 'multi2.spec.json', spec2Content);
      
      const result = await spawnWithTimeout(
        ['--editor', '-i', `${specPath1},${specPath2}`],
        {
          timeout: 2000,
          cwd: tempDir,
        }
      );
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
  
  describe('YAML spec file support', () => {
    it('should accept YAML spec files', async () => {
      // Create a YAML spec file
      const yamlContent = `id: yaml-test-spec
tests:
  - id: yaml-test-1
    steps:
      - action: wait
        duration: 100
`;
      const yamlPath = path.join(tempDir, 'test.spec.yaml');
      fs.writeFileSync(yamlPath, yamlContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', yamlPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
  
  describe('positional arguments', () => {
    it('should accept spec file path as positional argument', async () => {
      const specContent = {
        id: 'positional-test',
        tests: [{
          id: 'test-1',
          steps: [{ action: 'wait', duration: 100 }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'positional.spec.json', specContent);
      
      // Pass file path as positional argument (after --editor)
      const result = await spawnWithTimeout(['--editor', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
});
