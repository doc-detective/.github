const { DebugManager } = require('../src/debug/DebugManager');
const assert = require('assert').strict;

describe('Debug Manager Tests', function() {
  this.timeout(5000);

  describe('Debug Manager Initialization', () => {
    it('should initialize correctly in non-debug mode', () => {
      const config = { debug: false };
      const debugManager = new DebugManager(config);
      
      assert.equal(debugManager.isDebugMode, false);
      assert.equal(debugManager.isStepThroughMode, false);
      assert.equal(debugManager.isBreakpointMode, false);
    });

    it('should initialize correctly in breakpoint debug mode', () => {
      const config = { debug: true };
      const debugManager = new DebugManager(config);
      
      assert.equal(debugManager.isDebugMode, true);
      assert.equal(debugManager.isStepThroughMode, false);
      assert.equal(debugManager.isBreakpointMode, true);
    });

    it('should initialize correctly in step-through debug mode', () => {
      const config = { debug: "stepThrough" };
      const debugManager = new DebugManager(config);
      
      assert.equal(debugManager.isDebugMode, true);
      assert.equal(debugManager.isStepThroughMode, true);
      assert.equal(debugManager.isBreakpointMode, false);
    });
  });

  describe('shouldPause logic', () => {
    it('should not pause in non-debug mode', () => {
      const config = { debug: false };
      const debugManager = new DebugManager(config);
      const step = { breakpoint: true };
      
      assert.equal(debugManager.shouldPause(step, false), false);
      assert.equal(debugManager.shouldPause(step, true), false);
    });

    it('should pause on failures in debug mode', () => {
      const config = { debug: true };
      const debugManager = new DebugManager(config);
      const step = { breakpoint: false };
      
      assert.equal(debugManager.shouldPause(step, true), true);
    });

    it('should pause on breakpoints in breakpoint mode', () => {
      const config = { debug: true };
      const debugManager = new DebugManager(config);
      const step = { breakpoint: true };
      
      assert.equal(debugManager.shouldPause(step, false), true);
    });

    it('should not pause on non-breakpoints in breakpoint mode', () => {
      const config = { debug: true };
      const debugManager = new DebugManager(config);
      const step = { breakpoint: false };
      
      assert.equal(debugManager.shouldPause(step, false), false);
    });

    it('should pause on every step in step-through mode', () => {
      const config = { debug: "stepThrough" };
      const debugManager = new DebugManager(config);
      const step = { breakpoint: false };
      
      assert.equal(debugManager.shouldPause(step, false), true);
    });
  });

  describe('getActionType', () => {
    it('should identify common action types', () => {
      const config = { debug: true };
      const debugManager = new DebugManager(config);
      
      assert.equal(debugManager.getActionType({ goTo: "https://example.com" }), "goTo");
      assert.equal(debugManager.getActionType({ click: "#button" }), "click");
      assert.equal(debugManager.getActionType({ wait: 1000 }), "wait");
      assert.equal(debugManager.getActionType({ screenshot: true }), "screenshot");
      assert.equal(debugManager.getActionType({ unknown: true }), "unknown");
    });
  });
});