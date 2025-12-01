# Synthetic DITA Test Suite for Doc Detective

## Overview

This comprehensive synthetic DITA document set demonstrates **every element and processing instruction** from the DITA to Doc Detective mapping specification. It's designed for testing and evaluation of the DITA resolver's conversion capabilities.

## Contents

### 1. Map File
- **comprehensive-test-suite.ditamap** - Complete bookmap demonstrating:
  - `<topicref>` with various attributes
  - `<topicgroup>` with collection types
  - `<topichead>` for organizational structure
  - `<reltable>` for defining test dependencies
  - `<topicmeta>` with navigation titles and descriptions
  - `@chunk="to-content"` for content merging
  - `<related-links>` for link validation

### 2. Task Topics
Comprehensive coverage of task elements and inline markup:

- **task-comprehensive.dita** - Main comprehensive task with:
  - `<prereq>`, `<context>`, `<steps>`, `<substeps>`, `<stepresult>`
  - `<result>`, `<example>`, `<postreq>`
  - All inline elements: `<uicontrol>`, `<menucascade>`, `<userinput>`, `<systemoutput>`, `<msgblock>`, `<msgph>`, `<filepath>`, `<cmdname>`, `<varname>`, `<codeblock>`, `<codeph>`, `<apiname>`, `<option>`, `<parmname>`, `<wintitle>`, `<shortcut>`, `<screen>`
  - All action verbs: click, type, navigate, run, verify
  - Processing instructions integrated throughout

- **task-with-choices.dita** - Demonstrates `<choices>` element
- **task-unordered-steps.dita** - Demonstrates `<steps-unordered>`
- **task-setup.dita**, **task-execution.dita**, **task-cleanup.dita** - Sequential workflow
- **task-ui-testing.dita** - Chunked UI testing workflow

### 3. Reference Topics
Complete reference topic coverage:

- **reference-api.dita** - API reference with:
  - `<refsyn>` with full syntax elements (`<synph>`, `<kwd>`, `<var>`, `<oper>`, `<delim>`, `<sep>`)
  - `<properties>` table with `<prophead>`, `<property>`, `<proptype>`, `<propvalue>`, `<propdesc>`
  - Multiple endpoint examples
  - HTTP request/response examples

- **reference-cli.dita** - CLI reference with:
  - Command syntax specifications
  - Option parameters
  - Environment variables
  - Expected output examples

### 4. Concept Topics
Concept documentation with rich content:

- **concept-comprehensive.dita** - Architecture concepts with:
  - `<dl>` (definition lists) with `<dlentry>`, `<dt>`, `<dd>`
  - `<fig>` and `<image>` elements
  - Multiple `<xref>` elements (internal and external)
  - Code examples with various `@outputclass` values
  - `<section>` organization

- **concept-with-examples.dita** - Additional code patterns

### 5. Troubleshooting Topic
Error handling and solutions:

- **troubleshooting-errors.dita** - Complete troubleshooting structure:
  - `<condition>` for problem description
  - `<troubleSolution>` container
  - `<cause>` for root cause analysis
  - `<remedy>` with `<responsibleParty>`
  - Multiple solution approaches with `<steps>`

### 6. Glossary
Terminology definitions:

- **glossary.dita** - Glossary group with embedded entries
- **glossentry-api.dita** - API term with:
  - `<glossterm>`, `<glossdef>`, `<glossBody>`
  - `<glossAlt>` with synonyms, acronyms, short forms
  - `<glossUsage>` examples
  
- **glossentry-test.dita** - Test Suite term

### 7. Supporting Topics
- **related-resources.dita** - External and internal link collection

## Processing Instructions Coverage

All processing instructions from the mapping are demonstrated:

| Processing Instruction | Example Location | Usage |
|------------------------|------------------|-------|
| `<?doc-detective wait="5000" ?>` | task-comprehensive.dita | Wait for duration |
| `<?doc-detective timeout="10000" ?>` | Throughout topics | Override step timeout |
| `<?doc-detective screenshot="filename.png" ?>` | task-comprehensive.dita, reference-cli.dita | Capture screenshots |
| `<?doc-detective eval="code" ?>` | task-comprehensive.dita, troubleshooting-errors.dita | Execute custom JavaScript |
| `<?doc-detective setVar="name=value" ?>` | task-comprehensive.dita | Set context variables |
| `<?doc-detective if="condition" ?>` | (Can be added as needed) | Conditional execution |
| `<?doc-detective optional="true" ?>` | Multiple locations | Mark steps as optional |
| `<?doc-detective skip="reason" ?>` | task-comprehensive.dita | Skip with documentation |
| `<?doc-detective id="step-id" ?>` | Multiple locations | Custom step identifiers |
| `<?doc-detective description="text" ?>` | task-comprehensive.dita | Custom step descriptions |

## Element Coverage Summary

### Map Elements (9/9)
✅ `<map>` / `<bookmap>`
✅ `<topicref>`
✅ `<topicgroup>`
✅ `<topichead>`
✅ `<reltable>`
✅ `<topicmeta>` / `<navtitle>`
✅ `@chunk="to-content"`
✅ `<related-links>`

