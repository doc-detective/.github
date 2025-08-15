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

- **`source`** (required): The element to drag. Can be a string (element text or CSS/XPath selector) or an object with `elementText` and/or `selector` properties.
- **`target`** (required): The target location to drop the element. Can be a string (element text or CSS/XPath selector) or an object with `elementText` and/or `selector` properties.
- **`duration`** (optional): Duration of the drag operation in milliseconds. Default is 1000ms.

When using the detailed object syntax for `source` or `target`:
- **`elementText`** (optional): Display text of the element. If combined with `selector`, the element must match both.
- **`selector`** (optional): CSS or XPath selector of the element. If combined with `elementText`, the element must match both.
- **`timeout`** (optional): Max duration in milliseconds to wait for the element to exist. Default is 5000ms.

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

## Behavior

- Uses the same element finding logic as the [`find`](find) action
- Supports both text-based and selector-based element identification
- When both `elementText` and `selector` are specified, elements must match both criteria
- When multiple elements match criteria, operates on the first matched element
- Duration controls the speed of the drag operation (higher values = slower drags)
- Inherits timeout settings from Doc Detective configuration for element finding
- Integrates with existing test result reporting and logging