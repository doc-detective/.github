---
title: dragAndDrop
layout: default
nav_order: 1
parent: Actions
grand_parent: Tests
description: Drag and drop an element from source to target.
---

# dragAndDrop

The `dragAndDrop` action enables simulating drag-and-drop interactions in web browsers during test execution. This action moves elements from a source location to a target location, supporting both simple and detailed syntax patterns.

> For comprehensive options, see the [`dragAndDrop`](/docs/references/schemas/dragAndDrop) reference.

## Syntax

The `dragAndDrop` action supports two syntax patterns:

### Simple syntax

```json
{
  "dragAndDrop": {
    "source": "Table",
    "target": "#canvas"
  }
}
```

### Detailed syntax

```json
{
  "dragAndDrop": {
    "source": {
      "selector": ".widget",
      "elementText": "Data Table"
    },
    "target": {
      "selector": "#design-canvas"
    },
    "duration": 500
  }
}
```

## Properties

- **`source`** (required): The element to drag. Can be a string (element text, CSS/XPath selector, or regex pattern) or an object with `elementText` and/or `selector` properties.
- **`target`** (required): The target location to drop the element. Can be a string (element text, CSS/XPath selector, or regex pattern) or an object with `elementText` and/or `selector` properties.
- **`duration`** (optional): Duration of the drag operation in milliseconds. Default is 1000ms.

When using the detailed object syntax for `source` or `target`:
- **`elementText`** (optional): Display text of the element or regex pattern. If combined with `selector`, the element must match both.
- **`selector`** (optional): CSS or XPath selector of the element. If combined with `elementText`, the element must match both.
- **`timeout`** (optional): Max duration in milliseconds to wait for the element to exist. Default is 5000ms.

### Regex Pattern Matching

The `dragAndDrop` action supports regex pattern matching for both simple string syntax and detailed object syntax:

- **Simple syntax**: Use regex patterns enclosed in forward slashes, e.g., `"/Widget.*/"`
- **Object syntax**: Use regex patterns in the `elementText` property, e.g., `"elementText": "/Button [0-9]+/"`

Regex patterns allow for flexible element matching when text content varies or contains dynamic values.

At least one of `elementText` or `selector` is required for each element object.

## Examples

Here are a few ways you might use the `dragAndDrop` action:

### Drag element by text to selector target (simple syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag the Table widget to the canvas",
          "dragAndDrop": {
            "source": "Table",
            "target": "#canvas"
          }
        }
      ]
    }
  ]
}
```

### Drag element by selector to selector target (simple syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag block element to drop zone",
          "dragAndDrop": {
            "source": ".draggable-block",
            "target": ".drop-zone"
          }
        }
      ]
    }
  ]
}
```

### Drag with custom duration (simple syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Slowly drag element to target",
          "dragAndDrop": {
            "source": ".draggable",
            "target": ".target",
            "duration": 2000
          }
        }
      ]
    }
  ]
}
```

### Drag with combined text and selector criteria (detailed syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag specific table widget to canvas",
          "dragAndDrop": {
            "source": {
              "selector": ".widget",
              "elementText": "Data Table"
            },
            "target": {
              "selector": "#design-canvas"
            },
            "duration": 500
          }
        }
      ]
    }
  ]
}
```

### Drag with custom timeouts (detailed syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag with custom wait times",
          "dragAndDrop": {
            "source": {
              "selector": ".slow-loading-element",
              "timeout": 10000
            },
            "target": {
              "elementText": "Drop Zone",
              "timeout": 5000
            }
          }
        }
      ]
    }
  ]
}
```

### Drag using variable substitution

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag element using dynamic selectors",
          "dragAndDrop": {
            "source": "$SOURCE_SELECTOR",
            "target": "$TARGET_SELECTOR",
            "duration": "$DRAG_DURATION"
          }
        }
      ]
    }
  ]
}
```

### Drag using regex pattern matching (simple syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag any widget item to the canvas using regex",
          "dragAndDrop": {
            "source": "/Widget Item.*/",
            "target": "#canvas"
          }
        }
      ]
    }
  ]
}
```

### Drag using regex pattern matching (detailed syntax)

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag specific numbered widget using regex",
          "dragAndDrop": {
            "source": {
              "selector": ".draggable",
              "elementText": "/Widget.*[0-9]+/"
            },
            "target": {
              "selector": ".drop-zone"
            }
          }
        }
      ]
    }
  ]
}
```

### Drag to target found by regex

```json
{
  "tests": [
    {
      "steps": [
        {
          "description": "Drag to any available drop zone using regex",
          "dragAndDrop": {
            "source": "Table",
            "target": "/Drop Zone.*/"
          }
        }
      ]
    }
  ]
}
```

## Behavior

- Uses the same element finding logic as the [`find`](find) action, including full regex pattern matching support
- Supports both text-based and selector-based element identification
- Regex patterns should be enclosed in forward slashes (e.g., `/pattern/`) for both simple syntax and elementText properties
- When both `elementText` and `selector` are specified, elements must match both criteria
- When multiple elements match criteria, operates on the first matched element
- Duration controls the speed of the drag operation (higher values = slower drags)
- Inherits timeout settings from Doc Detective configuration for element finding
- Integrates with existing test result reporting and logging