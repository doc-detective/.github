# Enhanced Element Finding - Usage Examples

This document provides practical examples of using the enhanced element finding capabilities.

## Basic Usage

### Finding by Element ID

```json
{
  "action": "click",
  "elementId": "submit-button"
}
```

### Finding by Test ID

```json
{
  "action": "click",
  "elementTestId": "login-form-submit"
}
```

### Finding by Single Class

```json
{
  "action": "click",
  "elementClass": "btn-primary"
}
```

### Finding by Multiple Classes

```json
{
  "action": "click",
  "elementClass": ["btn", "btn-large", "enabled"]
}
```

### Finding by Attribute

```json
{
  "action": "click",
  "elementAttribute": {
    "aria-label": "Close dialog"
  }
}
```

### Finding by Alt Text (Images)

```json
{
  "action": "click",
  "selector": "img",
  "elementAltText": "Company logo"
}
```

## Regex Pattern Examples

### Matching ID with Pattern

```json
{
  "action": "click",
  "elementId": "/submit-.+/"
}
```
Matches: `submit-button`, `submit-form`, `submit-primary`, etc.

### Matching Test ID with Pattern

```json
{
  "action": "find",
  "elementTestId": "/.*-submit/"
}
```
Matches: `login-submit`, `form-submit`, `checkout-submit`, etc.

### Matching Classes with Pattern

```json
{
  "action": "find",
  "elementClass": ["/btn-.+/", "active"]
}
```
Element must have a class matching `btn-*` pattern AND the `active` class.

### Matching Attributes with Pattern

```json
{
  "action": "find",
  "elementAttribute": {
    "href": "/^https:/",
    "data-validation": "/^email-.+/"
  }
}
```

## Combined Criteria (AND Logic)

### Selector + ID + Classes

```json
{
  "action": "click",
  "selector": "button",
  "elementId": "primary-action",
  "elementClass": ["btn", "btn-primary"]
}
```
Must match ALL three:
1. Be a `button` element
2. Have `id="primary-action"`
3. Have both `btn` and `btn-primary` classes

### Text + Test ID + Attribute

```json
{
  "action": "click",
  "elementText": "Submit Order",
  "elementTestId": "checkout-button",
  "elementAttribute": {
    "disabled": "false"
  }
}
```

### Selector + Class + Multiple Attributes

```json
{
  "action": "find",
  "selector": "input",
  "elementClass": "form-control",
  "elementAttribute": {
    "type": "email",
    "required": true,
    "data-validation": "/^email-.+/"
  }
}
```

## Type Action Examples

### Type into Element by Test ID

```json
{
  "action": "type",
  "elementTestId": "username-field",
  "keys": "john.doe@example.com"
}
```

### Type into Element by Multiple Attributes

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

### Type into Element by Class and ID

```json
{
  "action": "type",
  "elementId": "search-input",
  "elementClass": "form-control",
  "keys": ["search query", "$ENTER$"]
}
```

## Screenshot Examples

### Screenshot Element by Test ID

```json
{
  "action": "screenshot",
  "path": "modal-screenshot.png",
  "crop": {
    "elementTestId": "modal-dialog"
  }
}
```

### Screenshot Element by Classes and Attribute

```json
{
  "action": "screenshot",
  "path": "visible-modal.png",
  "crop": {
    "elementClass": ["modal", "modal-visible"],
    "elementAttribute": {
      "aria-hidden": "false"
    }
  }
}
```

### Screenshot Image by Alt Text

```json
{
  "action": "screenshot",
  "path": "logo.png",
  "crop": {
    "selector": "img",
    "elementAltText": "/.*logo$/"
  }
}
```

## Boolean Attribute Examples

### Finding Disabled Button

```json
{
  "action": "find",
  "selector": "button",
  "elementAttribute": {
    "disabled": true
  }
}
```

### Finding Enabled Button (No Disabled Attribute)

```json
{
  "action": "click",
  "selector": "button",
  "elementAttribute": {
    "disabled": false
  }
}
```

### Finding Required Input

```json
{
  "action": "type",
  "selector": "input",
  "elementAttribute": {
    "required": true,
    "type": "email"
  },
  "keys": "test@example.com"
}
```

## Numeric Attribute Examples

