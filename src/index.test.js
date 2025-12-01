const assert = require("assert");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const fs = require("fs");
const { detectTests, resolveTests, detectAndResolveTests } = require("./index");

before(async function () {
  const { expect } = await import("chai");
  global.expect = expect;
});

describe("detectTests", function () {
  let setConfigStub, qualifyFilesStub, parseTestsStub, logStub;
  let detectTests;
  let configInput, configResolved, files, specs;

  beforeEach(function () {
    configInput = { foo: "bar" };
    configResolved = { ...configInput, environment: "test" };
    files = ["file1.js", "file2.js"];
    specs = [{ name: "spec1" }, { name: "spec2" }];

    setConfigStub = sinon.stub().resolves(configResolved);
    qualifyFilesStub = sinon.stub().resolves(files);
    parseTestsStub = sinon.stub().resolves(specs);
    logStub = sinon.stub();

    detectTests = proxyquire("./index", {
      "./config": { setConfig: setConfigStub },
      "./utils": {
        qualifyFiles: qualifyFilesStub,
        parseTests: parseTestsStub,
        log: logStub,
      },
    }).detectTests;
  });

  afterEach(function () {
    sinon.restore();
  });

  it("should resolve config if environment is not set", async function () {
    await detectTests({ config: configInput });
    assert(setConfigStub.calledOnceWith({ config: configInput }));
    assert(qualifyFilesStub.calledOnceWith({ config: configResolved }));
    assert(parseTestsStub.calledOnceWith({ config: configResolved, files }));
    assert(logStub.calledWith(configResolved, "debug", "CONFIG:"));
    assert(logStub.calledWith(configResolved, "debug", configResolved));
  });

  it("should not resolve config if environment is set", async function () {
    const configWithEnv = { ...configInput, environment: "already" };
    await detectTests({ config: configWithEnv });
    assert(setConfigStub.notCalled);
    assert(qualifyFilesStub.calledOnceWith({ config: configWithEnv }));
    assert(parseTestsStub.calledOnceWith({ config: configWithEnv, files }));
  });

  it("should log files and specs", async function () {
    await detectTests({ config: configInput });
    assert(logStub.calledWith(configResolved, "debug", "FILES:"));
    assert(logStub.calledWith(configResolved, "debug", files));
    assert(logStub.calledWith(configResolved, "debug", "SPECS:"));
    assert(logStub.calledWith(configResolved, "info", specs));
  });

  it("should return the parsed specs", async function () {
    const result = await detectTests({ config: configInput });
    assert.strictEqual(result, specs);
  });

  it("should correctly parse a complicated input", async function () {
    // Simulate a config with complex structure and multiple files/specs
    const complicatedConfig = {
      foo: "bar",
      nested: { a: 1, b: [2, 3] },
      environment: undefined,
    };
    const complicatedResolved = {
      ...complicatedConfig,
      environment: "complicated",
    };
    const complicatedFiles = [
      "src/feature/alpha.js",
      "src/feature/beta.js",
      "src/feature/gamma.js",
    ];
    const complicatedSpecs = [
      { name: "alpha", steps: [1, 2, 3], meta: { tags: ["a", "b"] } },
      { name: "beta", steps: [4, 5], meta: { tags: ["b"] } },
      { name: "gamma", steps: [], meta: { tags: [] } },
    ];

    setConfigStub.resolves(complicatedResolved);
    qualifyFilesStub.resolves(complicatedFiles);
    parseTestsStub.resolves(complicatedSpecs);

    const result = await detectTests({ config: complicatedConfig });

    assert(setConfigStub.calledOnceWith({ config: complicatedConfig }));
    assert(qualifyFilesStub.calledOnceWith({ config: complicatedResolved }));
    assert(
      parseTestsStub.calledOnceWith({
        config: complicatedResolved,
        files: complicatedFiles,
      })
    );
    assert(logStub.calledWith(complicatedResolved, "debug", "FILES:"));
    assert(logStub.calledWith(complicatedResolved, "debug", complicatedFiles));
    assert(logStub.calledWith(complicatedResolved, "debug", "SPECS:"));
    assert(logStub.calledWith(complicatedResolved, "info", complicatedSpecs));
    assert.strictEqual(result, complicatedSpecs);
  });
});

