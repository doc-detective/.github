const { fabric } = require("fabric");
const { createCanvas, loadImage } = require("canvas");
const { findElement } = require("./findElement");
const { log } = require("../utils");
const fs = require("fs");

exports.annotateScreenshot = annotateScreenshot;

async function annotateScreenshot({ config, filePath, annotations, driver }) {
  try {
    log(config, "debug", `Starting annotation of screenshot: ${filePath}`);

    // Load the screenshot image
    const image = await loadImage(filePath);
    const width = image.width;
    const height = image.height;

    // Create a node-canvas
    const nodeCanvas = createCanvas(width, height);
    const ctx = nodeCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    // Create Fabric.js StaticCanvas for server-side rendering
    const fabricCanvas = new fabric.StaticCanvas(nodeCanvas, {
      width: width,
      height: height,
    });

    // Get pixel density for scaling
    const pixelDensity = await driver.execute(() => window.devicePixelRatio);
    log(config, "debug", `Pixel density: ${pixelDensity}`);

    // Process each annotation
    for (const annotation of annotations) {
      try {
        await renderAnnotation({
          config,
          fabricCanvas,
          annotation,
          driver,
          pixelDensity,
          canvasWidth: width,
          canvasHeight: height,
        });
      } catch (error) {
        log(
          config,
          "warn",
          `Failed to render annotation: ${error.message}`
        );
        return {
          success: false,
          error: `Annotation rendering failed: ${error.message}`,
        };
      }
    }

    // Render Fabric canvas back to node canvas
    fabricCanvas.renderAll();

    // Get buffer from node canvas
    const buffer = nodeCanvas.toBuffer("image/png");

    // Write buffer to file (overwriting original)
    fs.writeFileSync(filePath, buffer);

    log(
      config,
      "debug",
      `Successfully annotated screenshot with ${annotations.length} annotation(s)`
    );

    return { success: true };
  } catch (error) {
    log(config, "error", `Annotation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function renderAnnotation({
  config,
  fabricCanvas,
  annotation,
  driver,
  pixelDensity,
  canvasWidth,
  canvasHeight,
}) {
  // Determine base position for annotation
  let basePosition = { x: 0, y: 0 };

  // If annotation has a 'find' field, locate the element
  if (annotation.find) {
    const findStep = {
      find: annotation.find,
    };

    const findResult = await findElement({
      config,
      step: findStep,
      driver,
    });

    if (findResult.status === "FAIL") {
      throw new Error(`Could not find element: ${findResult.description}`);
    }

    const element = findResult.outputs?.rawElement;
    if (!element) {
      throw new Error("Element not found for annotation");
    }

    // Get element bounds and scale by pixel density
    const rect = await driver.execute((el) => {
      const bounds = el.getBoundingClientRect();
      return {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    }, element);

    // Scale coordinates by pixel density
    basePosition.x = rect.x * pixelDensity;
    basePosition.y = rect.y * pixelDensity;
    basePosition.width = rect.width * pixelDensity;
    basePosition.height = rect.height * pixelDensity;

    log(config, "debug", `Element position: ${JSON.stringify(basePosition)}`);
  }

  // Apply position keyword if specified
  if (annotation.position) {
    if (typeof annotation.position === "string") {
      basePosition = applyPositionKeyword(
        annotation.position,
        basePosition,
        canvasWidth,
        canvasHeight
      );
    } else if (
      typeof annotation.position === "object" &&
      annotation.position.x !== undefined &&
      annotation.position.y !== undefined
    ) {
      // Absolute position
      basePosition = {
        x: annotation.position.x * pixelDensity,
        y: annotation.position.y * pixelDensity,
      };
    }
  }

  // Render annotation based on type
  if (annotation.arrow) {
    renderArrow(fabricCanvas, annotation.arrow, basePosition, pixelDensity);
  } else if (annotation.text) {
    renderText(fabricCanvas, annotation.text, basePosition, pixelDensity);
  } else if (annotation.rectangle) {
    renderRectangle(
      fabricCanvas,
      annotation.rectangle,
      basePosition,
      pixelDensity
    );
  } else if (annotation.circle) {
    renderCircle(fabricCanvas, annotation.circle, basePosition, pixelDensity);
  } else if (annotation.line) {
    renderLine(fabricCanvas, annotation.line, basePosition, pixelDensity);
  } else if (annotation.callout) {
    renderCallout(fabricCanvas, annotation.callout, basePosition, pixelDensity);
  } else if (annotation.highlight) {
    renderHighlight(
      fabricCanvas,
      annotation.highlight,
      basePosition,
      pixelDensity
    );
  } else if (annotation.blur) {
    renderBlur(fabricCanvas, annotation.blur, basePosition, pixelDensity);
  }
}

function applyPositionKeyword(
  keyword,
  basePosition,
  canvasWidth,
  canvasHeight
) {
  const hasElement = basePosition.width !== undefined;

  if (!hasElement) {
    // Position within viewport
    switch (keyword) {
      case "top":
        return { x: canvasWidth / 2, y: 50 };
      case "bottom":
        return { x: canvasWidth / 2, y: canvasHeight - 50 };
      case "left":
        return { x: 50, y: canvasHeight / 2 };
      case "right":
        return { x: canvasWidth - 50, y: canvasHeight / 2 };
      case "center":
        return { x: canvasWidth / 2, y: canvasHeight / 2 };
      case "top-left":
        return { x: 50, y: 50 };
      case "top-right":
        return { x: canvasWidth - 50, y: 50 };
      case "bottom-left":
        return { x: 50, y: canvasHeight - 50 };
      case "bottom-right":
        return { x: canvasWidth - 50, y: canvasHeight - 50 };
      default:
        return { x: 0, y: 0 };
    }
  } else {
    // Position relative to element
    const centerX = basePosition.x + basePosition.width / 2;
    const centerY = basePosition.y + basePosition.height / 2;

    switch (keyword) {
      case "top":
        return { x: centerX, y: basePosition.y, ...basePosition };
      case "bottom":
        return {
          x: centerX,
          y: basePosition.y + basePosition.height,
          ...basePosition,
        };
      case "left":
        return { x: basePosition.x, y: centerY, ...basePosition };
      case "right":
        return {
          x: basePosition.x + basePosition.width,
          y: centerY,
          ...basePosition,
        };
      case "center":
        return { x: centerX, y: centerY, ...basePosition };
      case "top-left":
        return { x: basePosition.x, y: basePosition.y, ...basePosition };
      case "top-right":
        return {
          x: basePosition.x + basePosition.width,
          y: basePosition.y,
          ...basePosition,
        };
      case "bottom-left":
        return {
          x: basePosition.x,
          y: basePosition.y + basePosition.height,
          ...basePosition,
        };
      case "bottom-right":
        return {
          x: basePosition.x + basePosition.width,
          y: basePosition.y + basePosition.height,
          ...basePosition,
        };
      default:
        return { x: centerX, y: centerY, ...basePosition };
    }
  }
}

function renderArrow(fabricCanvas, arrow, basePosition, pixelDensity) {
  const defaults = {
    color: "#FF0000",
    strokeWidth: 3,
    headSize: 15,
  };

  const config = { ...defaults, ...arrow };

  // Calculate from/to positions
  const fromX = basePosition.x + (arrow.from?.x || 0) * pixelDensity;
  const fromY = basePosition.y + (arrow.from?.y || 0) * pixelDensity;
  const toX = basePosition.x + (arrow.to?.x || 0) * pixelDensity;
  const toY = basePosition.y + (arrow.to?.y || 0) * pixelDensity;

  // Calculate angle for arrowhead
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Create arrow line
  const line = new fabric.Line([fromX, fromY, toX, toY], {
    stroke: config.color,
    strokeWidth: config.strokeWidth,
    selectable: false,
    evented: false,
  });

  // Create arrowhead triangle
  const headLength = config.headSize;
  const headAngle = Math.PI / 6; // 30 degrees

  const arrowHead = new fabric.Triangle({
    left: toX,
    top: toY,
    originX: "center",
    originY: "center",
    width: headLength,
    height: headLength,
    fill: config.color,
    angle: (angle * 180) / Math.PI + 90,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(line);
  fabricCanvas.add(arrowHead);
}

function renderText(fabricCanvas, text, basePosition, pixelDensity) {
  const defaults = {
    fontSize: 16,
    fontFamily: "Arial",
    color: "#000000",
    backgroundColor: "#FFFFFF",
    padding: 5,
    opacity: 1,
  };

  const config = { ...defaults, ...text };

  const textObj = new fabric.Textbox(config.content, {
    left: basePosition.x,
    top: basePosition.y,
    fontSize: config.fontSize * pixelDensity,
    fontFamily: config.fontFamily,
    fill: config.color,
    backgroundColor: config.backgroundColor,
    padding: config.padding * pixelDensity,
    width: config.maxWidth
      ? config.maxWidth * pixelDensity
      : 200 * pixelDensity,
    opacity: config.opacity,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(textObj);
}

function renderRectangle(fabricCanvas, rectangle, basePosition, pixelDensity) {
  const defaults = {
    fill: "transparent",
    stroke: "#FF0000",
    strokeWidth: 2,
    opacity: 1,
    rx: 0,
    ry: 0,
  };

  const config = { ...defaults, ...rectangle };

  const rect = new fabric.Rect({
    left: basePosition.x,
    top: basePosition.y,
    width: (config.width || basePosition.width || 100) * pixelDensity,
    height: (config.height || basePosition.height || 100) * pixelDensity,
    fill: config.fill,
    stroke: config.stroke,
    strokeWidth: config.strokeWidth * pixelDensity,
    opacity: config.opacity,
    rx: config.rx * pixelDensity,
    ry: config.ry * pixelDensity,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(rect);
}

function renderCircle(fabricCanvas, circle, basePosition, pixelDensity) {
  const defaults = {
    radius: 30,
    fill: "transparent",
    stroke: "#FF0000",
    strokeWidth: 2,
    opacity: 1,
  };

  const config = { ...defaults, ...circle };

  const circleObj = new fabric.Circle({
    left: basePosition.x,
    top: basePosition.y,
    radius: config.radius * pixelDensity,
    fill: config.fill,
    stroke: config.stroke,
    strokeWidth: config.strokeWidth * pixelDensity,
    opacity: config.opacity,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(circleObj);
}

function renderLine(fabricCanvas, line, basePosition, pixelDensity) {
  const defaults = {
    color: "#000000",
    strokeWidth: 2,
  };

  const config = { ...defaults, ...line };

  const fromX = basePosition.x + (line.from?.x || 0) * pixelDensity;
  const fromY = basePosition.y + (line.from?.y || 0) * pixelDensity;
  const toX = basePosition.x + (line.to?.x || 0) * pixelDensity;
  const toY = basePosition.y + (line.to?.y || 0) * pixelDensity;

  const lineObj = new fabric.Line([fromX, fromY, toX, toY], {
    stroke: config.color,
    strokeWidth: config.strokeWidth * pixelDensity,
    strokeDashArray: config.dashArray
      ? config.dashArray.map((v) => v * pixelDensity)
      : undefined,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(lineObj);
}

function renderCallout(fabricCanvas, callout, basePosition, pixelDensity) {
  const defaults = {
    fontSize: 14,
    color: "#000000",
    backgroundColor: "#FFFFCC",
    arrowColor: "#000000",
  };

  const config = { ...defaults, ...callout };

  // Target position
  const targetX = basePosition.x + (callout.target?.x || 0) * pixelDensity;
  const targetY = basePosition.y + (callout.target?.y || 0) * pixelDensity;

  // Text position (auto-position if not specified)
  let textX, textY;
  if (callout.textPosition) {
    textX = basePosition.x + callout.textPosition.x * pixelDensity;
    textY = basePosition.y + callout.textPosition.y * pixelDensity;
  } else {
    // Auto-position above and to the left of target
    textX = targetX - 100 * pixelDensity;
    textY = targetY - 80 * pixelDensity;
  }

  // Create text box
  const textObj = new fabric.Textbox(config.content, {
    left: textX,
    top: textY,
    fontSize: config.fontSize * pixelDensity,
    fontFamily: "Arial",
    fill: config.color,
    backgroundColor: config.backgroundColor,
    padding: 8 * pixelDensity,
    width: config.maxWidth
      ? config.maxWidth * pixelDensity
      : 150 * pixelDensity,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(textObj);

  // Create arrow from text to target
  const textCenterX = textX + textObj.width / 2;
  const textCenterY = textY + textObj.height / 2;

  const angle = Math.atan2(targetY - textCenterY, targetX - textCenterX);

  const line = new fabric.Line([textCenterX, textCenterY, targetX, targetY], {
    stroke: config.arrowColor,
    strokeWidth: 2 * pixelDensity,
    selectable: false,
    evented: false,
  });

  const arrowHead = new fabric.Triangle({
    left: targetX,
    top: targetY,
    originX: "center",
    originY: "center",
    width: 10 * pixelDensity,
    height: 10 * pixelDensity,
    fill: config.arrowColor,
    angle: (angle * 180) / Math.PI + 90,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(line);
  fabricCanvas.add(arrowHead);
}

function renderHighlight(fabricCanvas, highlight, basePosition, pixelDensity) {
  const defaults = {
    color: "#FFFF00",
    opacity: 0.3,
  };

  const config = { ...defaults, ...highlight };

  const rect = new fabric.Rect({
    left: basePosition.x,
    top: basePosition.y,
    width: basePosition.width || 100 * pixelDensity,
    height: basePosition.height || 100 * pixelDensity,
    fill: config.color,
    opacity: config.opacity,
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(rect);
}

function renderBlur(fabricCanvas, blur, basePosition, pixelDensity) {
  const defaults = {
    intensity: 10,
  };

  const config = { ...defaults, ...blur };

  // For blur, we use a semi-transparent overlay as a visual indicator
  // True pixel blur would require Sharp preprocessing
  const rect = new fabric.Rect({
    left: basePosition.x,
    top: basePosition.y,
    width: (config.width || basePosition.width || 100) * pixelDensity,
    height: (config.height || basePosition.height || 100) * pixelDensity,
    fill: "rgba(200, 200, 200, 0.8)",
    selectable: false,
    evented: false,
  });

  fabricCanvas.add(rect);
}
