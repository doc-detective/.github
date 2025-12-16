const sharp = require("sharp");
const fs = require("fs");
const { findElement } = require("./findElement");
const { log } = require("../utils");

// Export
exports.annotateScreenshot = annotateScreenshot;

// Helper to escape XML for SVG text
function escapeXml(str = "") {
  return String(str).replace(/[<>&'\"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

async function annotateScreenshot({ config, filePath, annotations = [], driver }) {
  try {
    log(config, "debug", `Starting SVG-based annotation of screenshot: ${filePath}`);

    if (!Array.isArray(annotations) || annotations.length === 0) {
      log(config, "debug", "No annotations provided, skipping.");
      return { success: true };
    }

    // Read image metadata
    const image = sharp(filePath);
    const meta = await image.metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;

    // Get device pixel ratio from driver, default to 1
    let pixelDensity = 1;
    try {
      const pd = await driver.execute(() => window.devicePixelRatio).catch(() => undefined);
      if (pd && typeof pd === "number") pixelDensity = pd;
    } catch (e) {
      /* ignore */
    }
    log(config, "debug", `Pixel density: ${pixelDensity}`);

    // Resolve any `find` annotations to bounding rects
    const resolved = [];
    for (const ann of annotations) {
      const a = { ...ann };
      a._rect = null;
      if (a.find) {
        const findStep = { find: a.find };
        const findResult = await findElement({ config, step: findStep, driver });
        if (findResult.status === "FAIL") {
          throw new Error(`Could not find element for annotation: ${findResult.description}`);
        }
        const element = findResult.outputs?.rawElement;
        if (!element) throw new Error("Element not found for annotation");

        const rect = await driver.execute((el) => {
          const b = el.getBoundingClientRect();
          return { x: b.left, y: b.top, width: b.width, height: b.height };
        }, element);

        a._rect = {
          x: Math.round(rect.x * pixelDensity),
          y: Math.round(rect.y * pixelDensity),
          width: Math.round(rect.width * pixelDensity),
          height: Math.round(rect.height * pixelDensity),
        };
      }
      resolved.push(a);
    }

    // Build SVG overlay (without blur regions)
    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

    for (const a of resolved) {
      // Compute base x,y,width,height helpers
      const baseX = (a.position && typeof a.position.x === 'number') ? Math.round(a.position.x * pixelDensity) : (a._rect ? a._rect.x : 0);
      const baseY = (a.position && typeof a.position.y === 'number') ? Math.round(a.position.y * pixelDensity) : (a._rect ? a._rect.y : 0);
      const baseW = (a.rectangle && a.rectangle.width) ? Math.round(a.rectangle.width * pixelDensity) : (a._rect ? a._rect.width : undefined);
      const baseH = (a.rectangle && a.rectangle.height) ? Math.round(a.rectangle.height * pixelDensity) : (a._rect ? a._rect.height : undefined);

      if (a.rectangle) {
        const rx = (a.rectangle.rx || 0) * pixelDensity;
        const ry = (a.rectangle.ry || 0) * pixelDensity;
        const stroke = a.rectangle.stroke || '#FF0000';
        const strokeW = (a.rectangle.strokeWidth || 2) * pixelDensity;
        const fill = (a.rectangle.fill === 'transparent') ? 'none' : (a.rectangle.fill || 'none');
        const opacity = a.rectangle.opacity == null ? 1 : a.rectangle.opacity;
        const w = baseW || (100 * pixelDensity);
        const h = baseH || (100 * pixelDensity);
        svgParts.push(`<rect x="${baseX}" y="${baseY}" width="${w}" height="${h}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" opacity="${opacity}"/>`);
        continue;
      }

      if (a.circle) {
        const cx = baseX;
        const cy = baseY;
        const r = Math.round((a.circle.radius || 30) * pixelDensity);
        const fill = (a.circle.fill === 'transparent') ? 'none' : (a.circle.fill || 'none');
        const stroke = a.circle.stroke || '#FF0000';
        const strokeW = (a.circle.strokeWidth || 2) * pixelDensity;
        const opacity = a.circle.opacity == null ? 1 : a.circle.opacity;
        svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" opacity="${opacity}"/>`);
        continue;
      }

      if (a.line || a.arrow) {
        const from = (a.line && a.line.from) || (a.arrow && a.arrow.from) || { x: 0, y: 0 };
        const to = (a.line && a.line.to) || (a.arrow && a.arrow.to) || { x: 10, y: 10 };
        const fx = baseX + Math.round((from.x || 0) * pixelDensity);
        const fy = baseY + Math.round((from.y || 0) * pixelDensity);
        const tx = baseX + Math.round((to.x || 0) * pixelDensity);
        const ty = baseY + Math.round((to.y || 0) * pixelDensity);
        const color = (a.line && a.line.color) || (a.arrow && a.arrow.color) || '#000000';
        const strokeW = ((a.line && a.line.strokeWidth) || (a.arrow && a.arrow.strokeWidth) || 2) * pixelDensity;
        svgParts.push(`<line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>`);
        if (a.arrow) {
          const head = (a.arrow.headSize || 15) * pixelDensity;
          const angle = Math.atan2(ty - fy, tx - fx);
          const hx = tx;
          const hy = ty;
          const leftX = hx - Math.cos(angle) * head + Math.sin(angle) * (head / 2);
          const leftY = hy - Math.sin(angle) * head - Math.cos(angle) * (head / 2);
          const rightX = hx - Math.cos(angle) * head - Math.sin(angle) * (head / 2);
          const rightY = hy - Math.sin(angle) * head + Math.cos(angle) * (head / 2);
          svgParts.push(`<polygon points="${hx},${hy} ${leftX},${leftY} ${rightX},${rightY}" fill="${a.arrow.color || color}"/>`);
        }
        continue;
      }

      if (a.text) {
        const x = baseX;
        const y = baseY;
        const fontSize = ((a.text.fontSize || 16) * pixelDensity);
        const color = a.text.color || '#000000';
        const opacity = a.text.opacity == null ? 1 : a.text.opacity;
        const family = a.text.fontFamily || 'Arial, sans-serif';
        const content = escapeXml(a.text.content || '');
        svgParts.push(`<text x="${x}" y="${y + fontSize}" font-family="${family}" font-size="${fontSize}" fill="${color}" opacity="${opacity}">${content}</text>`);
        continue;
      }

      if (a.highlight) {
        const x = baseX;
        const y = baseY;
        const w = baseW || (a.highlight.width ? Math.round(a.highlight.width * pixelDensity) : (a._rect ? a._rect.width : 100));
        const h = baseH || (a.highlight.height ? Math.round(a.highlight.height * pixelDensity) : (a._rect ? a._rect.height : 100));
        const color = a.highlight.color || '#FFFF00';
        const opacity = a.highlight.opacity == null ? 0.3 : a.highlight.opacity;
        svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`);
        continue;
      }

      // blur handled after SVG compositing via sharp
    }

    svgParts.push(`</svg>`);
    const svg = svgParts.join('\n');

    // Composite SVG overlay onto original image -> buffer
    const baseBuffer = await image.composite([{ input: Buffer.from(svg), blend: 'over' }]).png().toBuffer();

    // If there are blur annotations, apply them by extracting, blurring, and compositing
    const blurAnns = resolved.filter((a) => a.blur);
    if (blurAnns.length > 0) {
      let working = sharp(baseBuffer);
      for (const b of blurAnns) {
        const bx = (b.position && typeof b.position.x === 'number') ? Math.round(b.position.x * pixelDensity) : (b._rect ? b._rect.x : 0);
        const by = (b.position && typeof b.position.y === 'number') ? Math.round(b.position.y * pixelDensity) : (b._rect ? b._rect.y : 0);
        const bw = (b.blur && b.blur.width) ? Math.round(b.blur.width * pixelDensity) : (b._rect ? b._rect.width : Math.round((b.blur && b.blur.width) || 100));
        const bh = (b.blur && b.blur.height) ? Math.round(b.blur.height * pixelDensity) : (b._rect ? b._rect.height : Math.round((b.blur && b.blur.height) || 50));
        try {
          const extracted = await sharp(baseBuffer).extract({ left: bx, top: by, width: bw, height: bh }).blur(b.blur.intensity || 10).toBuffer();
          working = working.composite([{ input: extracted, left: bx, top: by }]);
        } catch (err) {
          log(config, 'warn', `Couldn't apply blur for annotation: ${err.message}`);
        }
      }
      await working.png().toFile(filePath);
    } else {
      // No blur; write composed buffer directly
      fs.writeFileSync(filePath, baseBuffer);
    }

    log(config, 'debug', `Successfully annotated screenshot with ${annotations.length} annotation(s)`);
    return { success: true };
  } catch (error) {
    log(config, 'error', `Annotation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}