// Input/output comparisons.
const yamlInput = `
tests:
- steps:
  - httpRequest:
      url: http://localhost:8080/api/users
      method: post
      request:
        body:
          name: John Doe
          job: Software Engineer
      response:
        body:
          name: John Doe
          job: Software Engineer
  - httpRequest:
      url: http://localhost:8080/api/users
      method: post
      request:
        body:
          data:
            - first_name: George
              last_name: Bluth
              id: 1
      response:
        body:
          data:
            - first_name: George
              last_name: Bluth
    variables:
      ID: $$response.body.data[0].id
  - httpRequest:
      url: http://localhost:8080/api/users/$ID
      method: get
      timeout: 1000
    savePath: response.json
    maxVariation: 0
    overwrite: aboveVariation
`;

const markdownInlineYaml = `
# Doc Detective documentation overview

<!-- test
testId: doc-detective-docs
detectSteps: false
-->

[Doc Detective documentation](http://doc-detective.com) is split into a few key sections:

<!-- step checkLink: "https://doc-detective.com" -->

- The landing page discusses what Doc Detective is, what it does, and who might find it useful.
- [Get started](https://doc-detective.com/docs/get-started/intro) covers how to quickly get up and running with Doc Detective.

  <!-- step checkLink: "https://doc-detective.com/docs/get-started/intro" -->

Some pages also have unique headings. If you open [type](https://doc-detective.com/docs/get-started/actions/type) it has **Special keys**.

<!-- step goTo: "https://doc-detective.com/docs/get-started/actions/type" -->
<!-- step find: Special keys -->

![Search results.](reference.png){ .screenshot }
<!-- step screenshot: reference.png -->
`;

const markdownInput = `
# Doc Detective documentation overview

[Doc Detective documentation](https://doc-detective.com) is split into a few key sections:

- The landing page discusses what Doc Detective is, what it does, and who might find it useful.
- [Get started](https://doc-detective.com/get-started.html) covers how to quickly get up and running with Doc Detective.
- The [references](https://doc-detective.com/reference/) detail the various JSON objects that Doc Detective expects for [configs](https://doc-detective.com/reference/schemas/config.html), [test specifications](https://doc-detective.com/reference/schemas/specification.html), [tests](https://doc-detective.com/reference/schemas/test), actions, and more. Open [typeKeys](https://doc-detective.com/reference/schemas/typeKeys.html)--or any other schema--and you'll find three sections: **Description**, **Fields**, and **Examples**.

![Search results.](reference.png)
`;

const codeInMarkdown = `
\`\`\`bash
# This is a bash code block
echo "Hello, World!"
\`\`\`

\`\`\`javascript
// This is a JavaScript code block
console.log("Hello, World!");
\`\`\`

\`\`\`python
# This is a Python code block
print("Hello, World!")
\`\`\`

\`\`\`bash testIgnore
# This is a bash code block that should be ignored
echo "This should not be detected as a test step"
\`\`\`
`;

