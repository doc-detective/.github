/**
 * Tests for DebugRunner.mjs - Interactive step-by-step test execution component
 * 
 * Uses ink-testing-library for component rendering and Sinon for stubbing getRunner.
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { createRequire } from 'module';
import * as sinon from 'sinon';

const require = createRequire(import.meta.url);

import DebugRunner from '../../src/cli/builder/DebugRunner.mjs';
import {
  getMockTest,
  getMockGoToStep,
  getMockClickStep,
  getMockFindStep,
  getMockStepResult,
  getMockFailedStepResult,
} from './fixtures.mjs';

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});

describe('DebugRunner component', function () {
  // Store original require for stubbing
  let coreModule;
  let sandbox;
  
  before(function () {
    // Get reference to doc-detective-core module
    coreModule = require('doc-detective-core');
  });
  
  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });
  
  afterEach(function () {
    sandbox.restore();
  });

  describe('initialization phase', function () {
    it('shows loading message during initialization', function () {
      // Stub getRunner to delay initialization
      sandbox.stub(coreModule, 'getRunner').returns(new Promise(() => {})); // Never resolves
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      const frame = lastFrame();
      expect(frame).to.include('Starting browser');
    });
  });

  describe('goTo requirement check', function () {
    it('shows warning when first browser action has no goTo', async function () {
      // Create a mock runner that resolves quickly
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockClickStep('.button')], // Click without goTo first
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Navigation');
    });

    it('proceeds to step preview when goTo exists', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [
          getMockGoToStep('https://example.com'),
          getMockClickStep('.button'),
        ],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Step 1');
    });
  });

  describe('step preview phase', function () {
    it('displays current step information', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('goTo');
      expect(frame).to.include('example.com');
    });

    it('shows Run this step option', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Run this step');
    });

    it('shows Edit step option', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Edit step');
    });

    it('shows Stop debug session option', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Stop debug');
    });

    it('displays step count correctly', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [
          getMockGoToStep('https://example.com'),
          getMockClickStep('.button'),
          getMockFindStep('.result'),
        ],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('1/3');
    });
  });

  describe('error handling', function () {
    it('shows error phase when runner initialization fails', async function () {
      sandbox.stub(coreModule, 'getRunner').rejects(new Error('Browser not installed'));
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('Error');
      expect(frame).to.include('Browser');
    });
  });

  describe('progress tracking', function () {
    it('displays passed/failed counts', async function () {
      const mockRunner = { browser: {} };
      const mockRunStep = sandbox.stub().resolves(getMockStepResult());
      const mockCleanup = sandbox.stub().resolves();
      
      sandbox.stub(coreModule, 'getRunner').resolves({
        runner: mockRunner,
        runStep: mockRunStep,
        cleanup: mockCleanup,
      });
      
      const test = getMockTest({
        steps: [getMockGoToStep('https://example.com')],
      });
      
      const { lastFrame } = render(
        React.createElement(DebugRunner, {
          test,
          testIndex: 0,
          onComplete: () => {},
          onCancel: () => {},
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const frame = lastFrame();
      expect(frame).to.include('passed');
      expect(frame).to.include('failed');
    });
  });
});

describe('DebugRunner smoke test', function () {
  this.timeout(60000); // Browser tests can be slow
  
  // Skip by default - enable for integration testing
  // Remove .skip to run actual browser test
  describe.skip('real browser execution', function () {
    let server;
    
    before(async function () {
      // Use existing test server if available
      const { createServer } = await import('../server/index.js');
      server = createServer({ port: 8093 });
      await server.start();
    });
    
    after(async function () {
      if (server) {
        await server.stop();
      }
    });

    it('executes goTo step successfully with real browser', async function () {
      const { getRunner } = require('doc-detective-core');
      
      const { runner, runStep, cleanup } = await getRunner({ headless: true });
      
      try {
        const step = getMockGoToStep('http://localhost:8093');
        
        const result = await runStep({
          config: {},
          context: {},
          step,
          driver: runner,
          metaValues: {},
          options: {},
        });
        
        expect(result.status).to.equal('PASS');
      } finally {
        await cleanup();
      }
    });
  });
});
