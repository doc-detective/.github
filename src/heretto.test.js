const sinon = require("sinon");
const proxyquire = require("proxyquire");
const path = require("path");
const os = require("os");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("Heretto Integration", function () {
  let heretto;
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

  describe("findScenario", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return scenarioId and fileId when valid scenario is found", async function () {
      const existingScenario = {
        id: "scenario-123",
        name: "Doc Detective",
      };

      const scenarioParameters = {
        content: [
          { name: "transtype", value: "dita" },
          { name: "tool-kit-name", value: "default/dita-ot-3.6.1" },
          { type: "file_uuid_picker", value: "file-uuid-456" },
        ],
      };

      mockClient.get
        .onFirstCall().resolves({
          data: { content: [existingScenario, { id: "other", name: "Other" }] },
        })
        .onSecondCall().resolves({ data: scenarioParameters });

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.deep.equal({
        scenarioId: "scenario-123",
        fileId: "file-uuid-456",
      });
      expect(mockClient.get.calledTwice).to.be.true;
    });

    it("should return null if scenario is not found", async function () {
      mockClient.get.resolves({
        data: { content: [{ id: "other", name: "Other Scenario" }] },
      });

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.be.null;
      expect(mockClient.get.calledOnce).to.be.true;
    });

    it("should return null if scenario fetch fails", async function () {
      mockClient.get.rejects(new Error("Network error"));

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.be.null;
    });

    it("should return null if transtype parameter is incorrect", async function () {
      const existingScenario = {
        id: "scenario-123",
        name: "Doc Detective",
      };

      const scenarioParameters = {
        content: [
          { name: "transtype", value: "html5" },
          { name: "tool-kit-name", value: "default/dita-ot-3.6.1" },
          { type: "file_uuid_picker", value: "file-uuid-456" },
        ],
      };

      mockClient.get
        .onFirstCall().resolves({
          data: { content: [existingScenario] },
        })
        .onSecondCall().resolves({ data: scenarioParameters });

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.be.null;
    });

    it("should return null if tool-kit-name parameter is missing", async function () {
      const existingScenario = {
        id: "scenario-123",
        name: "Doc Detective",
      };

      const scenarioParameters = {
        content: [
          { name: "transtype", value: "dita" },
          { type: "file_uuid_picker", value: "file-uuid-456" },
        ],
      };

      mockClient.get
        .onFirstCall().resolves({
          data: { content: [existingScenario] },
        })
        .onSecondCall().resolves({ data: scenarioParameters });

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.be.null;
    });

    it("should return null if file_uuid_picker parameter is missing", async function () {
      const existingScenario = {
        id: "scenario-123",
        name: "Doc Detective",
      };

      const scenarioParameters = {
        content: [
          { name: "transtype", value: "dita" },
          { name: "tool-kit-name", value: "default/dita-ot-3.6.1" },
        ],
      };

      mockClient.get
        .onFirstCall().resolves({
          data: { content: [existingScenario] },
        })
        .onSecondCall().resolves({ data: scenarioParameters });

      const result = await heretto.findScenario(mockClient, mockLog, mockConfig, "Doc Detective");

      expect(result).to.be.null;
    });
  });

  describe("triggerPublishingJob", function () {
    it("should trigger a publishing job", async function () {
      const expectedJob = {
        jobId: "job-123",
        status: "PENDING",
      };

      mockClient.post.resolves({ data: expectedJob });

      const result = await heretto.triggerPublishingJob(mockClient, "file-uuid", "scenario-id");

      expect(result).to.deep.equal(expectedJob);
      expect(mockClient.post.calledOnce).to.be.true;
      expect(mockClient.post.firstCall.args[0]).to.equal("/files/file-uuid/publishes");
      expect(mockClient.post.firstCall.args[1]).to.deep.equal({ scenario: "scenario-id", parameters: [] });
    });

    it("should throw error when job creation fails", async function () {
      mockClient.post.rejects(new Error("API error"));

      try {
        await heretto.triggerPublishingJob(mockClient, "file-uuid", "scenario-id");
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect(error.message).to.equal("API error");
      }
    });
  });

  describe("getJobAssetDetails", function () {
    it("should return all asset file paths from single page", async function () {
      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/my-guide.ditamap" },
          { filePath: "ot-output/dita/topic1.dita" },
          { filePath: "ot-output/dita/topic2.dita" },
        ],
        totalPages: 1,
        number: 0,
        size: 100,
      };

      mockClient.get.resolves({ data: assetsResponse });

      const result = await heretto.getJobAssetDetails(mockClient, "file-uuid", "job-123");

      expect(result).to.deep.equal([
        "ot-output/dita/my-guide.ditamap",
        "ot-output/dita/topic1.dita",
        "ot-output/dita/topic2.dita",
      ]);
      expect(mockClient.get.calledOnce).to.be.true;
      expect(mockClient.get.firstCall.args[0]).to.equal("/files/file-uuid/publishes/job-123/assets");
    });

    it("should handle pagination and aggregate all assets", async function () {
      const page1Response = {
        content: [
          { filePath: "ot-output/dita/topic1.dita" },
          { filePath: "ot-output/dita/topic2.dita" },
        ],
        totalPages: 2,
        number: 0,
        size: 100,
      };

      const page2Response = {
        content: [
          { filePath: "ot-output/dita/topic3.dita" },
          { filePath: "ot-output/dita/my-guide.ditamap" },
        ],
        totalPages: 2,
        number: 1,
        size: 100,
      };

      mockClient.get
        .onFirstCall().resolves({ data: page1Response })
        .onSecondCall().resolves({ data: page2Response });

      const result = await heretto.getJobAssetDetails(mockClient, "file-uuid", "job-123");

      expect(result).to.deep.equal([
        "ot-output/dita/topic1.dita",
        "ot-output/dita/topic2.dita",
        "ot-output/dita/topic3.dita",
        "ot-output/dita/my-guide.ditamap",
      ]);
      expect(mockClient.get.calledTwice).to.be.true;
    });

    it("should return empty array when no assets", async function () {
      const assetsResponse = {
        content: [],
        totalPages: 1,
        number: 0,
        size: 100,
      };

      mockClient.get.resolves({ data: assetsResponse });

      const result = await heretto.getJobAssetDetails(mockClient, "file-uuid", "job-123");

      expect(result).to.deep.equal([]);
    });

    it("should skip assets without filePath", async function () {
      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/topic1.dita" },
          { otherField: "no-path" },
          { filePath: "ot-output/dita/topic2.dita" },
        ],
        totalPages: 1,
      };

      mockClient.get.resolves({ data: assetsResponse });

      const result = await heretto.getJobAssetDetails(mockClient, "file-uuid", "job-123");

      expect(result).to.deep.equal([
        "ot-output/dita/topic1.dita",
        "ot-output/dita/topic2.dita",
      ]);
    });
  });

  describe("validateDitamapInAssets", function () {
    it("should return true when ditamap is in ot-output/dita/", function () {
      const assets = [
        "ot-output/dita/topic1.dita",
        "ot-output/dita/my-guide.ditamap",
        "ot-output/dita/topic2.dita",
      ];

      const result = heretto.validateDitamapInAssets(assets);

      expect(result).to.be.true;
    });

    it("should return false when no ditamap is present", function () {
      const assets = [
        "ot-output/dita/topic1.dita",
        "ot-output/dita/topic2.dita",
      ];

      const result = heretto.validateDitamapInAssets(assets);

      expect(result).to.be.false;
    });

    it("should return false when ditamap is in wrong directory", function () {
      const assets = [
        "ot-output/other/my-guide.ditamap",
        "ot-output/dita/topic1.dita",
      ];

      const result = heretto.validateDitamapInAssets(assets);

      expect(result).to.be.false;
    });

    it("should return true when any ditamap is in correct directory", function () {
      const assets = [
        "ot-output/dita/different-guide.ditamap",
        "ot-output/dita/topic1.dita",
      ];

      const result = heretto.validateDitamapInAssets(assets);

      expect(result).to.be.true;
    });

    it("should return false when assets array is empty", function () {
      const result = heretto.validateDitamapInAssets([]);

      expect(result).to.be.false;
    });
  });

  describe("pollJobStatus", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return completed job when status.result is SUCCESS and ditamap is present", async function () {
      const completedJob = {
        id: "job-123",
        status: { status: "COMPLETED", result: "SUCCESS" },
      };

      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/my-guide.ditamap" },
          { filePath: "ot-output/dita/topic1.dita" },
        ],
        totalPages: 1,
      };

      mockClient.get
        .onFirstCall().resolves({ data: completedJob })
        .onSecondCall().resolves({ data: assetsResponse });

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.deep.equal(completedJob);
    });

    it("should return completed job when status.result is FAIL but ditamap is present", async function () {
      const failedJob = {
        id: "job-123",
        status: { status: "FAILED", result: "FAIL" },
      };

      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/my-guide.ditamap" },
          { filePath: "ot-output/dita/topic1.dita" },
        ],
        totalPages: 1,
      };

      mockClient.get
        .onFirstCall().resolves({ data: failedJob })
        .onSecondCall().resolves({ data: assetsResponse });

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.deep.equal(failedJob);
    });

    it("should return null when job completes but ditamap is missing", async function () {
      const completedJob = {
        id: "job-123",
        status: { status: "COMPLETED", result: "SUCCESS" },
      };

      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/topic1.dita" },
          { filePath: "ot-output/dita/topic2.dita" },
        ],
        totalPages: 1,
      };

      mockClient.get
        .onFirstCall().resolves({ data: completedJob })
        .onSecondCall().resolves({ data: assetsResponse });

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should poll until completion then validate assets", async function () {
      // Use fake timers to avoid waiting for real POLLING_INTERVAL_MS delays
      const clock = sinon.useFakeTimers();

      const assetsResponse = {
        content: [
          { filePath: "ot-output/dita/my-guide.ditamap" },
        ],
        totalPages: 1,
      };

      mockClient.get
        .onCall(0).resolves({ data: { id: "job-123", status: { status: "PENDING", result: null } } })
        .onCall(1).resolves({ data: { id: "job-123", status: { status: "PROCESSING", result: null } } })
        .onCall(2).resolves({ data: { id: "job-123", status: { status: "COMPLETED", result: "SUCCESS" } } })
        .onCall(3).resolves({ data: assetsResponse });

      const pollPromise = heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      // Advance time past the polling intervals
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);
      await clock.tickAsync(heretto.POLLING_INTERVAL_MS);

      const result = await pollPromise;

      expect(result.status.result).to.equal("SUCCESS");
      expect(mockClient.get.callCount).to.equal(4); // 3 status polls + 1 assets call

      clock.restore();
    });

    it("should return null on timeout", async function () {
      // Use fake timers to avoid waiting for real timeout
      const clock = sinon.useFakeTimers();

      // Always return PENDING status (never completes)
      mockClient.get.resolves({ 
        data: { id: "job-123", status: { status: "PENDING", result: null } } 
      });

      const pollPromise = heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      // Advance past the timeout
      await clock.tickAsync(heretto.POLLING_TIMEOUT_MS + heretto.POLLING_INTERVAL_MS);

      const result = await pollPromise;
      expect(result).to.be.null;

      clock.restore();
    });

    it("should return null when polling error occurs", async function () {
      mockClient.get.rejects(new Error("Network error"));

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should return null when asset validation fails", async function () {
      const completedJob = {
        id: "job-123",
        status: { status: "COMPLETED", result: "SUCCESS" },
      };

      mockClient.get
        .onFirstCall().resolves({ data: completedJob })
        .onSecondCall().rejects(new Error("Failed to fetch assets"));

      const result = await heretto.pollJobStatus(mockClient, "file-uuid", "job-123", mockLog, mockConfig);

      expect(result).to.be.null;
    });
  });

  describe("loadHerettoContent", function () {
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
    });

    it("should return null if scenario lookup fails", async function () {
      const herettoConfig = {
        name: "test-heretto",
        organizationId: "test-org",
        username: "user@example.com",
        apiToken: "token123",
        scenarioName: "Doc Detective",
      };

      // Scenario fetch fails
      mockClient.get.rejects(new Error("Network error"));

      const result = await heretto.loadHerettoContent(herettoConfig, mockLog, mockConfig);

      expect(result).to.be.null;
    });

    it("should return null if publishing job creation fails", async function () {
      const herettoConfig = {
        name: "test-heretto",
        organizationId: "test-org",
        username: "user@example.com",
        apiToken: "token123",
        scenarioName: "Doc Detective",
      };

      const scenarioParameters = {
        content: [
          { name: "transtype", value: "dita" },
          { name: "tool-kit-name", value: "default/dita-ot-3.6.1" },
          { type: "file_uuid_picker", value: "file-uuid-456" },
        ],
      };

      // Scenario exists with valid parameters
      mockClient.get
        .onFirstCall().resolves({
          data: { content: [{ id: "scenario-123", name: "Doc Detective" }] },
        })
        .onSecondCall().resolves({ data: scenarioParameters });

      // Job creation fails
      mockClient.post.rejects(new Error("Job creation failed"));

      const result = await heretto.loadHerettoContent(herettoConfig, mockLog, mockConfig);

      expect(result).to.be.null;
    });
  });

  describe("downloadAndExtractOutput", function () {
    let herettoWithMocks;
    let fsMock;
    let admZipMock;
    let mockEntries;
    const mockLog = sinon.stub();
    const mockConfig = { logLevel: "info" };

    beforeEach(function () {
      mockLog.reset();
      
      // Mock ZIP entries
      mockEntries = [
        { entryName: "file1.dita", isDirectory: false, getData: () => Buffer.from("content1") },
        { entryName: "subdir/", isDirectory: true, getData: () => Buffer.from("") },
        { entryName: "subdir/file2.dita", isDirectory: false, getData: () => Buffer.from("content2") },
      ];
      
      // Mock AdmZip
      admZipMock = sinon.stub().returns({
        getEntries: () => mockEntries,
        extractAllTo: sinon.stub(),
      });
      
      // Mock fs
      fsMock = {
        mkdirSync: sinon.stub(),
        writeFileSync: sinon.stub(),
        unlinkSync: sinon.stub(),
      };
      
      // Create heretto with mocked dependencies
      herettoWithMocks = proxyquire("../src/heretto", {
        axios: { create: axiosCreateStub },
        fs: fsMock,
        "adm-zip": admZipMock,
      });
    });

    it("should download and extract ZIP file successfully", async function () {
      const zipContent = Buffer.from("mock zip content");
      mockClient.get.resolves({ data: zipContent });

      const result = await herettoWithMocks.downloadAndExtractOutput(
        mockClient,
        "file-uuid",
        "job-123",
        "test-heretto",
        mockLog,
        mockConfig
      );

      expect(result).to.not.be.null;
      expect(result).to.include("heretto_");
      expect(fsMock.mkdirSync.called).to.be.true;
      expect(fsMock.writeFileSync.called).to.be.true;
      expect(fsMock.unlinkSync.called).to.be.true;
    });

    it("should return null when download fails", async function () {
      mockClient.get.rejects(new Error("Download failed"));

      const result = await herettoWithMocks.downloadAndExtractOutput(
        mockClient,
        "file-uuid",
        "job-123",
        "test-heretto",
        mockLog,
        mockConfig
      );

      expect(result).to.be.null;
    });

    it("should skip malicious ZIP entries with path traversal", async function () {
      // Add malicious entry
      mockEntries.push({ 
        entryName: "../../../etc/passwd", 
        isDirectory: false, 
        getData: () => Buffer.from("malicious") 
      });
      
      const zipContent = Buffer.from("mock zip content");
      mockClient.get.resolves({ data: zipContent });

      const result = await herettoWithMocks.downloadAndExtractOutput(
        mockClient,
        "file-uuid",
        "job-123",
        "test-heretto",
        mockLog,
        mockConfig
      );

      expect(result).to.not.be.null;
      // The warning log should be called for the malicious entry
      expect(mockLog.called).to.be.true;
    });
  });

  describe("Constants", function () {
    it("should export expected constants", function () {
      expect(heretto.POLLING_INTERVAL_MS).to.equal(5000);
      expect(heretto.POLLING_TIMEOUT_MS).to.equal(300000);
      expect(heretto.DEFAULT_SCENARIO_NAME).to.equal("Doc Detective");
    });
  });
});