describe("Input/output detect comparisons", async function () {
  it("should correctly parse YAML input", async function () {
    // Create temp yaml file
    const tempYamlFile = "temp.yaml";
    fs.writeFileSync(tempYamlFile, yamlInput.trim());
    const config = {
      input: tempYamlFile,
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempYamlFile); // Clean up temp file
    expect(results).to.contain.keys(["config", "specs", "resolvedTestsId"]);
    expect(results.specs).to.be.an("array").that.is.not.empty;
    expect(results.specs[0]).to.have.property("specId").that.is.a("string");
    expect(results.specs[0]).to.have.property("tests").that.is.an("array").that
      .is.not.empty;
    expect(results.specs[0].tests[0]).to.have.property("testId").that.is.a("string");
    expect(results.specs[0].tests[0])
      .to.have.property("contexts")
      .that.is.an("array").that.is.not.empty;
      const context = results.specs[0].tests[0].contexts[0];
    expect(context).to.have.property("contextId").that.is.a("string");
    expect(context).to.not.have.property("platform");
    expect(context).to.not.have.property("browser");
    expect(context)
      .to.have.property("steps")
      .that.is.an("array").that.is.not.empty;
    expect(context.steps).to.have.lengthOf(3);
  });

  it("should correctly parse markdown inline YAML input", async function () {
    // Create temp markdown file
    const tempMarkdownFile = "temp.md";
    fs.writeFileSync(tempMarkdownFile, markdownInlineYaml.trim());
    const config = {
      input: tempMarkdownFile,
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempMarkdownFile); // Clean up temp file
    const steps = results.specs[0].tests[0].contexts[0].steps;
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(5);
  });

  it("should correctly parse markdown detected input", async function () {
    // Create temp markdown file
    const tempMarkdownFile = "temp_full.md";
    fs.writeFileSync(tempMarkdownFile, markdownInput.trim());
    const config = {
      input: tempMarkdownFile,
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempMarkdownFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(11);
  });

  it("should correctly parse code in markdown input", async function () {
    // Create temp markdown file
    const tempMarkdownFile = "temp_code.md";
    fs.writeFileSync(tempMarkdownFile, codeInMarkdown.trim());
    const config = {
      input: tempMarkdownFile,
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempMarkdownFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(3);
  });
});

const ditaXmlInput = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic</title>
  <?doc-detective test
testId: dita-xml-test
detectSteps: false
?>
  <body>
    <p>This is a test paragraph.</p>
    <?doc-detective step checkLink: "https://example.com" ?>
    <p>Another paragraph with a test step.</p>
    <?doc-detective step find: "test text" ?>
  </body>
  <?doc-detective test end?>
</topic>
`;

const ditaXmlInputWindows = `<?xml version="1.0" encoding="UTF-8"?>\r
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">\r
<topic id="test_topic">\r
  <title>Test Topic with Windows Line Endings</title>\r
  <?doc-detective test\r
testId: dita-xml-windows-test\r
detectSteps: false\r
?>\r
  <body>\r
    <p>This is a test paragraph.</p>\r
    <?doc-detective step checkLink: "https://example.com" ?>\r
    <p>Another paragraph with a test step.</p>\r
    <?doc-detective step find: "test text" ?>\r
  </body>\r
  <?doc-detective test end?>\r
</topic>\r
`;

const ditaXmlInputAttributes = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic with XML Attributes</title>
  <?doc-detective test testId="dita-xml-attributes-test" detectSteps=false ?>
  <body>
    <p>This is a test paragraph.</p>
    <?doc-detective step checkLink="https://example.com" ?>
    <p>Another paragraph with a test step.</p>
    <?doc-detective step find="test text" ?>
    <p>Test with numeric attribute</p>
    <?doc-detective step wait=500 ?>
  </body>
  <?doc-detective test end?>
</topic>
`;

describe("DITA XML Input Tests", function () {
  it("should correctly parse DITA XML with processing instruction tests", async function () {
    // Create temp DITA file
    const tempDitaFile = "temp_test.dita";
    fs.writeFileSync(tempDitaFile, ditaXmlInput.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: ["<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>"],
            testEnd: ["<\\?doc-detective\\s+test\\s+end\\s*\\?>"],
            ignoreStart: ["<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>"],
            ignoreEnd: ["<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>"],
            step: ["<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>"],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(2);
  });

  it("should correctly parse DITA XML with Windows line endings", async function () {
    // Create temp DITA file with Windows line endings
    const tempDitaFile = "temp_test_windows.dita";
    fs.writeFileSync(tempDitaFile, ditaXmlInputWindows.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: ["<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>"],
            testEnd: ["<\\?doc-detective\\s+test\\s+end\\s*\\?>"],
            ignoreStart: ["<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>"],
            ignoreEnd: ["<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>"],
            step: ["<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>"],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(2);
  });

  it("should correctly parse DITA XML with XML-style attributes", async function () {
    // Create temp DITA file with XML attribute syntax
    const tempDitaFile = "temp_test_attributes.dita";
    fs.writeFileSync(tempDitaFile, ditaXmlInputAttributes.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: ["<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>"],
            testEnd: ["<\\?doc-detective\\s+test\\s+end\\s*\\?>"],
            ignoreStart: ["<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>"],
            ignoreEnd: ["<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>"],
            step: ["<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>"],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-xml-attributes-test");
    expect(results.specs[0].tests[0].detectSteps).to.equal(false);
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(3);
    // Verify the wait step has a numeric value
    const waitStep = results.specs[0].tests[0].contexts[0].steps[2];
    expect(waitStep).to.have.property("wait").that.equals(500);
  });

  it("should correctly parse DITA XML with XML-style dot notation attributes", async function () {
    const ditaXmlInputDotNotation = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic with Dot Notation</title>
  <?doc-detective test testId="dita-xml-dot-notation-test" detectSteps=false ?>
  <body>
    <p>Test with dot notation for nested objects.</p>
    <?doc-detective step httpRequest.url="https://example.com/api/test" httpRequest.method="GET" ?>
    <p>Another step with nested properties.</p>
    <?doc-detective step httpRequest.url="https://example.com/api/submit" httpRequest.method="POST" httpRequest.request.body="test data" ?>
  </body>
  <?doc-detective test end?>
</topic>
`;
    // Create temp DITA file with dot notation attributes
    const tempDitaFile = "temp_test_dot_notation.dita";
    fs.writeFileSync(tempDitaFile, ditaXmlInputDotNotation.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: ["<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>"],
            testEnd: ["<\\?doc-detective\\s+test\\s+end\\s*\\?>"],
            ignoreStart: ["<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>"],
            ignoreEnd: ["<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>"],
            step: ["<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>"],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-xml-dot-notation-test");
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(2);
    
    // Verify the first step has nested httpRequest object
    const step1 = results.specs[0].tests[0].contexts[0].steps[0];
    expect(step1).to.have.property("httpRequest");
    expect(step1.httpRequest).to.have.property("url").that.equals("https://example.com/api/test");
    expect(step1.httpRequest).to.have.property("method").that.equals("GET");
    
    // Verify the second step has deeper nested structure
    const step2 = results.specs[0].tests[0].contexts[0].steps[1];
    expect(step2).to.have.property("httpRequest");
    expect(step2.httpRequest).to.have.property("url").that.equals("https://example.com/api/submit");
    expect(step2.httpRequest).to.have.property("method").that.equals("POST");
    expect(step2.httpRequest).to.have.property("request");
    expect(step2.httpRequest.request).to.have.property("body").that.equals("test data");
  });

  it("should correctly parse DITA XML with HTML comment-style tests", async function () {
    const ditaHtmlCommentInput = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic with HTML Comments</title>
  <!-- test
testId: dita-html-comment-test
detectSteps: false
-->
  <body>
    <p>This is a test paragraph.</p>
    <!-- step checkLink: "https://example.com" -->
    <p>Another paragraph with a test step.</p>
    <!-- step find: "test text" -->
  </body>
  <!-- test end -->
</topic>
`;
    // Create temp DITA file
    const tempDitaFile = "temp_test_html_comments.dita";
    fs.writeFileSync(tempDitaFile, ditaHtmlCommentInput.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: [
              "<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*test\\s*([\\s\\S]*?)\\s*-->",
            ],
            testEnd: [
              "<\\?doc-detective\\s+test\\s+end\\s*\\?>",
              "<!--\\s*test end\\s*([\\s\\S]*?)\\s*-->",
            ],
            ignoreStart: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>",
              "<!--\\s*test ignore start\\s*-->",
            ],
            ignoreEnd: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>",
              "<!--\\s*test ignore end\\s*-->",
            ],
            step: [
              "<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*step\\s*([\\s\\S]*?)\\s*-->",
            ],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-html-comment-test");
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(2);
  });

  it("should correctly detect DITA markup patterns", async function () {
    const ditaMarkupInput = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic with Markup Detection</title>
  <!-- test
testId: dita-markup-test
detectSteps: true
-->
  <body>
    <p>Check this link: <xref href="https://example.com">Example Site</xref></p>
    <p>Click <b>Submit Button</b> to continue.</p>
    <p>Find <b>search text</b> on the page.</p>
    <p>Go to <xref href="https://test.com">Test Site</xref></p>
    <p>Type "sample text" in the field.</p>
    <codeblock outputclass="bash">echo "Hello World"</codeblock>
  </body>
  <!-- test end -->
</topic>
`;
    // Create temp DITA file
    const tempDitaFile = "temp_test_markup.dita";
    fs.writeFileSync(tempDitaFile, ditaMarkupInput.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: [
              "<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*test\\s*([\\s\\S]*?)\\s*-->",
            ],
            testEnd: [
              "<\\?doc-detective\\s+test\\s+end\\s*\\?>",
              "<!--\\s*test end\\s*([\\s\\S]*?)\\s*-->",
            ],
            ignoreStart: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>",
              "<!--\\s*test ignore start\\s*-->",
            ],
            ignoreEnd: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>",
              "<!--\\s*test ignore end\\s*-->",
            ],
            step: [
              "<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*step\\s*([\\s\\S]*?)\\s*-->",
            ],
          },
          markup: [
            {
              name: "checkHyperlink",
              regex: [
                '<xref\\s+href="(https?:\\/\\/[^"]+)"[^>]*>',
              ],
              actions: ["checkLink"],
            },
            {
              name: "clickOnscreenText",
              regex: [
                "\\b(?:[Cc]lick|[Tt]ap|[Ll]eft-click|[Cc]hoose|[Ss]elect|[Cc]heck)\\b\\s+<b>((?:(?!<\\/b>).)+)<\\/b>",
              ],
              actions: ["click"],
            },
            {
              name: "findOnscreenText",
              regex: ["<b>((?:(?!<\\/b>).)+)<\\/b>"],
              actions: ["find"],
            },
            {
              name: "goToUrl",
              regex: [
                '\\b(?:[Gg]o\\s+to|[Oo]pen|[Nn]avigate\\s+to|[Vv]isit|[Aa]ccess|[Pp]roceed\\s+to|[Ll]aunch)\\b\\s+<xref\\s+href="(https?:\\/\\/[^"]+)"[^>]*>',
              ],
              actions: ["goTo"],
            },
            {
              name: "typeText",
              regex: ['\\b(?:[Pp]ress|[Ee]nter|[Tt]ype)\\b\\s+"([^"]+)"'],
              actions: ["type"],
            },
            {
              name: "runCode",
              regex: [
                "<codeblock[^>]*outputclass=\"(bash|python|py|javascript|js)\"[^>]*>([\\s\\S]*?)<\\/codeblock>",
              ],
              actions: [
                {
                  unsafe: true,
                  runCode: {
                    language: "$1",
                    code: "$2",
                  },
                },
              ],
            },
          ],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-markup-test");
    expect(results.specs[0].tests[0].contexts).to.be.an("array").that.has.lengthOf(1);
    const steps = results.specs[0].tests[0].contexts[0].steps;
    expect(steps).to.be.an("array");
    expect(steps.length).to.be.at.least(3);
    
    // Verify checkLink step
    const checkLinkStep = steps.find(s => s.checkLink);
    expect(checkLinkStep).to.exist;
    expect(checkLinkStep.checkLink).to.equal("https://example.com");
    
    // Verify click step
    const clickStep = steps.find(s => s.click && s.click === "Submit Button");
    expect(clickStep).to.exist;
    
    // Verify type step
    const typeStep = steps.find(s => s.type);
    expect(typeStep).to.exist;
    expect(typeStep.type).to.equal("sample text");
  });

  it("should correctly parse DITA with mixed processing instructions and HTML comments", async function () {
    const ditaMixedInput = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="test_topic">
  <title>Test Topic with Mixed Syntax</title>
  <?doc-detective test testId="dita-mixed-test" detectSteps=false ?>
  <body>
    <p>Step with PI syntax.</p>
    <?doc-detective step checkLink: "https://example.com" ?>
    <p>Step with HTML comment syntax.</p>
    <!-- step find: "test text" -->
    <p>Another PI step.</p>
    <?doc-detective step wait=1000 ?>
  </body>
  <!-- test end -->
</topic>
`;
    // Create temp DITA file
    const tempDitaFile = "temp_test_mixed.dita";
    fs.writeFileSync(tempDitaFile, ditaMixedInput.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: [
              "<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*test\\s*([\\s\\S]*?)\\s*-->",
            ],
            testEnd: [
              "<\\?doc-detective\\s+test\\s+end\\s*\\?>",
              "<!--\\s*test end\\s*([\\s\\S]*?)\\s*-->",
            ],
            ignoreStart: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>",
              "<!--\\s*test ignore start\\s*-->",
            ],
            ignoreEnd: [
              "<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>",
              "<!--\\s*test ignore end\\s*-->",
            ],
            step: [
              "<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>",
              "<!--\\s*step\\s*([\\s\\S]*?)\\s*-->",
            ],
          },
          markup: [],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-mixed-test");
    expect(results.specs[0].tests[0].contexts[0].steps).to.be.an("array").that.has.lengthOf(3);
    
    // Verify all three steps are present
    const steps = results.specs[0].tests[0].contexts[0].steps;
    expect(steps[0]).to.have.property("checkLink").that.equals("https://example.com");
    expect(steps[1]).to.have.property("find").that.equals("test text");
    expect(steps[2]).to.have.property("wait").that.equals(1000);
  });

  it("should correctly detect DITA task elements with enhanced markup patterns", async function () {
    const ditaTaskInput = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="test_task">
  <title>Test Task with Enhanced Markup</title>
  <!-- test
testId: dita-task-enhanced-test
detectSteps: true
-->
  <taskbody>
    <steps>
      <step>
        <cmd>Click the <uicontrol>Submit</uicontrol> button</cmd>
      </step>
      <step>
        <cmd>Type <userinput>testuser</userinput> into the <uicontrol>Username</uicontrol> field</cmd>
      </step>
      <step>
        <cmd>Navigate to <xref href="https://example.com" format="html" scope="external">Example Site</xref></cmd>
      </step>
      <step>
        <cmd>Verify the output shows <systemoutput>Success</systemoutput></cmd>
      </step>
      <step>
        <cmd>Press <shortcut>Ctrl+S</shortcut> to save</cmd>
      </step>
      <step>
        <cmd>Execute <cmdname>npm install</cmdname></cmd>
      </step>
      <step>
        <cmd>Run the command</cmd>
        <info>
          <codeblock outputclass="shell">echo "Hello World"</codeblock>
        </info>
      </step>
    </steps>
  </taskbody>
  <!-- test end -->
</task>
`;
    // Create temp DITA file
    const tempDitaFile = "temp_test_task_enhanced.dita";
    fs.writeFileSync(tempDitaFile, ditaTaskInput.trim());
    const config = {
      input: tempDitaFile,
      fileTypes: [
        {
          name: "dita",
          extensions: ["dita", "ditamap", "xml"],
          inlineStatements: {
            testStart: ["<!--\\s*test\\s*([\\s\\S]*?)\\s*-->"],
            testEnd: ["<!--\\s*test end\\s*([\\s\\S]*?)\\s*-->"],
            ignoreStart: ["<!--\\s*test ignore start\\s*-->"],
            ignoreEnd: ["<!--\\s*test ignore end\\s*-->"],
            step: ["<!--\\s*step\\s*([\\s\\S]*?)\\s*-->"],
          },
          markup: [
            {
              name: "clickUiControl",
              regex: ["<cmd>\\s*(?:[Cc]lick|[Tt]ap|[Ss]elect|[Pp]ress|[Cc]hoose)\\s+(?:the\\s+)?<uicontrol>([^<]+)<\\/uicontrol>"],
              actions: ["click"],
            },
            {
              name: "typeIntoUiControl",
              regex: ["<cmd>\\s*(?:[Tt]ype|[Ee]nter|[Ii]nput)\\s+<userinput>([^<]+)<\\/userinput>\\s+(?:in|into)(?:\\s+the)?\\s+<uicontrol>([^<]+)<\\/uicontrol>"],
              actions: [{ type: { keys: "$1", selector: "$2" } }],
            },
            {
              name: "navigateToXref",
              regex: ['<cmd>\\s*(?:[Nn]avigate\\s+to|[Oo]pen|[Gg]o\\s+to|[Vv]isit|[Bb]rowse\\s+to)\\s+<xref\\s+[^>]*href="(https?:\\/\\/[^"]+)"[^>]*>'],
              actions: ["goTo"],
            },
            {
              name: "verifySystemOutput",
              regex: ["<cmd>\\s*(?:[Vv]erify|[Cc]heck|[Cc]onfirm|[Ee]nsure)\\s+[^<]*<systemoutput>([^<]+)<\\/systemoutput>"],
              actions: ["find"],
            },
            {
              name: "keyboardShortcut",
              regex: ["<cmd>\\s*(?:[Pp]ress)\\s+<shortcut>([^<]+)<\\/shortcut>"],
              actions: [{ type: { keys: "$1" } }],
            },
            {
              name: "executeCmdName",
              regex: ["<cmd>\\s*(?:[Ee]xecute|[Rr]un)\\s+<cmdname>([^<]+)<\\/cmdname>"],
              actions: [{ runShell: { command: "$1" } }],
            },
            {
              name: "runShellCmdWithCodeblock",
              regex: ["<cmd>\\s*(?:[Rr]un|[Ee]xecute)\\s+(?:the\\s+)?(?:command)[^<]*<\\/cmd>\\s*<info>\\s*<codeblock[^>]*outputclass=\"(?:shell|bash)\"[^>]*>([\\s\\S]*?)<\\/codeblock>"],
              actions: [{ runShell: { command: "$1" } }],
            },
          ],
        }
      ],
    };
    const results = await detectAndResolveTests({ config });
    fs.unlinkSync(tempDitaFile); // Clean up temp file
    
    expect(results.specs).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests).to.be.an("array").that.has.lengthOf(1);
    expect(results.specs[0].tests[0].testId).to.equal("dita-task-enhanced-test");
    
    const steps = results.specs[0].tests[0].contexts[0].steps;
    expect(steps).to.be.an("array").that.has.length.greaterThan(5);
    
    // Verify specific step types
    // Step 1: Click action
    const clickStep = steps.find(s => s.click === "Submit");
    expect(clickStep).to.exist;
    
    // Step 2: Type action with selector
    const typeStep = steps.find(s => s.type && s.type.keys === "testuser");
    expect(typeStep).to.exist;
    expect(typeStep.type.selector).to.equal("Username");
    
    // Step 3: GoTo action
    const gotoStep = steps.find(s => s.goTo === "https://example.com");
    expect(gotoStep).to.exist;
    
    // Step 4: Find action
    const findStep = steps.find(s => s.find === "Success");
    expect(findStep).to.exist;
    
    // Step 5: Type for shortcut
    const shortcutStep = steps.find(s => s.type && s.type.keys === "Ctrl+S");
    expect(shortcutStep).to.exist;
    
    // Step 6: RunShell for cmdname
    const cmdnameStep = steps.find(s => s.runShell && s.runShell.command === "npm install");
    expect(cmdnameStep).to.exist;
    
    // Step 7: RunShell for codeblock
    const codeblockStep = steps.find(s => s.runShell && s.runShell.command && s.runShell.command.includes("Hello World"));
    expect(codeblockStep).to.exist;
  });
});
