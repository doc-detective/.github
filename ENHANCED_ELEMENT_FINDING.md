# Enhanced Element Finding Feature

## Overview

This feature enhances element finding capabilities across Doc Detective actions by adding five new optional fields. These fields provide more precise element targeting while maintaining full backward compatibility.

## Affected Actions

The following actions now support enhanced element finding:

- `click` - Click elements with precise criteria
- `find` - Find and optionally interact with elements
- `type` - Type into specific elements
- `screenshot` - Screenshot specific elements (via crop parameter)

## New Fields

All new fields are **optional** and support regex pattern matching using `/pattern/` syntax.

### elementId
- **Type**: `string`
- **Description**: Matches the element's `id` attribute
- **Example**: `"submit-button"` or `"/submit-.+/"`

### elementTestId
- **Type**: `string`
- **Description**: Matches the element's `data-testid` attribute
- **Example**: `"login-form-submit"` or `"/.*-submit/"`

### elementClass
- **Type**: `string` or `array of strings`
- **Description**: Element must have ALL specified classes
- **Examples**:
  - `"btn-primary"`
  - `["btn", "btn-large"]`
  - `["/btn-.+/", "active"]`

### elementAttribute
- **Type**: `object`
- **Description**: Element must have ALL specified attributes with matching values
- **Value Types**:
  - String: `"value"` or `"/pattern/"`
  - Number: `42`
  - Boolean: `true` (present) or `false` (absent)
- **Example**:
  ```json
  {
    "aria-label": "Close dialog",
    "data-count": 5,
    "disabled": true,
    "href": "/^https:/"
  }
  ```

### elementAltText
- **Type**: `string`
- **Description**: Matches the element's `alt` attribute (typically for images)
- **Example**: `"Company logo"` or `"/.*logo$/"`

## Key Behaviors

### AND Logic
When multiple criteria are specified, elements must match **ALL** of them:

```json
{
  "action": "click",
  "selector": "button",
  "elementId": "submit",
  "elementClass": ["btn", "btn-primary"]
}
```
Element must be: a button + id="submit" + have both classes

### First Match Selection
If multiple elements satisfy all criteria, the **first one in DOM order** is selected.

### Regex Support
All string fields support regex patterns using `/pattern/` syntax (no flags):

```json
{
  "elementId": "/submit-.+/",
  "elementClass": ["/btn-.+/", "active"]
}
```

### Case Sensitivity
All string matching is **case-sensitive** unless regex pattern includes case-insensitive logic.

## Quick Start Examples

### Find by Test ID
```json
{
  "action": "click",
  "elementTestId": "checkout-button"
}
```

### Find by Multiple Classes
```json
{
  "action": "find",
  "elementClass": ["modal", "modal-visible"]
}
```

### Find by Combined Criteria
```json
{
  "action": "type",
  "elementAttribute": {
    "type": "email",
    "required": true
  },
  "keys": "user@example.com"
}
```

### Screenshot with Enhanced Crop
```json
{
  "action": "screenshot",
  "path": "modal.png",
  "crop": {
    "elementTestId": "modal-dialog",
    "elementClass": "visible"
  }
}
```

## Migration and Compatibility

### Backward Compatible
All existing tests work without modification:

```json
// Still works exactly as before
{
  "action": "click",
  "selector": "#submit-button"
}
```

### Enhanced Version
You can now be more specific:

```json
{
  "action": "click",
  "elementId": "submit-button",
  "elementClass": "btn-primary",
  "elementAttribute": { "disabled": false }
}
```

## Documentation

- **[Usage Examples](USAGE_EXAMPLES.md)** - Comprehensive examples for all scenarios
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Technical details and design decisions

## Error Handling

Clear error messages indicate which criteria were evaluated:

```
Error: No element found matching all specified criteria: selector, elementId, elementClass
```

## Testing

Comprehensive test suite included:
- 26 test scenarios covering all new fields
- Regex pattern tests
- Combined criteria tests
- Backward compatibility tests

Test files:
- `core/test/artifacts/enhanced-element-finding.spec.json`
- `core/test/server/public/enhanced-elements.html`

## Performance

Element finding uses optimized evaluation order:
1. `elementId` (if specified) - typically unique
2. `selector` (if specified) - narrows search space
3. `elementTestId` (if specified) - typically unique
4. Other criteria as needed

Elements are found using polling with 100ms intervals up to the specified timeout (default 5000ms).

## Schema Validation

All new fields are validated at runtime:
- At least one criterion must be specified
- `elementClass` accepts string or array
- `elementAttribute` values must be string, number, or boolean
- Regex patterns must be valid

## Common Use Cases

### Test ID-Based Testing
```json
{
  "action": "type",
  "elementTestId": "username-input",
  "keys": "john.doe"
}
```

### Attribute-Based Selection
```json
{
  "action": "find",
  "elementAttribute": {
    "role": "button",
    "aria-pressed": "false"
  }
}
```

### Dynamic Elements with Regex
```json
{
  "action": "click",
  "elementId": "/user-item-\\d+/",
  "elementClass": "list-item"
}
```

### State-Based Selection
```json
{
  "action": "click",
  "selector": "button",
  "elementAttribute": {
    "disabled": false
  },
  "elementClass": "enabled"
}
```

## Best Practices

1. **Use Test IDs**: Most stable for testing
   ```json
   { "elementTestId": "submit-button" }
   ```

2. **Combine for Precision**: Narrow down matches
   ```json
   { 
     "selector": "button",
     "elementText": "Submit",
     "elementClass": "primary"
   }
   ```

3. **Use Regex Wisely**: For dynamic content
   ```json
   { "elementId": "/item-\\d+/" }
   ```

4. **Check State**: Use boolean attributes
   ```json
   { 
     "elementAttribute": {
       "disabled": false,
       "required": true
     }
   }
   ```

## Troubleshooting

### No Element Found
- Check that all specified criteria can be satisfied by a single element
- Verify regex patterns are valid
- Increase timeout if element appears late
- Use simpler criteria to debug

### Multiple Elements Match
- Add more specific criteria
- Use unique identifiers (ID, test ID)
- Check DOM order if first element isn't desired

### Regex Not Working
- Ensure pattern uses `/pattern/` syntax
- Test pattern separately
- Check for escaping issues with special characters

## Future Enhancements

Potential future additions:
- Support for CSS pseudo-classes (`:hover`, `:focus`, etc.)
- Custom attribute matching functions
- Element relationship criteria (parent, sibling, child)
- Multiple element selection (not just first match)

## Contributing

See the main repository documentation for contribution guidelines.

## License

Same as the main Doc Detective project.
