# Heretto Screenshot Sync

This document describes the automatic screenshot synchronization feature for the Heretto CMS integration.

## Overview

When Doc Detective runs tests against content sourced from Heretto CMS, any screenshots that change during test execution are automatically uploaded back to Heretto. This keeps documentation screenshots in sync with the actual application state without requiring manual intervention.

## Intent

Documentation screenshots frequently become outdated as applications evolve. Manually updating screenshots is time-consuming and error-prone. This feature automates the process:

1. **Run tests** - Doc Detective executes tests from Heretto-sourced content
2. **Detect changes** - Screenshots are compared against their baseline versions
3. **Upload automatically** - Changed screenshots are pushed back to Heretto

This creates a continuous synchronization loop where running tests not only validates documentation accuracy but also updates it.

## Architecture

The implementation spans two modules:

### Resolver Module

The resolver tracks the origin of content loaded from Heretto:

1. **Source tracking** - When parsing screenshot steps from Heretto content, the resolver attaches `sourceIntegration` metadata containing:
   - `type`: Integration type ("heretto")
   - `integrationName`: Name of the Heretto integration config
   - `filePath`: Path of the source file in Heretto
   - `contentPath`: Local path where content was downloaded

2. **Path mapping** - The resolver maintains a mapping (`_herettoPathMapping`) that tracks which local output directories correspond to which Heretto integrations

### Core Module

The core module handles change detection and uploads:

1. **Change detection** - The `saveScreenshot` action compares new screenshots against existing baselines using pixel-level comparison (pixelmatch). When the variation exceeds the configured threshold, the screenshot is marked as `changed: true`

2. **Integration uploader abstraction** - An extensible uploader system in `core/src/integrations/` allows multiple CMS integrations to handle uploads. Each uploader implements:
   - `canHandle(sourceIntegration)` - Returns true if it handles the integration type
   - `upload(options)` - Performs the actual upload

3. **Post-test orchestration** - After test execution completes, `runSpecs` calls `uploadChangedFiles()` which:
   - Collects all steps with `changed: true` and `sourceIntegration` metadata
   - Routes each to the appropriate uploader
   - Uses best-effort error handling (continues on individual failures)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RESOLVER                                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. Load content from Heretto API                                   │
│  2. Parse DITA/markdown for screenshot steps                        │
│  3. Attach sourceIntegration metadata to each screenshot step       │
│  4. Track path mappings for upload routing                          │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          CORE                                        │
├─────────────────────────────────────────────────────────────────────┤
│  5. Execute test specs                                              │
│  6. For each screenshot step:                                       │
│     - Capture new screenshot                                        │
│     - Compare against baseline                                      │
│     - Set changed=true if variation exceeds threshold               │
│     - Preserve sourceIntegration in outputs                         │
│  7. After all tests complete:                                       │
│     - Collect changed screenshots with sourceIntegration            │
│     - Upload each to its source CMS                                 │
│     - Report upload results                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Heretto API Usage

### File Search

When a screenshot lacks a pre-resolved file ID, the uploader searches Heretto by filename:

```
POST /ezdnxtgen/api/search
Content-Type: application/json
Authorization: Basic <base64(username:apiToken)>

{
  "queryString": "<filename>",
  "searchResultType": "FILES"
}
```

### File Upload

Changed screenshots are uploaded via the REST API:

```
PUT /rest/all-files/<document-id>/content
Content-Type: image/png
Authorization: Basic <base64(username:apiToken)>

<binary content>
```

## Error Handling

The upload process uses best-effort error handling:

- **Individual failures don't stop other uploads** - If one screenshot fails to upload, the system continues with remaining files
- **Results are logged and reported** - Upload successes, failures, and skipped items are tracked in `report.uploadResults`
- **Missing integrations are skipped** - If no matching integration config is found, the file is skipped with a warning

## Extensibility

The uploader abstraction supports adding new CMS integrations:

```javascript
const { registerUploader } = require('./integrations');

class MyCustomUploader {
  canHandle(sourceIntegration) {
    return sourceIntegration?.type === 'my-cms';
  }
  
  async upload({ config, integrationConfig, localFilePath, sourceIntegration, log }) {
    // Upload implementation
    return { status: 'PASS', description: 'Uploaded successfully' };
  }
}

registerUploader(new MyCustomUploader());
```

## Configuration

No additional configuration is required. Screenshot sync is automatic when:

1. Content is sourced from a Heretto integration
2. The Heretto integration has valid API credentials (`apiBaseUrl`, `username`, `apiToken`)
3. Screenshots change during test execution

## Limitations

- **Write access required** - The API token must have write permissions to update files in Heretto
- **File must exist in Heretto** - New screenshots (not already in Heretto) cannot be uploaded automatically
- **Search relies on filename** - If multiple files have the same name, the first match is used
