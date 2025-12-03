const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const path = require("path");
const fs = require("fs");
const os = require("os");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("Heretto Integration", function () {
  let heretto;
  let axiosStub;
  let axiosCreateStub;
  let mockClient;

  beforeEach(function () {
    // Create mock axios client
    mockClient = {
      get: sinon.stub(),
      post: sinon.stub(),
    };

    // Stub axios.create to return our mock client
    axiosCreateStub = sinon.stub().returns(mockClient);

    // Use proxyquire to inject stubbed axios
    heretto = proxyquire("../src/heretto", {
      axios: {
        create: axiosCreateStub,
      },
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe("createAuthHeader", function () {
    it("should create a Base64-encoded auth header", function () {
      const authHeader = heretto.createAuthHeader("user@example.com", "token123");
      
      // Base64 of "user@example.com:token123"
      const expected = Buffer.from("user@example.com:token123").toString("base64");
      expect(authHeader).to.equal(expected);
    });

    it("should handle special characters in credentials", function () {
      const authHeader = heretto.createAuthHeader("user@example.com", "p@ss:w0rd!");
      
      const expected = Buffer.from("user@example.com:p@ss:w0rd!").toString("base64");
      expect(authHeader).to.equal(expected);
    });
  });

  describe("createApiClient", function () {
    it("should create an axios client with correct config", function () {
      const herettoConfig = {
        organizationId: "thunderbird",
        username: "user@example.com",
        apiToken: "token123",
      };

      heretto.createApiClient(herettoConfig);

      expect(axiosCreateStub.calledOnce).to.be.true;
      const createConfig = axiosCreateStub.firstCall.args[0];
      expect(createConfig.baseURL).to.equal("https://thunderbird.heretto.com/ezdnxtgen/api/v2");
      expect(createConfig.headers.Authorization).to.include("Basic ");
      expect(createConfig.headers["Content-Type"]).to.equal("application/json");
    });
  });

  describe("findOrCreateScenario", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return existing scenario if found", async function () {
      const existingScenario = {
        id: "scenario-123",
        name: "Doc Detective",
      };

      mockClient.get.resolves({
        data: { content: [existingScenario, { id: "other", name: "Other" }] },
      });

      const result = await heretto.findOrCreateScenario(mockClient, mockLog, mockConfig);

      expect(result).to.deep.equal(existingScenario);
      expect(mockClient.get.calledOnce).to.be.true;
      expect(mockClient.post.called).to.be.false;
    });

    it("should create scenario if not found", async function () {
      const newScenario = {
        id: "new-scenario-123",
        name: "Doc Detective",
      };

      mockClient.get.resolves({
        data: { content: [{ id: "other", name: "Other Scenario" }] },
      });
      mockClient.post.resolves({ data: newScenario });

      const result = await heretto.findOrCreateScenario(mockClient, mockLog, mockConfig);

      expect(result).to.deep.equal(newScenario);
      expect(mockClient.get.calledOnce).to.be.true;
      expect(mockClient.post.calledOnce).to.be.true;
    });

    it("should return null if scenario fetch fails", async function () {
      mockClient.get.rejects(new Error("Network error"));

      const result = await heretto.findOrCreateScenario(mockClient, mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should return null if scenario creation fails", async function () {
      mockClient.get.resolves({ data: { content: [] } });
      mockClient.post.rejects(new Error("Permission denied"));

      const result = await heretto.findOrCreateScenario(mockClient, mockLog, mockConfig);

      expect(result).to.be.null;
    });
  });

  describe("triggerPublishingJob", function () {
    it("should trigger a publishing job", async function () {
      const expectedJob = {
        id: "job-123",
        status: "PENDING",
      };

      mockClient.post.resolves({ data: expectedJob });

      const result = await heretto.triggerPublishingJob(mockClient, "file-uuid", "scenario-id");

      expect(result).to.deep.equal(expectedJob);
      expect(mockClient.post.calledOnce).to.be.true;
      expect(mockClient.post.firstCall.args[0]).to.equal("/files/file-uuid/publishing-jobs");
      expect(mockClient.post.firstCall.args[1]).to.deep.equal({ scenarioId: "scenario-id" });
    });
  });

  describe("pollJobStatus", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return completed job", async function () {
      const completedJob = {
        id: "job-123",
        status: "COMPLETED",
      };

      mockClient.get.resolves({ data: completedJob });

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.deep.equal(completedJob);
    });

    it("should return null for failed job", async function () {
      const failedJob = {
        id: "job-123",
        status: "FAILED",
        errorMessage: "Build failed",
      };

      mockClient.get.resolves({ data: failedJob });

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should poll until completion", async function () {
      // Use fake timers to avoid waiting for real POLLING_INTERVAL_MS delays
      const clock = sinon.useFakeTimers();

      mockClient.get
        .onFirstCall().resolves({ data: { id: "job-123", status: "PENDING" } })
        .onSecondCall().resolves({ data: { id: "job-123", status: "PROCESSING" } })
        .onThirdCall().resolves({ data: { id: "job-123", status: "COMPLETED" } });

      const pollPromise = heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      // Advance time past the polling intervals
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);

      const result = await pollPromise;

      expect(result.status).to.equal("COMPLETED");
      expect(mockClient.get.callCount).to.equal(3);

      clock.restore();
    });
  });

  describe("loadHerettoContent", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return null if scenario creation fails", async function () {
      const herettoConfig = {
        name: "test-heretto",
        organizationId: "test-org",
        username: "user@example.com",
        apiToken: "token123",
        fileId: "file-uuid",
      };

      // Scenario fetch fails
      mockClient.get.rejects(new Error("Network error"));

      const result = await heretto.loadHerettoContent(herettoConfig, mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should return null if publishing job fails", async function () {
      const herettoConfig = {
        name: "test-heretto",
        organizationId: "test-org",
        username: "user@example.com",
        apiToken: "token123",
        fileId: "file-uuid",
      };

      // Scenario exists
      mockClient.get.onFirstCall().resolves({
        data: { content: [{ id: "scenario-123", name: "Doc Detective" }] },
      });

      // Job creation fails
      mockClient.post.rejects(new Error("Job creation failed"));

      const result = await heretto.loadHerettoContent(herettoConfig, mockLog, mockConfig);

      expect(result).to.be.null;
    });
  });

  describe("Constants", function () {
    it("should export expected constants", function () {
      expect(heretto.POLLING_INTERVAL_MS).to.equal(5000);
      expect(heretto.POLLING_TIMEOUT_MS).to.equal(300000);
      expect(heretto.SCENARIO_NAME).to.equal("Doc Detective");
    });
  });
});
