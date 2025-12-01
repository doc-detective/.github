# DITA HTTP Request Detection

## Overview

The DITA file type now supports automatic detection of HTTP request patterns in codeblocks, mirroring the functionality available in Markdown files.

## Syntax

To have Doc Detective automatically detect and create `httpRequest` test steps from your DITA documentation, use a `<codeblock>` element with `outputclass="http"`:

```xml
<codeblock outputclass="http">METHOD /path HTTP/1.1
Header-Name: header-value
Another-Header: another-value

{
  "request": "body"
}
</codeblock>
```

## Example

Here's a complete DITA task that demonstrates HTTP request detection:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="create-user-task">
  <title>Creating a User</title>
  <taskbody>
    <context>
      <p>This task shows how to create a new user via the API.</p>
    </context>
    
    <?doc-detective test testId="create-user" detectSteps=true ?>
    
    <steps>
      <step>
        <cmd>Send a POST request to create a user:</cmd>
        <info>
          <codeblock outputclass="http">POST /api/v1/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "developer"
}</codeblock>
        </info>
        <stepresult>
          <p>The API returns a 201 Created status with the new user details.</p>
        </stepresult>
      </step>
    </steps>
    
    <?doc-detective test end ?>
    
  </taskbody>
</task>
```

## What Gets Detected

When Doc Detective processes the above DITA file with `detectSteps: true`, it will automatically create an `httpRequest` test step with:

- **Method**: Extracted from the first line (e.g., `POST`)
- **URL**: Extracted from the first line (e.g., `/api/v1/users`)
- **Headers**: Parsed from subsequent lines before the blank line
- **Body**: Content after the blank line (if present)

## Generated Test Step

The codeblock above would be converted to a test step like:

```json
{
  "httpRequest": {
    "method": "POST",
    "url": "/api/v1/users",
    "request": {
      "headers": "Host: api.example.com\nContent-Type: application/json\nAuthorization: Bearer YOUR_TOKEN\n",
      "body": "{\n  \"username\": \"newuser\",\n  \"email\": \"newuser@example.com\",\n  \"role\": \"developer\"\n}"
    }
  }
}
```

## Supported HTTP Methods

The pattern detects standard HTTP methods in uppercase:
- GET
- POST
- PUT
- PATCH
- DELETE
- HEAD
- OPTIONS

## Notes

- The `outputclass="http"` attribute is required for detection
- The HTTP version (e.g., `HTTP/1.1`) is optional
- Headers must be in `Name: Value` format
- A blank line separates headers from the body
- Works with both standard newlines (`\n`) and XML entity newlines (`&#xA;`)

## Comparison with Markdown

This feature mirrors the existing Markdown HTTP request detection, which uses triple-backtick code blocks with the `http` language identifier:

**Markdown:**
````markdown
```http
POST /api/users HTTP/1.1
Content-Type: application/json

{"username": "test"}
```
````

**DITA:**
```xml
<codeblock outputclass="http">POST /api/users HTTP/1.1
Content-Type: application/json

{"username": "test"}
</codeblock>
```

Both produce the same `httpRequest` test step.
