# Manual Testing Checklist: Documentation Import Feature

This checklist covers manual testing scenarios for the AI-powered documentation import feature in the CLI test builder.

## Prerequisites

- [ ] Doc Detective CLI installed (`npm i -g doc-detective` or working in cloned repo)
- [ ] API key set: `export ANTHROPIC_API_KEY=your_key` or `export OPENAI_API_KEY=your_key`
- [ ] Sample documentation files available (markdown or DITA)

## Basic Flow

### 1. Launch Builder
- [ ] Run `npx doc-detective --editor`
- [ ] Builder starts successfully
- [ ] Main menu displays

### 2. Check API Key Detection
- [ ] **With API key set**: Menu shows "📄 Import from documentation"
- [ ] **Without API key**: Menu shows "⚠️ Import from documentation (requires API key)"
- [ ] Selecting without key shows setup instructions with links to Anthropic and OpenAI
- [ ] Setup screen has "Back to menu" option that works

### 3. Import Documentation
- [ ] Select "Import from documentation" from menu
- [ ] File browser appears
- [ ] Current directory is displayed
- [ ] Directories show 📁 icon
- [ ] Files show 📄 icon
- [ ] Only supported files are shown (.md, .markdown, .dita, .xml)
- [ ] Can navigate into subdirectories
- [ ] Can navigate to parent directory with ".." option
- [ ] Escape key cancels and returns to menu

### 4. File Preview
- [ ] Select a markdown file
- [ ] Preview screen shows:
  - [ ] File name
  - [ ] Detected format
  - [ ] First 500 characters of content
  - [ ] Import and Back options
- [ ] "Back" returns to file browser
- [ ] Escape key returns to file browser

### 5. Parsing
- [ ] Select "Import this file"
- [ ] "Parsing documentation..." message appears
- [ ] Transitions to generation progress (or error if parse fails)

### 6. Generation Progress
- [ ] Progress header displays: "Generating Tests from Documentation"
- [ ] Progress bar shows: `[████░░░░] current/total (percentage%)`
- [ ] Currently processing chunk shows with spinner
- [ ] Chunk heading is displayed
- [ ] Progress updates for each chunk
- [ ] When complete, shows "✓ Generation complete!"
- [ ] Transitions to review screen

### 7. Review Generated Tests
- [ ] Review screen shows "Review Generated Tests"
- [ ] Each chunk listed with:
  - [ ] Status icon (○ pending, ✓ accepted, ✗ rejected)
  - [ ] Chunk heading
  - [ ] Test counts (e.g., "3 new, 1 preserved")
  - [ ] Error indicator if generation failed (⚠️ ERROR)
- [ ] Separator line between items and actions
- [ ] Bulk actions visible when pending items exist:
  - [ ] "✓ Accept all"
  - [ ] "✗ Reject all"
- [ ] "→ Continue with accepted tests" visible when accepted items exist
- [ ] "← Cancel" always visible

### 8. Review Detail View
- [ ] Select a chunk item
- [ ] Detail screen shows:
  - [ ] Chunk heading
  - [ ] Line numbers (e.g., "Lines 10-25")
  - [ ] Preserved tests section (if any) in green
  - [ ] Generated tests section with JSON preview
  - [ ] Error message if generation failed (in red)
  - [ ] Actions: Accept, Reject, Regenerate, Back
- [ ] Escape key returns to list view

### 9. Test Actions
- [ ] **Accept**: Changes status icon to ✓, returns to list
- [ ] **Reject**: Changes status icon to ✗, returns to list
- [ ] **Regenerate**: Shows "regenerating" status (⟳), makes new API call, updates with new tests
- [ ] **Accept All**: Marks all pending items as accepted
- [ ] **Reject All**: Marks all pending items as rejected

### 10. Continue with Tests
- [ ] Select "Continue with accepted tests"
- [ ] Returns to main menu
- [ ] Accepted tests are added to the spec
- [ ] Tests appear in the "Tests (N)" section
- [ ] Can edit imported tests like any other test

## Edge Cases

