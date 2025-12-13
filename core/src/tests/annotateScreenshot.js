const { findElement } = require("./findElement");
const { log } = require("../utils");
const fs = require("fs");

exports.annotateScreenshot = annotateScreenshot;

/**
 * Annotate a screenshot with various shapes and text.
 * @param {Object} options
 * @param {Object} options.config - Configuration object
 * @param {string} options.filePath - Path to the screenshot file to annotate
 * @param {Array} options.annotations - Array of annotation objects
 * @param {Object} options.driver - WebDriverIO driver instance
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function annotateScreenshot({ config, filePath, annotations, driver }) {
  try {
    // Dynamic import for canvas ESM module
    const { createCanvas, loadImage } = await import("canvas");

    // Load the image
    const imageBuffer = fs.readFileSync(filePath);
    const image = await loadImage(imageBuffer);

    // Create a canvas with the image dimensions
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");

    // Draw the original image
    ctx.drawImage(image, 0, 0);

    // Get pixel density from the browser if driver is available
    let pixelDensity = 1;
    if (driver) {
      try {
        pixelDensity = await driver.execute(() => window.devicePixelRatio);
      } catch {
        log(config, "debug", "Could not get pixel density, using default of 1");
      }
    }

    // Process each annotation
    for (const annotation of annotations) {
      try {
        await renderAnnotation({
          config,
          ctx,
          annotation,
          driver,
          pixelDensity,
          imageWidth: image.width,
          imageHeight: image.height,
        });
      } catch (err) {
        log(config, "warn", `Failed to render annotation: ${err.message}`);
      }
    }

    // Write the annotated image back to the file
    const annotatedBuffer = canvas.toBuffer("image/png");
    fs.writeFileSync(filePath, annotatedBuffer);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Render a single annotation on the canvas context.
 */
async function renderAnnotation({
  config,
  ctx,
  annotation,
  driver,
  pixelDensity,
  imageWidth,
  imageHeight,
}) {
  // Default styles
  const color = annotation.color || "#FF0000";
  const backgroundColor = annotation.backgroundColor || null;
  const strokeWidth = annotation.strokeWidth ?? 2;
  const fontSize = annotation.fontSize || 16;
  const fontFamily = annotation.fontFamily || "Arial";
  const opacity = annotation.opacity ?? 1;
  const padding = annotation.padding || 0;

  // Get element bounds if find is specified
  let elementBounds = null;
  if (annotation.find && driver) {
    elementBounds = await getElementBounds({
      config,
      find: annotation.find,
      driver,
      pixelDensity,
    });
  }

  // Calculate position based on element bounds and position keyword
  const position = calculatePosition({
    annotation,
    elementBounds,
    imageWidth,
    imageHeight,
    padding,
  });

  // Set global alpha for opacity
  ctx.globalAlpha = opacity;

  switch (annotation.type) {
    case "rectangle": {
      const width =
        annotation.width ||
        (elementBounds ? elementBounds.width + padding * 2 : 100);
      const height =
        annotation.height ||
        (elementBounds ? elementBounds.height + padding * 2 : 50);

      const x = position.x - padding;
      const y = position.y - padding;

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, width, height);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(x, y, width, height);
      break;
    }

    case "circle": {
      const radius =
        annotation.radius ||
        (elementBounds
          ? Math.max(elementBounds.width, elementBounds.height) / 2 + padding
          : 30);

      const centerX = elementBounds
        ? position.x + elementBounds.width / 2
        : position.x;
      const centerY = elementBounds
        ? position.y + elementBounds.height / 2
        : position.y;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      break;
    }

    case "arrow": {
      const startX = position.x;
      const startY = position.y;
      const endX = annotation.endX ?? startX + 100;
      const endY = annotation.endY ?? startY + 100;

      // Draw line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = strokeWidth * 5;

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }

    case "line": {
      const startX = position.x;
      const startY = position.y;
      const endX = annotation.endX ?? startX + 100;
      const endY = annotation.endY ?? startY + 100;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      break;
    }

    case "text": {
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.fillText(annotation.text || "", position.x, position.y);
      break;
    }

    case "callout": {
      // Calculate text box position
      const textPosition = annotation.textPosition || "top";
      const textOffset = 60;
      let textX = position.x;
      let textY = position.y;

      if (elementBounds) {
        const centerX = position.x + elementBounds.width / 2;
        const centerY = position.y + elementBounds.height / 2;

        switch (textPosition) {
          case "top":
            textX = centerX;
            textY = position.y - textOffset;
            break;
          case "bottom":
            textX = centerX;
            textY = position.y + elementBounds.height + textOffset;
            break;
          case "left":
            textX = position.x - textOffset;
            textY = centerY;
            break;
          case "right":
            textX = position.x + elementBounds.width + textOffset;
            textY = centerY;
            break;
          case "top-left":
            textX = position.x - textOffset;
            textY = position.y - textOffset;
            break;
          case "top-right":
            textX = position.x + elementBounds.width + textOffset;
            textY = position.y - textOffset;
            break;
          case "bottom-left":
            textX = position.x - textOffset;
            textY = position.y + elementBounds.height + textOffset;
            break;
          case "bottom-right":
            textX = position.x + elementBounds.width + textOffset;
            textY = position.y + elementBounds.height + textOffset;
            break;
        }
      }

      // Measure text for background
      ctx.font = `${fontSize}px ${fontFamily}`;
      const textMetrics = ctx.measureText(annotation.text || "");
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      const bgPadding = 8;

      // Draw background rectangle for text
      ctx.fillStyle = backgroundColor || "white";
      ctx.fillRect(
        textX - textWidth / 2 - bgPadding,
        textY - textHeight / 2 - bgPadding,
        textWidth + bgPadding * 2,
        textHeight + bgPadding * 2
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        textX - textWidth / 2 - bgPadding,
        textY - textHeight / 2 - bgPadding,
        textWidth + bgPadding * 2,
        textHeight + bgPadding * 2
      );

      // Draw arrow from text to element
      if (elementBounds) {
        const centerX = position.x + elementBounds.width / 2;
        const centerY = position.y + elementBounds.height / 2;

        ctx.beginPath();
        ctx.moveTo(textX, textY);
        ctx.lineTo(centerX, centerY);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth / 2;
        ctx.stroke();

        // Add arrowhead
        const angle = Math.atan2(centerY - textY, centerX - textX);
        const headLength = strokeWidth * 4;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX - headLength * Math.cos(angle - Math.PI / 6),
          centerY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          centerX - headLength * Math.cos(angle + Math.PI / 6),
          centerY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Draw text
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(annotation.text || "", textX, textY);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      break;
    }

    case "highlight": {
      const width =
        annotation.width ||
        (elementBounds ? elementBounds.width + padding * 2 : 100);
      const height =
        annotation.height ||
        (elementBounds ? elementBounds.height + padding * 2 : 30);

      ctx.fillStyle = backgroundColor || "rgba(255, 255, 0, 0.3)";
      ctx.fillRect(position.x - padding, position.y - padding, width, height);
      break;
    }

    case "blur": {
      // Create a semi-transparent overlay to simulate blur
      // True blur would require Sharp preprocessing
      const width =
        annotation.width ||
        (elementBounds ? elementBounds.width + padding * 2 : 100);
      const height =
        annotation.height ||
        (elementBounds ? elementBounds.height + padding * 2 : 50);

      ctx.fillStyle = backgroundColor || "rgba(200, 200, 200, 0.7)";
      ctx.fillRect(position.x - padding, position.y - padding, width, height);
      break;
    }

    default:
      log(config, "warn", `Unknown annotation type: ${annotation.type}`);
  }

  // Reset global alpha
  ctx.globalAlpha = 1;
}

