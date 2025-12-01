# DITA XML Test Detection

This document explains how to use DITA XML test detection with Doc Detective.

## Overview

DITA XML files can contain Doc Detective tests using XML processing instructions or by leveraging DITA's semantic markup. The resolver automatically detects tests in files with `.dita`, `.ditamap`, or `.xml` extensions when the DITA file type is configured.

## Detection Methods

### 1. Explicit Test Definition (Processing Instructions)

Use XML processing instructions to explicitly define tests:

**YAML format (multiline):**
```xml
<?doc-detective test
testId: my-test-id
detectSteps: false
?>
<!-- test content here -->
<?doc-detective test end?>
```

**XML attribute format (single line):**
```xml
<?doc-detective test testId="my-test-id" detectSteps=false ?>
<!-- test content here -->
<?doc-detective test end?>
```

### 2. Automatic Detection from DITA Markup

When `detectSteps: true` is enabled, Doc Detective automatically extracts test actions from DITA task elements:

#### Task Elements

**Click Actions** - Extracted from `<cmd>` with click verbs and `<uicontrol>`:
```xml
<step>
  <cmd>Click the <uicontrol>Submit</uicontrol> button</cmd>
</step>
```
→ Generates: `{ click: "Submit" }`

**Type Actions** - Extracted from `<cmd>` with type verbs, `<userinput>`, and `<uicontrol>`:
```xml
<step>
  <cmd>Type <userinput>testuser</userinput> into the <uicontrol>Username</uicontrol> field</cmd>
</step>
```
→ Generates: `{ type: { keys: "testuser", selector: "Username" } }`

**Navigation Actions** - Extracted from `<cmd>` with navigation verbs and `<xref>`:
```xml
<step>
  <cmd>Navigate to <xref href="https://example.com" format="html" scope="external">Example Site</xref></cmd>
</step>
```
→ Generates: `{ goTo: "https://example.com" }`

**Verification Actions** - Extracted from `<cmd>` with verify verbs and `<systemoutput>`:
```xml
<step>
  <cmd>Verify the output shows <systemoutput>Success</systemoutput></cmd>
</step>
```
→ Generates: `{ find: "Success" }`

**Keyboard Shortcuts** - Extracted from `<cmd>` with press verb and `<shortcut>`:
```xml
<step>
  <cmd>Press <shortcut>Ctrl+S</shortcut> to save</cmd>
</step>
```
→ Generates: `{ type: { keys: "Ctrl+S" } }`

**Shell Commands** - Extracted from `<cmd>` with run/execute verbs:

From `<cmdname>`:
```xml
<step>
  <cmd>Execute <cmdname>npm install</cmdname></cmd>
</step>
```
→ Generates: `{ runShell: { command: "npm install" } }`

From `<codeblock>` in `<info>`:
```xml
<step>
  <cmd>Run the command</cmd>
  <info>
    <codeblock outputclass="shell">echo "Hello World"</codeblock>
  </info>
</step>
```
→ Generates: `{ runShell: { command: "echo \"Hello World\"" } }`

#### Inline Elements

- `<uicontrol>` - UI element identifiers (buttons, fields, etc.)
- `<userinput>` - Text to type into fields
- `<systemoutput>` - Expected output text to verify
- `<wintitle>` - Window or dialog titles to find
- `<shortcut>` - Keyboard shortcuts
- `<cmdname>` - Command names to execute

#### Link Elements

**External Links** - Automatically checked:
```xml
<xref href="https://docs.example.com" scope="external">Documentation</xref>
```
→ Generates: `{ checkLink: "https://docs.example.com" }`

**Link Elements**:
```xml
<link href="https://example.com">Example</link>
```
→ Generates: `{ checkLink: "https://example.com" }`

#### Code Execution

**Shell/Bash Code**:
```xml
<codeblock outputclass="bash">
npm test
</codeblock>
```
→ Generates: `{ runShell: { command: "npm test" } }`

**Other Languages** (Python, JavaScript):
```xml
<codeblock outputclass="python">
print("Hello World")
</codeblock>
```
→ Generates: `{ unsafe: true, runCode: { language: "python", code: "print(\"Hello World\")" } }`

## Configuration

To enable DITA XML detection, add the DITA file type to your configuration:

```json
{
  "input": "path/to/dita/files",
  "fileTypes": [
    {
      "name": "dita",
      "extensions": ["dita", "ditamap", "xml"],
      "inlineStatements": {
        "testStart": ["<\\?doc-detective\\s+test\\s+([\\s\\S]*?)\\s*\\?>"],
        "testEnd": ["<\\?doc-detective\\s+test\\s+end\\s*\\?>"],
        "ignoreStart": ["<\\?doc-detective\\s+test\\s+ignore\\s+start\\s*\\?>"],
        "ignoreEnd": ["<\\?doc-detective\\s+test\\s+ignore\\s+end\\s*\\?>"],
        "step": ["<\\?doc-detective\\s+step\\s+([\\s\\S]*?)\\s*\\?>"]
      },
      "markup": []
    }
  ]
}
```

Or reference the built-in DITA definition:

```json
{
  "input": "path/to/dita/files",
  "fileTypes": ["markdown", "dita"]
}
```

Note: The built-in "dita" file type is not included by default. You must explicitly add it to your configuration.

## Example

See `test/example.dita` for a complete example of a DITA topic with embedded Doc Detective tests.

## Action Verb Patterns

The following verbs are recognized for automatic action extraction:

- **Click**: click, tap, select, press, choose
- **Type**: type, enter, input
- **Navigate**: navigate to, open, go to, visit, browse to
- **Verify**: verify, check, confirm, ensure
- **Execute**: run, execute

## Platform Compatibility

The patterns automatically handle both Unix (`\n`) and Windows (`\r\n`) line endings, ensuring cross-platform compatibility.

## Attribute Parsing

When using XML-style attributes:
- String values can be quoted: `name="value"` or unquoted: `name=value`
- Boolean values are recognized: `detectSteps=false` becomes `false` (boolean)
- Numeric values are parsed: `wait=500` becomes `500` (number)
- Dot notation creates nested objects: `httpRequest.url="https://example.com"` becomes `{ httpRequest: { url: "https://example.com" } }`

### Dot Notation for Nested Objects

You can use dot notation in attribute names to create nested object structures. This is particularly useful for complex actions like `httpRequest`:

**Example:**
```xml
<?doc-detective step httpRequest.url="https://api.example.com/users" httpRequest.method="GET" ?>
```

This creates:
```json
{
  "httpRequest": {
    "url": "https://api.example.com/users",
    "method": "GET"
  }
}
```

**Multi-level nesting:**
```xml
<?doc-detective step httpRequest.url="https://api.example.com/submit" httpRequest.method="POST" httpRequest.request.body="test data" ?>
```

This creates:
```json
{
  "httpRequest": {
    "url": "https://api.example.com/submit",
    "method": "POST",
    "request": {
      "body": "test data"
    }
  }
}
```