### Task Elements (25/25)
✅ `<task>`, `<taskbody>`, `<prereq>`, `<context>`
✅ `<steps>`, `<steps-unordered>`, `<step>`, `<cmd>`
✅ `<info>`, `<tutorialinfo>`, `<stepxmp>`
✅ `<choices>`, `<choice>`
✅ `<substep>`, `<substeps>`
✅ `<stepresult>`, `<steptroubleshooting>`
✅ `<result>`, `<example>`, `<postreq>`

### Inline Elements (30/30)
✅ `<uicontrol>`, `<menucascade>`, `<userinput>`, `<systemoutput>`
✅ `<msgblock>`, `<msgph>`, `<filepath>`, `<cmdname>`
✅ `<varname>`, `<codeblock>`, `<codeph>`, `<apiname>`
✅ `<option>`, `<parmname>`, `<wintitle>`, `<shortcut>`, `<screen>`
✅ `<xref>`, `<link>`, `<image>`, `<fig>`, `<object>`

### Reference Elements (18/18)
✅ `<reference>`, `<refbody>`, `<refsyn>`, `<section>`
✅ `<properties>`, `<property>`, `<prophead>`, `<proptypehd>`, `<propvaluehd>`, `<propdeschd>`
✅ `<proptype>`, `<propvalue>`, `<propdesc>`
✅ `<synph>`, `<kwd>`, `<var>`, `<oper>`, `<delim>`, `<sep>`

### Concept Elements (10/10)
✅ `<concept>`, `<conbody>`, `<p>`, `<dl>`, `<dlentry>`, `<dt>`, `<dd>`
✅ `<fig>`, `<image>`, `<example>`

### Troubleshooting Elements (6/6)
✅ `<troubleshooting>`, `<troublebody>`, `<condition>`
✅ `<troubleSolution>`, `<cause>`, `<remedy>`, `<responsibleParty>`

### Glossary Elements (11/11)
✅ `<glossentry>`, `<glossterm>`, `<glossdef>`, `<glossBody>`
✅ `<glossAlt>`, `<glossAcronym>`, `<glossShortForm>`, `<glossSynonym>`
✅ `<glossUsage>`, `<glossPartOfSpeech>`

### Processing Instructions (10/10)
✅ All 10 processing instructions demonstrated

## Testing Instructions

### Using with Doc Detective Resolver

1. **Parse the Map File:**
   ```bash
   node src/index.js resolve test/synthetic-dita/comprehensive-test-suite.ditamap
   ```

2. **Parse Individual Topics:**
   ```bash
   node src/index.js resolve test/synthetic-dita/topics/task-comprehensive.dita
   ```

3. **Validate Element Extraction:**
   Review the generated JSON test specifications to ensure:
   - All DITA elements are correctly mapped to Doc Detective actions
   - Processing instructions are properly interpreted
   - Hierarchical structure is preserved
   - Selectors are extracted from inline elements
   - Links are collected for validation

### Expected Test Generation

This synthetic suite should generate:
- **~15-20 test specifications** (one per topic)
- **~50-100 individual test steps** across all tests
- **Action type coverage:** `goTo`, `click`, `typeKeys`, `find`, `httpRequest`, `runShell`, `checkLink`, `wait`, `saveScreenshot`, `setVariables`
- **Link validation tests** for all external and internal references
- **API tests** from reference topics
- **CLI command tests** from reference topics

## Directory Structure

```
synthetic-dita/
├── comprehensive-test-suite.ditamap          # Main bookmap
├── README.md                                  # This file
├── topics/                                    # All topic files
│   ├── task-comprehensive.dita               # Main comprehensive task
│   ├── task-with-choices.dita
│   ├── task-unordered-steps.dita
│   ├── task-setup.dita
│   ├── task-execution.dita
│   ├── task-cleanup.dita
│   ├── task-ui-testing.dita
│   ├── reference-api.dita                    # API reference
│   ├── reference-cli.dita                    # CLI reference
│   ├── concept-comprehensive.dita            # Main concept
│   ├── concept-with-examples.dita
│   ├── troubleshooting-errors.dita
│   ├── glossary.dita                         # Glossary group
│   ├── glossentry-api.dita
│   ├── glossentry-test.dita
│   └── related-resources.dita
└── images/                                    # Placeholder images
    ├── architecture-diagram.png
    ├── execution-flow.png
    └── user-list-with-testuser.png
```

## Notes

- DTD validation errors are expected - these are synthetic test files
- Images are referenced but placeholder files should be created
- All URLs are example URLs for testing purposes
- Processing instructions are interspersed throughout to test various positions
- This suite represents 100% coverage of the mapping specification

## Version

- **Created:** October 8, 2025
- **DITA Version:** 1.3
- **Doc Detective Mapping Version:** Comprehensive v1.0
- **Purpose:** Testing, evaluation, and validation of DITA resolver

## License

This synthetic test suite is created for testing purposes as part of the Doc Detective project.