/**
 * Get the bounding rectangle of an element.
 */
async function getElementBounds({ config, find, driver, pixelDensity }) {
  try {
    const findStep = typeof find === "string" ? { find } : { find };
    const findResult = await findElement({
      config,
      step: findStep,
      driver,
    });

    if (findResult.status !== "PASS" || !findResult.outputs?.rawElement) {
      return null;
    }

    const element = findResult.outputs.rawElement;

    // Get bounding rect from browser
    const rect = await driver.execute((el) => {
      const bounds = el.getBoundingClientRect();
      return {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    }, element);

    // Scale by pixel density
    return {
      x: rect.x * pixelDensity,
      y: rect.y * pixelDensity,
      width: rect.width * pixelDensity,
      height: rect.height * pixelDensity,
    };
  } catch (err) {
    log(config, "debug", `Failed to get element bounds: ${err.message}`);
    return null;
  }
}

/**
 * Calculate the position for an annotation based on element bounds and position keyword.
 */
function calculatePosition({
  annotation,
  elementBounds,
  imageWidth,
  imageHeight,
  padding,
}) {
  let x = annotation.x ?? 0;
  let y = annotation.y ?? 0;

  if (elementBounds) {
    const position = annotation.position || "center";

    switch (position) {
      case "top":
        x = elementBounds.x + elementBounds.width / 2;
        y = elementBounds.y - padding;
        break;
      case "bottom":
        x = elementBounds.x + elementBounds.width / 2;
        y = elementBounds.y + elementBounds.height + padding;
        break;
      case "left":
        x = elementBounds.x - padding;
        y = elementBounds.y + elementBounds.height / 2;
        break;
      case "right":
        x = elementBounds.x + elementBounds.width + padding;
        y = elementBounds.y + elementBounds.height / 2;
        break;
      case "center":
        x = elementBounds.x;
        y = elementBounds.y;
        break;
      case "top-left":
        x = elementBounds.x - padding;
        y = elementBounds.y - padding;
        break;
      case "top-right":
        x = elementBounds.x + elementBounds.width + padding;
        y = elementBounds.y - padding;
        break;
      case "bottom-left":
        x = elementBounds.x - padding;
        y = elementBounds.y + elementBounds.height + padding;
        break;
      case "bottom-right":
        x = elementBounds.x + elementBounds.width + padding;
        y = elementBounds.y + elementBounds.height + padding;
        break;
      default:
        x = elementBounds.x;
        y = elementBounds.y;
    }

    // Add manual offset if specified
    if (annotation.x !== undefined) x += annotation.x;
    if (annotation.y !== undefined) y += annotation.y;
  }

  // Clamp to image bounds
  x = Math.max(0, Math.min(x, imageWidth));
  y = Math.max(0, Math.min(y, imageHeight));

  return { x, y };
}