```json
{
  "action": "find",
  "selector": "button",
  "elementAttribute": {
    "data-count": 5,
    "tabindex": 0
  }
}
```

## Real-World Scenarios

### Login Form Submission

```json
{
  "tests": [
    {
      "steps": [
        {
          "action": "goTo",
          "url": "https://example.com/login"
        },
        {
          "action": "type",
          "elementTestId": "username-input",
          "keys": "john.doe"
        },
        {
          "action": "type",
          "elementTestId": "password-input",
          "keys": "SecurePass123"
        },
        {
          "action": "click",
          "elementTestId": "login-submit",
          "elementClass": ["btn", "btn-primary"]
        }
      ]
    }
  ]
}
```

### Modal Dialog Interaction

```json
{
  "tests": [
    {
      "steps": [
        {
          "action": "click",
          "elementTestId": "open-modal"
        },
        {
          "action": "find",
          "elementClass": ["modal", "modal-visible"],
          "elementAttribute": {
            "aria-hidden": "false"
          }
        },
        {
          "action": "screenshot",
          "path": "modal-open.png",
          "crop": {
            "elementClass": ["modal", "modal-visible"]
          }
        },
        {
          "action": "click",
          "elementTestId": "modal-close",
          "elementAttribute": {
            "aria-label": "Close modal"
          }
        }
      ]
    }
  ]
}
```

### Form Validation Testing

```json
{
  "tests": [
    {
      "steps": [
        {
          "action": "type",
          "elementAttribute": {
            "type": "email",
            "required": true,
            "data-validation": "email-validator"
          },
          "keys": "invalid-email"
        },
        {
          "action": "click",
          "elementId": "submit-button",
          "elementClass": "btn-primary"
        },
        {
          "action": "find",
          "elementClass": "error-message",
          "elementText": "/Please enter a valid email/"
        }
      ]
    }
  ]
}
```

### E-commerce Checkout

```json
{
  "tests": [
    {
      "steps": [
        {
          "action": "click",
          "elementTestId": "add-to-cart",
          "elementAttribute": {
            "data-product-id": "12345"
          }
        },
        {
          "action": "click",
          "elementId": "/cart-icon-.+/",
          "elementClass": "header-icon"
        },
        {
          "action": "click",
          "elementTestId": "checkout-button",
          "elementClass": ["btn", "btn-large", "btn-primary"],
          "elementText": "Proceed to Checkout"
        }
      ]
    }
  ]
}
```

## Migration Guide

### Before (Old Syntax)

```json
{
  "action": "click",
  "selector": "#submit-button"
}
```

### After (New Options Available)

```json
{
  "action": "click",
  "elementId": "submit-button"
}
```

Or combine for more precision:

```json
{
  "action": "click",
  "selector": "button",
  "elementId": "submit-button",
  "elementClass": "btn-primary"
}
```

### Before (Text Match)

```json
{
  "action": "click",
  "selector": "button",
  "elementText": "Submit"
}
```

### After (More Options)

```json
{
  "action": "click",
  "elementText": "Submit",
  "elementClass": "btn-primary",
  "elementAttribute": {
    "disabled": false
  }
}
```

## Tips and Best Practices

1. **Use Test IDs for Stable Tests**: Test IDs are specifically for testing and won't change with styling
   ```json
   {
     "action": "click",
     "elementTestId": "submit-button"
   }
   ```

2. **Combine Criteria for Precision**: When multiple elements match, narrow down with additional criteria
   ```json
   {
     "action": "click",
     "selector": "button",
     "elementText": "Submit",
     "elementClass": "btn-primary"
   }
   ```

3. **Use Regex for Flexible Matching**: When IDs or classes are dynamic
   ```json
   {
     "action": "find",
     "elementId": "/user-item-\\d+/"
   }
   ```

4. **Boolean Attributes for State**: Check if elements are enabled, required, checked, etc.
   ```json
   {
     "action": "find",
     "elementAttribute": {
       "disabled": false,
       "required": true
     }
   }
   ```

5. **Performance Optimization**: Start with most unique criteria (ID, test ID, selector)
   ```json
   {
     "action": "click",
     "elementId": "unique-button",
     "elementClass": "btn"
   }
   ```
