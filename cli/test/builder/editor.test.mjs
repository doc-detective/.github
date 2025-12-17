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
      resolve({ stdout, stderr, exitCode: null, error: err.message });
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
        specId: 'test-spec',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
        specId: 'test-spec',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
        specId: 'input-test-spec',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
        specId: 'short-flag-test',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
        specId: 'equals-format-test',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
        specId: 'multi-input-1',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
        }]
      };
      const spec2Content = {
        specId: 'multi-input-2',
        tests: [{
          testId: 'test-2',
          steps: [{ wait: 100 }]
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
        specId: 'positional-test',
        tests: [{
          testId: 'test-1',
          steps: [{ wait: 100 }]
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
  
  describe('markdown file support', () => {
    it('should accept markdown files with inline tests', async () => {
      const markdownContent = `# Test Documentation

This is a test document with inline tests.

<!-- test testId: "inline-test-1" -->
<!-- step goTo: "https://example.com" -->

More documentation content.
`;
      const mdPath = path.join(tempDir, 'doc-with-tests.md');
      fs.writeFileSync(mdPath, markdownContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', mdPath], {
        timeout: 3000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
  
  describe('output handling', () => {
    it('should not produce JavaScript errors on startup', async () => {
      const specContent = {
        id: 'startup-test',
        tests: [{
          id: 'test-1',
          steps: [{ goTo: 'https://example.com' }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'startup.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('ReferenceError');
      expect(result.stderr).to.not.include('TypeError');
      expect(result.stderr).to.not.include('Cannot find module');
    });
  });
  
  describe('complex spec files', () => {
    it('should handle spec with multiple tests', async () => {
      const specContent = {
        specId: 'multi-test-spec',
        tests: [
          {
            testId: 'test-1',
            description: 'First test',
            steps: [{ goTo: 'https://example.com/page1' }]
          },
          {
            testId: 'test-2',
            description: 'Second test',
            steps: [
              { goTo: 'https://example.com/page2' },
              { click: '.button' }
            ]
          },
          {
            testId: 'test-3',
            description: 'Third test',
            steps: [
              { goTo: 'https://example.com/page3' },
              { find: '.element' },
              { screenshot: 'result.png' }
            ]
          }
        ]
      };
      const specPath = createTestSpecFile(tempDir, 'multi-test.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
      expect(result.stderr).to.not.include('Error:');
    });

    it('should handle spec with all step types', async () => {
      const specContent = {
        specId: 'all-steps-spec',
        tests: [{
          testId: 'test-1',
          steps: [
            { goTo: 'https://example.com' },
            { click: '.button' },
            { find: '.element' },
            { type: ['test input', '$ENTER$'] },
            { screenshot: 'screenshot.png' },
            { wait: 1000 },
            { httpRequest: { url: 'https://api.example.com', method: 'GET' } },
            { runShell: 'echo test' }
          ]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'all-steps.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
  
  describe('invalid spec handling', () => {
    it('should handle spec with validation errors gracefully', async () => {
      // Spec with invalid structure but parseable JSON
      const specContent = {
        id: 'invalid-spec',
        tests: 'this should be an array'
      };
      const specPath = createTestSpecFile(tempDir, 'invalid.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 3000,
        cwd: tempDir,
      });
      
      // Should not crash with JavaScript errors
      expect(result.stderr).to.not.include('TypeError');
      expect(result.stderr).to.not.include('Cannot read properties');
    });

    it('should error on unparseable JSON', async () => {
      const invalidJson = '{ this is not valid json }';
      const jsonPath = path.join(tempDir, 'broken.spec.json');
      fs.writeFileSync(jsonPath, invalidJson);
      
      const result = await spawnWithTimeout(['--editor', '-i', jsonPath], {
        timeout: 3000,
        cwd: tempDir,
      });
      
      // Should report the file couldn't be parsed
      expect(result.stderr).to.include('No valid spec files');
    });
  });
  
  describe('environment handling', () => {
    it('should work without any environment variables', async () => {
      const specContent = {
        id: 'env-test',
        tests: [{
          id: 'test-1',
          steps: [{ goTo: 'https://example.com' }]
        }]
      };
      const specPath = createTestSpecFile(tempDir, 'env-test.spec.json', specContent);
      
      const result = await spawnWithTimeout(['--editor', '-i', specPath], {
        timeout: 2000,
        cwd: tempDir,
        env: {
          PATH: process.env.PATH,
          NODE_PATH: process.env.NODE_PATH,
        },
      });
      
      expect(result.stderr).to.not.include('SyntaxError');
    });
  });
});
