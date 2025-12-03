---
sidebar_label: Test Windows Applications
---

# Test Windows Desktop Applications

Doc Detective supports testing native Windows desktop applications including Win32, WPF, WinForms, and UWP apps using the NovaWindows driver.

## Prerequisites

Before testing Windows applications, ensure you have:

1. **Windows operating system** - Windows 10 or Windows 11
2. **Appium** - Already included with Doc Detective
3. **NovaWindows driver** - Installed automatically during Doc Detective setup on Windows

If the NovaWindows driver isn't installed, you can install it manually:

```bash
appium driver install --source=npm @aspect/novawindows
```

:::note
Unlike the deprecated Windows Application Driver (WinAppDriver), NovaWindows doesn't require Windows Developer Mode to be enabled.
:::

## Defining a Windows App Context

To test Windows applications, define an `apps` array in your test context. Here's a basic example:

```json
{
  "contexts": [
    {
      "apps": [
        {
          "name": "notepad"
        }
      ],
      "platforms": ["windows"]
    }
  ]
}
```

### App Configuration Options

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | **Required.** Application name or executable. Common apps like `notepad`, `calculator`, `paint`, and `wordpad` are automatically resolved. |
| `path` | string | Full path to the application executable. Use this for custom applications. |
| `appType` | string | Type of app: `win32`, `wpf`, `winforms`, or `uwp`. Auto-detected if not specified. |
| `automationName` | string | Automation backend. Defaults to `NovaWindows`. |
| `options` | object | Additional launch and behavior options. |

### Options Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `launchTimeout` | number | 30000 | Milliseconds to wait for app to launch |
| `windowTitle` | string | - | Expected window title for verification |
| `keepAppOpen` | boolean | false | Keep app open after test completes |
| `clickDelay` | number | 0 | Delay in ms before clicking elements |
| `smoothMouseMove` | boolean | false | Enable smooth mouse movements |

## Common Windows Applications

Doc Detective automatically resolves paths for these common applications:

| Name | Application |
|------|-------------|
| `notepad` | Notepad text editor |
| `calculator` | Windows Calculator (UWP) |
| `paint` | MS Paint |
| `wordpad` | WordPad |

## Example Test Specifications

### Testing Notepad

```json
{
  "id": "notepad-test",
  "contexts": [
    {
      "apps": [
        {
          "name": "notepad",
          "options": {
            "windowTitle": "Untitled - Notepad"
          }
        }
      ],
      "platforms": ["windows"]
    }
  ],
  "tests": [
    {
      "id": "type-and-verify",
      "description": "Type text in Notepad and take a screenshot",
      "steps": [
        {
          "action": "find",
          "selector": "[name='Text Editor']"
        },
        {
          "action": "type",
          "keys": ["Hello from Doc Detective!"]
        },
        {
          "action": "screenshot",
          "path": "notepad-test.png"
        }
      ]
    }
  ]
}
```

### Testing Windows Calculator

```json
{
  "id": "calculator-test",
  "contexts": [
    {
      "apps": [
        {
          "name": "calculator",
          "appType": "uwp"
        }
      ],
      "platforms": ["windows"]
    }
  ],
  "tests": [
    {
      "id": "basic-addition",
      "description": "Perform 5 + 3 = 8",
      "steps": [
        {
          "action": "click",
          "selector": "[name='Five']"
        },
        {
          "action": "click",
          "selector": "[name='Plus']"
        },
        {
          "action": "click",
          "selector": "[name='Three']"
        },
        {
          "action": "click",
          "selector": "[name='Equals']"
        },
        {
          "action": "screenshot",
          "path": "calculator-result.png"
        }
      ]
    }
  ]
}
```

### Testing a Custom Application

For applications not in the common list, specify the full path:

```json
{
  "contexts": [
    {
      "apps": [
        {
          "name": "MyApp",
          "path": "C:\\Program Files\\MyCompany\\MyApp.exe",
          "appType": "wpf",
          "options": {
            "launchTimeout": 60000,
            "windowTitle": "My Application"
          }
        }
      ],
      "platforms": ["windows"]
    }
  ]
}
```

## Finding Elements

Windows applications use different locator strategies than web applications. Doc Detective automatically handles these conversions.

### Element Selector Strategies

| Strategy | Selector Format | Example |
|----------|----------------|---------|
| Accessibility ID | `[id='...']` or `#...` | `[id='btnSubmit']` |
| Name | `[name='...']` | `[name='Calculate']` |
| Class Name | `[class='...']` | `[class='Button']` |
| XPath | `//...` | `//Button[@Name='OK']` |

### Tips for Finding Elements

1. **Use Inspect.exe** - Windows includes the Inspect accessibility tool to explore element properties
2. **Accessibility ID is preferred** - Most reliable for element identification
3. **Name attribute** - Good for buttons and labeled controls
4. **XPath** - Use for complex element traversal

## Supported Actions

The following Doc Detective actions work with Windows applications:

| Action | Description |
|--------|-------------|
| `click` | Click on UI elements |
| `find` | Locate elements in the application |
| `type` | Type text and special keys |
| `screenshot` | Capture application screenshots |
| `wait` | Pause between actions |
| `goTo` | Launch a different application |

## Troubleshooting

### Application doesn't launch

- Verify the application path is correct
- Check if the application requires administrator privileges
- Increase `launchTimeout` for slow-starting applications

### Element not found

- Use Inspect.exe to verify element properties
- Try different locator strategies (name, accessibility ID)
- Ensure the element is visible and not occluded

### NovaWindows driver not installed

Run the following command to install:

```bash
appium driver install --source=npm @aspect/novawindows
```

### Tests work locally but fail in CI

- Ensure the CI runner has a Windows GUI session
- Some Windows UI elements require an interactive desktop
- Consider using Windows Server with Desktop Experience

## Next Steps

- [Learn about test contexts](/docs/references/schemas/context)
- [Explore all available actions](/docs/get-started/concepts#action)
- [Set up your test environment](/docs/get-started/tutorials/set-up-your-test-environment)
