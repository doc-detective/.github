/**
 * Windows Element Finding Strategies
 *
 * This module provides Windows-specific element finding strategies
 * using Windows UI Automation properties via the NovaWindows Driver.
 *
 * Supported locator strategies:
 * - Accessibility ID: [id="SaveButton"]
 * - Name: [name="Save"]
 * - XPath: //Button[@Name="Save"]
 * - Class Name: [class="Button"]
 * - AutomationId: [automationid="SaveButton"]
 */

exports.parseWindowsSelector = parseWindowsSelector;
exports.isWindowsContext = isWindowsContext;
exports.buildWindowsXPath = buildWindowsXPath;

/**
 * Checks if the current context is a Windows app context.
 *
 * @param {Object} context - The test context
 * @returns {boolean} True if this is a Windows app context
 */
function isWindowsContext(context) {
  return !!(context?.app || context?.isWindowsApp);
}

/**
 * Parses a Doc Detective selector and converts it to a Windows-compatible format.
 *
 * Supported formats:
 * - CSS-like selectors: [id="value"], [name="value"], [class="value"]
 * - XPath: //Element[@Property="value"]
 * - Simple text: Will be treated as Name or Text search
 *
 * @param {string} selector - The original selector
 * @returns {Object} Parsed selector info with strategy and value
 */
function parseWindowsSelector(selector) {
  if (!selector || typeof selector !== "string") {
    return { strategy: null, value: null, original: selector };
  }

  // XPath selector
  if (selector.startsWith("//") || selector.startsWith("/")) {
    return {
      strategy: "xpath",
      value: selector,
      original: selector,
    };
  }

  // Attribute selector patterns: [attribute="value"]
  const attributeMatch = selector.match(
    /^\[([a-z-]+)(?:=["']?([^"'\]]+)["']?)?\]$/i
  );
  if (attributeMatch) {
    const [, attribute, value] = attributeMatch;
    const normalizedAttr = attribute.toLowerCase();

    // Map common attributes to Windows UI Automation properties
    switch (normalizedAttr) {
      case "id":
      case "automationid":
        return {
          strategy: "accessibility id",
          value: value,
          original: selector,
        };
      case "name":
        return {
          strategy: "name",
          value: value,
          original: selector,
        };
      case "class":
      case "classname":
        return {
          strategy: "class name",
          value: value,
          original: selector,
        };
      default:
        // Generic attribute - use XPath
        return {
          strategy: "xpath",
          value: `//*[@${attribute}="${value}"]`,
          original: selector,
        };
    }
  }

  // Compound selector patterns: [attr1="val1"][attr2="val2"]
  const compoundMatches = selector.matchAll(/\[([a-z-]+)=["']?([^"'\]]+)["']?\]/gi);
  const compounds = Array.from(compoundMatches);
  if (compounds.length > 1) {
    // Build an XPath with multiple conditions
    const conditions = compounds.map(([, attr, val]) => {
      const normalizedAttr = mapAttributeToUIA(attr);
      return `@${normalizedAttr}="${val}"`;
    });
    return {
      strategy: "xpath",
      value: `//*[${conditions.join(" and ")}]`,
      original: selector,
    };
  }

  // CSS class selector: .classname
  if (selector.startsWith(".")) {
    return {
      strategy: "class name",
      value: selector.slice(1),
      original: selector,
    };
  }

  // CSS ID selector: #id
  if (selector.startsWith("#")) {
    return {
      strategy: "accessibility id",
      value: selector.slice(1),
      original: selector,
    };
  }

  // Element type selector (e.g., Button, Edit, ComboBox)
  const elementTypes = [
    "Button",
    "Edit",
    "Text",
    "ComboBox",
    "ListBox",
    "ListItem",
    "TreeItem",
    "TreeView",
    "MenuItem",
    "Menu",
    "Window",
    "Pane",
    "Document",
    "CheckBox",
    "RadioButton",
    "Slider",
    "Tab",
    "TabItem",
    "ScrollBar",
    "ToolBar",
    "StatusBar",
    "ProgressBar",
    "Hyperlink",
    "Image",
    "Table",
    "DataGrid",
    "Calendar",
    "DatePicker",
    "Spinner",
    "Group",
    "Thumb",
    "DataItem",
    "Header",
    "HeaderItem",
    "SplitButton",
    "TitleBar",
    "AppBar",
  ];

  const selectorLower = selector.toLowerCase();
  for (const type of elementTypes) {
    if (selectorLower === type.toLowerCase()) {
      return {
        strategy: "class name",
        value: type,
        original: selector,
      };
    }
  }

  // Plain text - search by Name property
  return {
    strategy: "name",
    value: selector,
    original: selector,
  };
}