### Empty Document
- [ ] Import a markdown file with no headings or minimal content
- [ ] Should show "⚠️ No Testable Content" message
- [ ] Options to try another file or return to menu
- [ ] Both options work correctly

### Parse Error
- [ ] Import a corrupted or invalid file
- [ ] Should show "❌ Parse Error" message
- [ ] Clear error explanation
- [ ] Options to try another file or return to menu

### API Failure
- [ ] Temporarily use invalid API key
- [ ] Import should partially succeed
- [ ] Failed chunks show ⚠️ ERROR indicator
- [ ] Error details visible in chunk detail view
- [ ] Can regenerate failed chunks

### Large Document
- [ ] Import a large markdown file (>5000 lines)
- [ ] Progress bar updates smoothly
- [ ] All chunks are processed
- [ ] No timeout or crash

### Inline Tests Preservation
- [ ] Import markdown file with existing inline tests (JSON/YAML in comments)
- [ ] Review screen shows "N preserved" count
- [ ] Detail view highlights preserved tests in green
- [ ] Both preserved and generated tests are added to spec

## Integration with Existing Features

### Merge with Existing Spec
- [ ] Create a new spec with 2 tests
- [ ] Import documentation and accept 3 more tests
- [ ] Spec now has 5 tests total
- [ ] All tests are editable

### Edit Imported Test
- [ ] Import and accept a test
- [ ] Select the imported test from menu
- [ ] Test editor opens
- [ ] Can modify description, steps, etc.
- [ ] Changes are saved correctly

### Debug Imported Test
- [ ] Import and accept a test with goTo and click steps
- [ ] Select "Run and debug test"
- [ ] Choose the imported test
- [ ] Debug runner executes the test
- [ ] Steps can be stepped through

### Save Spec with Imported Tests
- [ ] Import and accept tests
- [ ] Select "Save specification"
- [ ] Spec saves successfully
- [ ] Reload the spec
- [ ] Imported tests are present
- [ ] sourceLocation metadata is preserved

## Cancel Operations

### Cancel at Each Stage
- [ ] Cancel from file browser → returns to menu
- [ ] Cancel from preview → returns to file browser
- [ ] Cancel from review screen → clears import state, returns to menu
- [ ] Escape key works at appropriate stages

## Multiple Format Support

### Markdown
- [ ] Import .md file → parses successfully
- [ ] Import .markdown file → parses successfully
- [ ] Chunks split by ## and ### headings
- [ ] Hierarchy preserved in metadata

### DITA (Future)
- [ ] Import .dita file → should show "coming soon" or work if implemented
- [ ] Import .xml file with DITA content

## Performance

### Reasonable Timing
- [ ] Small doc (5 chunks) completes in < 2 minutes
- [ ] Medium doc (20 chunks) shows smooth progress
- [ ] Progress never appears "stuck"
- [ ] UI remains responsive during generation

## Error Recovery

### Regeneration
- [ ] Fail a chunk (temporarily invalid key)
- [ ] Select "Regenerate" on failed chunk
- [ ] Fix API key
- [ ] Regeneration succeeds
- [ ] Status updates to pending
- [ ] Can accept regenerated test

## Cleanup

### State Management
- [ ] Complete an import flow
- [ ] Start a new import
- [ ] Previous import state is cleared
- [ ] No leftover data from previous import

## Accessibility

### Keyboard Navigation
- [ ] Arrow keys navigate menu items
- [ ] Enter selects items
- [ ] Escape cancels/goes back
- [ ] Tab key (if applicable) works correctly

### Visual Feedback
- [ ] Status icons are clear and distinguishable
- [ ] Colors are used appropriately (green for success, red for errors, yellow for warnings)
- [ ] Progress indicators are visible
- [ ] Error messages are readable

## Final Verification

- [ ] All tests from checklist pass
- [ ] No crashes or unhandled errors encountered
- [ ] Feature works as documented in README
- [ ] User experience is smooth and intuitive

## Notes

Record any issues, unexpected behavior, or suggestions for improvement below:

```
[Add notes here]
```
