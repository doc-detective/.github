const assert = require("assert");
const fs = require("fs");
const path = require("path");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("DITA HTTP Request Detection", function () {
  it("should match HTTP request in DITA codeblock", function () {
    // The regex pattern from config.js for DITA httpRequestFormat
    const pattern = "<codeblock[^>]*outputclass=\"http\"[^>]*>\\s*([A-Z]+)\\s+([^\\s]+)(?:\\s+HTTP\\/[\\d.]+)?\\s*(?:\\r?\\n|&#xA;)((?:[^\\s<]+:\\s+[^\\r\\n<]+(?:\\r?\\n|&#xA;))*)(?:\\s*(?:\\r?\\n|&#xA;)([\\s\\S]*?))?\\s*<\\/codeblock>";
    const regex = new RegExp(pattern);

    const testContent = `<codeblock outputclass="http">POST /api/users HTTP/1.1
Content-Type: application/json
Authorization: Bearer token123

{
  "username": "testuser",
  "email": "test@example.com"
}</codeblock>`;

    const match = testContent.match(regex);
    
    expect(match).to.not.be.null;
    expect(match[1]).to.equal("POST"); // method
    expect(match[2]).to.equal("/api/users"); // url
    expect(match[3]).to.include("Content-Type:"); // headers
    expect(match[3]).to.include("Authorization:"); // headers
    expect(match[4]).to.include('"username"'); // body
  });

  it("should match HTTP request without body", function () {
    const pattern = "<codeblock[^>]*outputclass=\"http\"[^>]*>\\s*([A-Z]+)\\s+([^\\s]+)(?:\\s+HTTP\\/[\\d.]+)?\\s*(?:\\r?\\n|&#xA;)((?:[^\\s<]+:\\s+[^\\r\\n<]+(?:\\r?\\n|&#xA;))*)(?:\\s*(?:\\r?\\n|&#xA;)([\\s\\S]*?))?\\s*<\\/codeblock>";
    const regex = new RegExp(pattern);

    const testContent = `<codeblock outputclass="http">GET /api/users HTTP/1.1
Authorization: Bearer token123
</codeblock>`;

    const match = testContent.match(regex);
    
    expect(match).to.not.be.null;
    expect(match[1]).to.equal("GET");
    expect(match[2]).to.equal("/api/users");
    expect(match[3]).to.include("Authorization:");
  });

  it("should match HTTP request with XML entities for newlines", function () {
    const pattern = "<codeblock[^>]*outputclass=\"http\"[^>]*>\\s*([A-Z]+)\\s+([^\\s]+)(?:\\s+HTTP\\/[\\d.]+)?\\s*(?:\\r?\\n|&#xA;)((?:[^\\s<]+:\\s+[^\\r\\n<]+(?:\\r?\\n|&#xA;))*)(?:\\s*(?:\\r?\\n|&#xA;)([\\s\\S]*?))?\\s*<\\/codeblock>";
    const regex = new RegExp(pattern);

    const testContent = `<codeblock outputclass="http">POST /api/users HTTP/1.1&#xA;Content-Type: application/json&#xA;&#xA;{"username": "test"}</codeblock>`;

    const match = testContent.match(regex);
    
    expect(match).to.not.be.null;
    expect(match[1]).to.equal("POST");
    expect(match[2]).to.equal("/api/users");
  });

  it("should match HTTP request with different outputclass attribute position", function () {
    const pattern = "<codeblock[^>]*outputclass=\"http\"[^>]*>\\s*([A-Z]+)\\s+([^\\s]+)(?:\\s+HTTP\\/[\\d.]+)?\\s*(?:\\r?\\n|&#xA;)((?:[^\\s<]+:\\s+[^\\r\\n<]+(?:\\r?\\n|&#xA;))*)(?:\\s*(?:\\r?\\n|&#xA;)([\\s\\S]*?))?\\s*<\\/codeblock>";
    const regex = new RegExp(pattern);

    const testContent = `<codeblock id="example" outputclass="http">DELETE /api/users/123 HTTP/1.1
Authorization: Bearer token123
</codeblock>`;

    const match = testContent.match(regex);
    
    expect(match).to.not.be.null;
    expect(match[1]).to.equal("DELETE");
    expect(match[2]).to.equal("/api/users/123");
    expect(match[3]).to.include("Authorization:");
  });

  it("should not match codeblock without http outputclass", function () {
    const pattern = "<codeblock[^>]*outputclass=\"http\"[^>]*>\\s*([A-Z]+)\\s+([^\\s]+)(?:\\s+HTTP\\/[\\d.]+)?\\s*(?:\\r?\\n|&#xA;)((?:[^\\s<]+:\\s+[^\\r\\n<]+(?:\\r?\\n|&#xA;))*)(?:\\s*(?:\\r?\\n|&#xA;)([\\s\\S]*?))?\\s*<\\/codeblock>";
    const regex = new RegExp(pattern);

    const testContent = `<codeblock outputclass="bash">curl -X POST /api/users</codeblock>`;

    const match = testContent.match(regex);
    
    expect(match).to.be.null;
  });
});
