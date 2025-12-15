const { createCanvas, loadImage } = require("canvas");
const { findElement } = require("./findElement");
const { log } = require("../utils");
const fs = require("fs");

// Constants for default dimensions and positioning
const DEFAULT_SIZE = 100;
const DEFAULT_CALLOUT_OFFSET_X = 100;
const DEFAULT_CALLOUT_OFFSET_Y = 80;

exports.annotateScreenshot = annotateScreenshot;

async function annotateScreenshot({ config, filePath, annotations, driver }) {
  try {
    log(config, "debug", `Starting annotation of screenshot: ${filePath}`);

    // Load the screenshot image
    const image = await loadImage(filePath);
    const width = image.width;
    const height = image.height;

    // Create a canvas and draw the image
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    // Get pixel density for scaling
    const pixelDensity = await driver.execute(() => window.devicePixelRatio);
    log(config, "debug", `Pixel density: ${pixelDensity}`);

    // Process each annotation
    for (const annotation of annotations) {
      try {
        await renderAnnotation({
          config,
          ctx,
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

    // Save canvas to file
    const buffer = canvas.toBuffer("image/png");
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
  ctx,
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
    renderArrow(ctx, annotation.arrow, basePosition, pixelDensity);
  } else if (annotation.text) {
    renderText(ctx, annotation.text, basePosition, pixelDensity);
  } else if (annotation.rectangle) {
    renderRectangle(ctx, annotation.rectangle, basePosition, pixelDensity);
  } else if (annotation.circle) {
    renderCircle(ctx, annotation.circle, basePosition, pixelDensity);
  } else if (annotation.line) {
    renderLine(ctx, annotation.line, basePosition, pixelDensity);
  } else if (annotation.callout) {
    renderCallout(ctx, annotation.callout, basePosition, pixelDensity);
  } else if (annotation.highlight) {
    renderHighlight(ctx, annotation.highlight, basePosition, pixelDensity);
  } else if (annotation.blur) {
    renderBlur(ctx, annotation.blur, basePosition, pixelDensity);
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

function renderArrow(ctx, arrow, basePosition, pixelDensity) {
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

  // Draw line
  ctx.strokeStyle = config.color;
  ctx.lineWidth = config.strokeWidth;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLength = config.headSize;

  ctx.save();
  ctx.translate(toX, toY);
  ctx.rotate(angle);
  ctx.fillStyle = config.color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-headLength, -headLength / 2);
  ctx.lineTo(-headLength, headLength / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderText(ctx, text, basePosition, pixelDensity) {
  const defaults = {
    fontSize: 16,
    fontFamily: "Arial",
    color: "#000000",
    backgroundColor: "#FFFFFF",
    padding: 5,
    opacity: 1,
  };

  const config = { ...defaults, ...text };

  ctx.save();
  ctx.font = `${config.fontSize * pixelDensity}px ${config.fontFamily}`;
  ctx.fillStyle = config.color;
  ctx.globalAlpha = config.opacity;

  // Measure text
  const maxWidth = config.maxWidth
    ? config.maxWidth * pixelDensity
    : 200 * pixelDensity;
  const lines = wrapText(ctx, config.content, maxWidth);
  const lineHeight = config.fontSize * pixelDensity * 1.2;
  const textHeight = lines.length * lineHeight;
  const padding = config.padding * pixelDensity;

  // Calculate text box dimensions
  let maxLineWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxLineWidth) {
      maxLineWidth = metrics.width;
    }
  });

  // Draw background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(
    basePosition.x - padding,
    basePosition.y - padding,
    maxLineWidth + padding * 2,
    textHeight + padding * 2
  );

  // Draw text
  ctx.fillStyle = config.color;
  lines.forEach((line, i) => {
    ctx.fillText(
      line,
      basePosition.x,
      basePosition.y + (i + 1) * lineHeight - lineHeight / 4
    );
  });

  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

function renderRectangle(ctx, rectangle, basePosition, pixelDensity) {
  const defaults = {
    fill: "transparent",
    stroke: "#FF0000",
    strokeWidth: 2,
    opacity: 1,
    rx: 0,
    ry: 0,
  };

  const config = { ...defaults, ...rectangle };

  const x = basePosition.x;
  const y = basePosition.y;
  const width = (config.width ?? basePosition.width ?? DEFAULT_SIZE) * pixelDensity;
  const height = (config.height ?? basePosition.height ?? DEFAULT_SIZE) * pixelDensity;
  const rx = config.rx * pixelDensity;
  const ry = config.ry * pixelDensity;

  ctx.save();
  ctx.globalAlpha = config.opacity;

  // Draw rounded rectangle
  ctx.beginPath();
  if (rx > 0 || ry > 0) {
    const r = Math.max(rx, ry);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.closePath();

  if (config.fill !== "transparent") {
    ctx.fillStyle = config.fill;
    ctx.fill();
  }

  if (config.strokeWidth > 0) {
    ctx.strokeStyle = config.stroke;
    ctx.lineWidth = config.strokeWidth * pixelDensity;
    ctx.stroke();
  }

  ctx.restore();
}

function renderCircle(ctx, circle, basePosition, pixelDensity) {
  const defaults = {
    radius: 30,
    fill: "transparent",
    stroke: "#FF0000",
    strokeWidth: 2,
    opacity: 1,
  };

  const config = { ...defaults, ...circle };

  ctx.save();
  ctx.globalAlpha = config.opacity;

  ctx.beginPath();
  ctx.arc(
    basePosition.x,
    basePosition.y,
    config.radius * pixelDensity,
    0,
    2 * Math.PI
  );

  if (config.fill !== "transparent") {
    ctx.fillStyle = config.fill;
    ctx.fill();
  }

  if (config.strokeWidth > 0) {
    ctx.strokeStyle = config.stroke;
    ctx.lineWidth = config.strokeWidth * pixelDensity;
    ctx.stroke();
  }

  ctx.restore();
}

function renderLine(ctx, line, basePosition, pixelDensity) {
  const defaults = {
    color: "#000000",
    strokeWidth: 2,
  };

  const config = { ...defaults, ...line };

  const fromX = basePosition.x + (line.from?.x || 0) * pixelDensity;
  const fromY = basePosition.y + (line.from?.y || 0) * pixelDensity;
  const toX = basePosition.x + (line.to?.x || 0) * pixelDensity;
  const toY = basePosition.y + (line.to?.y || 0) * pixelDensity;

  ctx.save();
  ctx.strokeStyle = config.color;
  ctx.lineWidth = config.strokeWidth * pixelDensity;

  if (config.dashArray) {
    ctx.setLineDash(config.dashArray.map((v) => v * pixelDensity));
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.restore();
}

function renderCallout(ctx, callout, basePosition, pixelDensity) {
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
    textX = targetX - DEFAULT_CALLOUT_OFFSET_X * pixelDensity;
    textY = targetY - DEFAULT_CALLOUT_OFFSET_Y * pixelDensity;
  }

  // Draw text box
  ctx.save();
  ctx.font = `${config.fontSize * pixelDensity}px Arial`;

  const maxWidth = config.maxWidth
    ? config.maxWidth * pixelDensity
    : 150 * pixelDensity;
  const lines = wrapText(ctx, config.content, maxWidth);
  const lineHeight = config.fontSize * pixelDensity * 1.2;
  const textHeight = lines.length * lineHeight;
  const padding = 8 * pixelDensity;

  let maxLineWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxLineWidth) {
      maxLineWidth = metrics.width;
    }
  });

  const boxWidth = maxLineWidth + padding * 2;
  const boxHeight = textHeight + padding * 2;

  // Draw background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(textX, textY, boxWidth, boxHeight);

  // Draw text
  ctx.fillStyle = config.color;
  lines.forEach((line, i) => {
    ctx.fillText(
      line,
      textX + padding,
      textY + padding + (i + 1) * lineHeight - lineHeight / 4
    );
  });

  // Draw arrow from text to target
  const textCenterX = textX + boxWidth / 2;
  const textCenterY = textY + boxHeight / 2;

  ctx.strokeStyle = config.arrowColor;
  ctx.lineWidth = 2 * pixelDensity;
  ctx.beginPath();
  ctx.moveTo(textCenterX, textCenterY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(targetY - textCenterY, targetX - textCenterX);
  const headLength = 10 * pixelDensity;

  ctx.translate(targetX, targetY);
  ctx.rotate(angle);
  ctx.fillStyle = config.arrowColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-headLength, -headLength / 2);
  ctx.lineTo(-headLength, headLength / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function renderHighlight(ctx, highlight, basePosition, pixelDensity) {
  const defaults = {
    color: "#FFFF00",
    opacity: 0.3,
  };

  const config = { ...defaults, ...highlight };

  ctx.save();
  ctx.fillStyle = config.color;
  ctx.globalAlpha = config.opacity;
  ctx.fillRect(
    basePosition.x,
    basePosition.y,
    basePosition.width ?? DEFAULT_SIZE * pixelDensity,
    basePosition.height ?? DEFAULT_SIZE * pixelDensity
  );
  ctx.restore();
}

function renderBlur(ctx, blur, basePosition, pixelDensity) {
  const defaults = {
    intensity: 10,
  };

  const config = { ...defaults, ...blur };

  // For blur, we use a semi-transparent overlay as a visual indicator
  // True pixel blur would require Sharp preprocessing
  ctx.save();
  ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
  ctx.fillRect(
    basePosition.x,
    basePosition.y,
    (config.width ?? basePosition.width ?? DEFAULT_SIZE) * pixelDensity,
    (config.height ?? basePosition.height ?? DEFAULT_SIZE) * pixelDensity
  );
  ctx.restore();
}