/**
 * Maps a common attribute name to its Windows UI Automation equivalent.
 *
 * @param {string} attribute - The attribute name
 * @returns {string} The UIA property name
 */
function mapAttributeToUIA(attribute) {
  const attrLower = attribute.toLowerCase();
  const mappings = {
    id: "AutomationId",
    automationid: "AutomationId",
    name: "Name",
    class: "ClassName",
    classname: "ClassName",
    controltype: "ControlType",
    type: "ControlType",
    value: "Value",
    isenabled: "IsEnabled",
    isoffscreen: "IsOffscreen",
  };
  return mappings[attrLower] || attribute;
}

/**
 * Builds a Windows UI Automation XPath from element finding criteria.
 *
 * @param {Object} criteria - Element finding criteria
 * @returns {string} XPath expression
 */
function buildWindowsXPath(criteria) {
  const conditions = [];
  let elementType = "*";

  if (criteria.selector) {
    // If selector is provided, try to extract element type
    const parsed = parseWindowsSelector(criteria.selector);
    if (parsed.strategy === "class name") {
      elementType = parsed.value;
    } else if (parsed.strategy === "xpath") {
      // Return the XPath directly
      return parsed.value;
    } else if (parsed.strategy && parsed.value) {
      conditions.push(`@${mapAttributeToUIA(parsed.strategy.replace(" ", ""))}="${parsed.value}"`);
    }
  }

  if (criteria.elementId) {
    conditions.push(`@AutomationId="${criteria.elementId}"`);
  }

  if (criteria.elementText) {
    conditions.push(`@Name="${criteria.elementText}"`);
  }

  if (criteria.elementClass) {
    const classes = Array.isArray(criteria.elementClass)
      ? criteria.elementClass
      : [criteria.elementClass];
    classes.forEach((cls) => {
      conditions.push(`contains(@ClassName, "${cls}")`);
    });
  }

  if (criteria.elementAria) {
    // In Windows, accessible name is often the Name property
    conditions.push(`@Name="${criteria.elementAria}"`);
  }

  if (criteria.elementAttribute) {
    for (const [attr, value] of Object.entries(criteria.elementAttribute)) {
      const uiaAttr = mapAttributeToUIA(attr);
      if (typeof value === "boolean") {
        conditions.push(`@${uiaAttr}="${value}"`);
      } else {
        conditions.push(`@${uiaAttr}="${value}"`);
      }
    }
  }

  if (conditions.length === 0) {
    return `//${elementType}`;
  }

  return `//${elementType}[${conditions.join(" and ")}]`;
}

/**
 * Converts a CSS-style selector to a Windows-compatible WebDriver selector.
 *
 * This function helps translate web-style selectors to Windows UI Automation
 * compatible selectors for use with the NovaWindows Driver.
 *
 * @param {string} selector - CSS-style selector
 * @returns {Object} Object with `using` and `value` for WebDriver
 */
function convertToWindowsSelector(selector) {
  const parsed = parseWindowsSelector(selector);

  return {
    using: parsed.strategy,
    value: parsed.value,
  };
}

exports.convertToWindowsSelector = convertToWindowsSelector;
